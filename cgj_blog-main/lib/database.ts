import 'server-only';

export type DatabaseRole = 'anon' | 'service';

export class DatabaseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DatabaseError';
  }
}

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

function databaseUrl() {
  return environment('SUPABASE_URL').replace(/\/$/, '');
}

function databaseKey(role: DatabaseRole) {
  return role === 'service' ? environment('SUPABASE_SERVICE_ROLE_KEY') : environment('SUPABASE_ANON_KEY');
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function supabaseRequest<T>(
  path: string,
  role: DatabaseRole,
  init: RequestInit = {},
): Promise<T> {
  const key = databaseKey(role);
  const response = await fetch(`${databaseUrl()}/${path.replace(/^\//, '')}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...init.headers,
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String(body.message)
      : `Supabase request failed with status ${response.status}`;
    throw new DatabaseError(message, response.status);
  }

  return body as T;
}

export async function selectRows<T>(
  table: string,
  query: Record<string, string>,
  role: DatabaseRole,
): Promise<T[]> {
  const params = new URLSearchParams(query);
  return supabaseRequest<T[]>(`rest/v1/${encodeURIComponent(table)}?${params.toString()}`, role, {
    headers: { Accept: 'application/json' },
  });
}

export async function insertRow<T>(table: string, value: unknown, role: DatabaseRole): Promise<T[]> {
  return supabaseRequest<T[]>(`rest/v1/${encodeURIComponent(table)}`, role, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(value),
  });
}

export async function updateRows<T>(
  table: string,
  query: Record<string, string>,
  value: unknown,
  role: DatabaseRole,
): Promise<T[]> {
  const params = new URLSearchParams(query);
  return supabaseRequest<T[]>(`rest/v1/${encodeURIComponent(table)}?${params.toString()}`, role, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(value),
  });
}

export async function deleteRows<T>(
  table: string,
  query: Record<string, string>,
  role: DatabaseRole,
): Promise<T[]> {
  const params = new URLSearchParams(query);
  return supabaseRequest<T[]>(`rest/v1/${encodeURIComponent(table)}?${params.toString()}`, role, {
    method: 'DELETE',
    headers: { Prefer: 'return=representation' },
  });
}

export async function callRpc<T>(name: string, arguments_: unknown, role: DatabaseRole): Promise<T> {
  return supabaseRequest<T>(`rest/v1/rpc/${encodeURIComponent(name)}`, role, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arguments_),
  });
}

export async function uploadPublicMedia(path: string, bytes: Buffer, contentType: string) {
  await supabaseRequest<unknown>(`storage/v1/object/cgj-media/${encodePath(path)}`, 'service', {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    body: bytes,
  });
  return `${databaseUrl()}/storage/v1/object/public/cgj-media/${encodePath(path)}`;
}

export async function deletePublicMedia(path: string) {
  await supabaseRequest<unknown>(`storage/v1/object/cgj-media/${encodePath(path)}`, 'service', {
    method: 'DELETE',
  });
}
