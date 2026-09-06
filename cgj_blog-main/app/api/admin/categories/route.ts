import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { insertRow } from '@/lib/database';
import { Category, categoryInputSchema } from '@/lib/taxonomy';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const input = categoryInputSchema.parse(await request.json());
    const [category] = await insertRow<Category>('categories', input, 'service');
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid category.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not save this category.');
  }
}
