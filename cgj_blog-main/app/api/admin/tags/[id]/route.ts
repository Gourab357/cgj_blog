import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { deleteRows, updateRows } from '@/lib/database';
import { Tag, tagInputSchema } from '@/lib/taxonomy';

export const runtime = 'nodejs';
const paramsSchema = z.object({ id: z.string().uuid() });

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const input = tagInputSchema.parse(await request.json());
    const [tag] = await updateRows<Tag>('tags', { id: `eq.${id}` }, input, 'service');
    if (!tag) return NextResponse.json({ error: 'Tag not found.' }, { status: 404 });
    return NextResponse.json({ tag });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid tag.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not update this tag.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const deleted = await deleteRows<Tag>('tags', { id: `eq.${id}` }, 'service');
    if (!deleted.length) return NextResponse.json({ error: 'Tag not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid tag id.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not delete this tag.');
  }
}
