import { NextRequest, NextResponse } from 'next/server';
import { completeGoogleAuthorization, oauthErrorCode } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const googleError = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (googleError || !code || !state) {
    const url = new URL('/admin/login', request.url);
    url.searchParams.set('error', googleError ? 'google_cancelled' : 'invalid_callback');
    return NextResponse.redirect(url);
  }

  try {
    const { returnTo } = await completeGoogleAuthorization(code, state);
    return NextResponse.redirect(new URL(returnTo, request.url));
  } catch (error) {
    const url = new URL('/admin/login', request.url);
    url.searchParams.set('error', oauthErrorCode(error));
    return NextResponse.redirect(url);
  }
}
