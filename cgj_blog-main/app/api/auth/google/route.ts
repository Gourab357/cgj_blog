import { NextRequest, NextResponse } from 'next/server';
import { createGoogleAuthorizationUrl } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authorizationUrl = await createGoogleAuthorizationUrl(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(authorizationUrl);
  } catch {
    const url = new URL('/admin/login', request.url);
    url.searchParams.set('error', 'configuration');
    return NextResponse.redirect(url);
  }
}
