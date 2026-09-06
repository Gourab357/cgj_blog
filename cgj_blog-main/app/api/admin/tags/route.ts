import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { insertRow } from '@/lib/database';
import { Tag, tagInputSchema } from '@/lib/taxonomy';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const input = tagInputSchema.parse(await request.json());
    const [tag] = await insertRow<Tag>('tags', input, 'service');
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid tag.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not save this tag.');
  }
}
