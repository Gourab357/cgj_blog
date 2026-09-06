import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { AdminPostRow, adminPostSelect, postInputSchema, postPayload, toAdminPost } from '@/lib/admin-posts';
import { callRpc, insertRow, selectRows } from '@/lib/database';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdminApi();
    const posts = await selectRows<AdminPostRow>('posts', {
      select: adminPostSelect,
      order: 'updated_at.desc',
    }, 'service');
    return NextResponse.json({ posts: posts.map(toAdminPost) });
  } catch (error) {
    return adminApiErrorResponse(error, 'Could not load articles.');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const input = postInputSchema.parse(await request.json());
    const [post] = await insertRow<{ id: string }>('posts', postPayload(input, null), 'service');
    if (!post) throw new Error('The article could not be created.');
    await callRpc('replace_post_tags', { p_post_id: post.id, p_tag_ids: input.tag_ids }, 'service');
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid post data.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not save this article.');
  }
}
