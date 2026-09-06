import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { deleteRows, updateRows } from '@/lib/database';
import { Category, categoryInputSchema } from '@/lib/taxonomy';

export const runtime = 'nodejs';
const paramsSchema = z.object({ id: z.string().uuid() });

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const input = categoryInputSchema.parse(await request.json());
    const [category] = await updateRows<Category>('categories', { id: `eq.${id}` }, input, 'service');
    if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    return NextResponse.json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid category.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not update this category.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const deleted = await deleteRows<Category>('categories', { id: `eq.${id}` }, 'service');
    if (!deleted.length) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid category id.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not delete this category.');
  }
}
