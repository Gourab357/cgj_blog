import 'server-only';

import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from 'crypto';
import type { JsonWebKey as NodeJsonWebKey } from 'crypto';
import { cookies } from 'next/headers';
import { DatabaseError, deleteRows, insertRow, selectRows, updateRows } from '@/lib/database';

const SESSION_COOKIE = 'cgj_admin_session';
const OAUTH_STATE_COOKIE = 'cgj_google_oauth_state';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

type DatabaseSession = {
  id: string;
  google_subject: string;
  email: string;
  display_name: string | null;
  expires_at: string;
  invalidated_at: string | null;
};

type AdminMember = {
  id: string;
  google_subject: string | null;
  email: string;
  display_name: string | null;
  is_active: boolean;
};

type OAuthTransaction = {
  id: string;
  code_verifier: string;
  nonce: string;
  return_to: string;
  expires_at: string;
  consumed_at: string | null;
};

type GoogleClaims = {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
};

type GoogleJwk = NodeJsonWebKey & { kid?: string; kty?: string };

export type GoogleIdentity = {
  subject: string;
  email: string;
  displayName: string | null;
};

export type AppSession = {
  id: string;
  identity: GoogleIdentity;
  expiresAt: Date;
};

export type AdminSession = AppSession & {
  admin: { id: string; email: string; displayName: string | null };
};

export class AuthenticationError extends Error {
  constructor(public readonly kind: 'unauthenticated' | 'forbidden') {
    super(kind === 'unauthenticated' ? 'Sign in is required.' : 'Administrator access is required.');
    this.name = 'AuthenticationError';
  }
}

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

function environment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function base64url(bytes: Buffer) {
  return bytes.toString('base64url');
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function equal(value: string, expected: string) {
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

function expirationDate(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeInternalAdminPath(value: string | null) {
  return value && /^\/admin(?:\/|$)/.test(value) && !value.startsWith('//') ? value : '/admin';
}

export function googleOAuthConfiguration() {
  const redirectUri = environment('GOOGLE_OAUTH_REDIRECT_URI');
  const redirectUrl = new URL(redirectUri);
  if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
    throw new Error('GOOGLE_OAUTH_REDIRECT_URI must use http or https.');
  }
  return {
    clientId: environment('GOOGLE_CLIENT_ID'),
    clientSecret: environment('GOOGLE_CLIENT_SECRET'),
    redirectUri,
  };
}

export async function createGoogleAuthorizationUrl(next: string | null) {
  const config = googleOAuthConfiguration();
  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(48));
  const nonce = base64url(randomBytes(32));
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  await insertRow('oauth_transactions', {
    state_hash: digest(state),
    code_verifier: codeVerifier,
    nonce,
    return_to: safeInternalAdminPath(next),
    expires_at: expirationDate(OAUTH_TTL_SECONDS).toISOString(),
  }, 'service');

  cookies().set(OAUTH_STATE_COOKIE, state, cookieOptions(OAUTH_TTL_SECONDS));

  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('nonce', nonce);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('prompt', 'select_account');
  return authorizationUrl.toString();
}

function clearOAuthStateCookie() {
  cookies().set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

async function consumeOAuthTransaction(state: string): Promise<OAuthTransaction> {
  const cookieState = cookies().get(OAUTH_STATE_COOKIE)?.value;
  clearOAuthStateCookie();
  if (!cookieState || !equal(state, cookieState)) throw new GoogleOAuthError('The sign-in request could not be verified. Please try again.');

  const rows = await selectRows<OAuthTransaction>('oauth_transactions', {
    select: 'id,code_verifier,nonce,return_to,expires_at,consumed_at',
    state_hash: `eq.${digest(state)}`,
  }, 'service');
  const transaction = rows[0];
  const expiresAt = transaction && parseDate(transaction.expires_at);
  if (!transaction || transaction.consumed_at || !expiresAt || expiresAt <= new Date()) {
    throw new GoogleOAuthError('This sign-in link has expired. Please start again.');
  }

  const claimed = await updateRows<OAuthTransaction>('oauth_transactions', {
    id: `eq.${transaction.id}`,
    consumed_at: 'is.null',
  }, { consumed_at: new Date().toISOString() }, 'service');
  if (!claimed.length) throw new GoogleOAuthError('This sign-in link has already been used. Please start again.');
  return transaction;
}

function decodeJwtPart(part: string) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new GoogleOAuthError('Google returned an invalid identity token.');
  }
}

async function verifyGoogleIdentityToken(idToken: string, expectedNonce: string): Promise<GoogleIdentity> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleOAuthError('Google returned an invalid identity token.');

  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]) as GoogleClaims;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new GoogleOAuthError('Google returned an unsupported identity token.');
  }

  const keysResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store' });
  if (!keysResponse.ok) throw new GoogleOAuthError('Unable to verify the Google identity token.');
  const keys = await keysResponse.json() as { keys?: GoogleJwk[] };
  const key = keys.keys?.find((item) => item.kid === header.kid && item.kty === 'RSA');
  if (!key) throw new GoogleOAuthError('Google identity signing key was not found. Please try again.');

  const signatureValid = verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: 'jwk' }),
    Buffer.from(parts[2], 'base64url'),
  );
  if (!signatureValid) throw new GoogleOAuthError('Google identity token verification failed.');

  const config = googleOAuthConfiguration();
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.iss !== 'string' || !GOOGLE_ISSUERS.has(claims.iss) ||
    !audiences.includes(config.clientId) ||
    (audiences.length > 1 && claims.azp !== config.clientId) ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    typeof claims.iat !== 'number' || claims.iat > now + 300 ||
    typeof claims.nonce !== 'string' || !equal(claims.nonce, expectedNonce) ||
    typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 ||
    typeof claims.email !== 'string' || !claims.email ||
    claims.email_verified !== true
  ) {
    throw new GoogleOAuthError('Google identity token claims could not be verified.');
  }

  return {
    subject: claims.sub,
    email: claims.email.trim().toLowerCase(),
    displayName: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 255) : null,
  };
}

