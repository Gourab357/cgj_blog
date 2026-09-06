import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin, authErrorResponse, signOutCurrentSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await signOutCurrentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
