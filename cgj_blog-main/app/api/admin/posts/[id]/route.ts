import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { AdminPost, postInputSchema, postPayload } from '@/lib/admin-posts';
import { callRpc, deleteRows, selectRows, updateRows } from '@/lib/database';

export const runtime = 'nodejs';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const input = postInputSchema.parse(await request.json());
    const existing = await selectRows<Pick<AdminPost, 'published_at'>>('posts', {
      select: 'published_at',
      id: `eq.${id}`,
    }, 'service');
    if (!existing[0]) return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
    const [post] = await updateRows<AdminPost>('posts', { id: `eq.${id}` }, postPayload(input, existing[0].published_at), 'service');
    if (!post) return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
    await callRpc('replace_post_tags', { p_post_id: id, p_tag_ids: input.tag_ids }, 'service');
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid post data.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not update this article.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const deleted = await deleteRows<AdminPost>('posts', { id: `eq.${id}` }, 'service');
    if (!deleted.length) return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid article id.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not delete this article.');
  }
}