export async function completeGoogleAuthorization(code: string, state: string) {
  const transaction = await consumeOAuthTransaction(state);
  const config = googleOAuthConfiguration();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: transaction.code_verifier,
    }),
  });
  const tokenResponse = await response.json().catch(() => null) as { id_token?: unknown } | null;
  if (!response.ok || !tokenResponse || typeof tokenResponse.id_token !== 'string') {
    throw new GoogleOAuthError('Google could not complete the sign-in. Please try again.');
  }

  const identity = await verifyGoogleIdentityToken(tokenResponse.id_token, transaction.nonce);
  await bindPendingAdminIdentity(identity);
  const session = await createApplicationSession(identity);
  return { session, returnTo: safeInternalAdminPath(transaction.return_to) };
}

async function bindPendingAdminIdentity(identity: GoogleIdentity) {
  const existing = await selectRows<AdminMember>('admin_members', {
    select: 'id,google_subject,email,display_name,is_active',
    google_subject: `eq.${identity.subject}`,
    is_active: 'eq.true',
  }, 'service');
  if (existing.length) return;

  const pendingCandidates = await selectRows<AdminMember>('admin_members', {
    select: 'id,google_subject,email,display_name,is_active',
    email: `ilike.${identity.email}`,
    google_subject: 'is.null',
    is_active: 'eq.true',
  }, 'service');
  const pending = pendingCandidates.find((member) => member.email.trim().toLowerCase() === identity.email);
  if (!pending) return;

  await updateRows<AdminMember>('admin_members', {
    id: `eq.${pending.id}`,
    google_subject: 'is.null',
  }, {
    google_subject: identity.subject,
    email: identity.email,
    display_name: pending.display_name ?? identity.displayName,
  }, 'service');
}

async function createApplicationSession(identity: GoogleIdentity): Promise<AppSession> {
  const rawToken = base64url(randomBytes(32));
  const expiresAt = expirationDate(SESSION_TTL_SECONDS);
  const existingToken = cookies().get(SESSION_COOKIE)?.value;
  if (existingToken) await invalidateSessionToken(existingToken);

  const rows = await insertRow<DatabaseSession>('app_sessions', {
    token_hash: digest(rawToken),
    google_subject: identity.subject,
    email: identity.email,
    display_name: identity.displayName,
    expires_at: expiresAt.toISOString(),
  }, 'service');
  const record = rows[0];
  if (!record) throw new Error('Unable to create an application session.');

  cookies().set(SESSION_COOKIE, rawToken, cookieOptions(SESSION_TTL_SECONDS));
  return { id: record.id, identity, expiresAt };
}

async function invalidateSessionToken(rawToken: string) {
  await updateRows<DatabaseSession>('app_sessions', {
    token_hash: `eq.${digest(rawToken)}`,
    invalidated_at: 'is.null',
  }, { invalidated_at: new Date().toISOString() }, 'service');
}

export async function getAppSession(): Promise<AppSession | null> {
  const rawToken = cookies().get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const rows = await selectRows<DatabaseSession>('app_sessions', {
    select: 'id,google_subject,email,display_name,expires_at,invalidated_at',
    token_hash: `eq.${digest(rawToken)}`,
  }, 'service');
  const session = rows[0];
  const expiresAt = session && parseDate(session.expires_at);
  if (!session || session.invalidated_at || !expiresAt || expiresAt <= new Date()) {
    if (session && !session.invalidated_at) await invalidateSessionToken(rawToken);
    return null;
  }

  return {
    id: session.id,
    identity: { subject: session.google_subject, email: session.email, displayName: session.display_name },
    expiresAt,
  };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getAppSession();
  if (!session) return null;
  const members = await selectRows<AdminMember>('admin_members', {
    select: 'id,google_subject,email,display_name,is_active',
    google_subject: `eq.${session.identity.subject}`,
    is_active: 'eq.true',
  }, 'service');
  const member = members[0];
  if (!member || member.google_subject !== session.identity.subject) return null;

  return {
    ...session,
    admin: { id: member.id, email: member.email, displayName: member.display_name },
  };
}

export async function requireAdminApi(): Promise<AdminSession> {
  const session = await getAppSession();
  if (!session) throw new AuthenticationError('unauthenticated');
  const adminSession = await getAdminSession();
  if (!adminSession) throw new AuthenticationError('forbidden');
  return adminSession;
}

export async function signOutCurrentSession() {
  const rawToken = cookies().get(SESSION_COOKIE)?.value;
  if (rawToken) await invalidateSessionToken(rawToken);
  cookies().set(SESSION_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new GoogleOAuthError('Cross-site requests are not allowed.');
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return Response.json({ error: error.message }, { status: error.kind === 'unauthenticated' ? 401 : 403 });
  }
  if (error instanceof GoogleOAuthError) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ error: 'Unable to verify administrator access.' }, { status: 500 });
}

export function adminApiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError || error instanceof GoogleOAuthError) return authErrorResponse(error);
  if (error instanceof DatabaseError && error.status === 409) {
    return Response.json({ error: 'A record with that URL slug or name already exists.' }, { status: 409 });
  }
  return Response.json({ error: fallback }, { status: 500 });
}

export function oauthErrorCode(error: unknown) {
  if (error instanceof GoogleOAuthError) return 'google_sign_in_failed';
  return 'server_error';
}
