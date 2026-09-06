import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listPublicPosts, listPublicTaxonomy } from '@/lib/content';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
  category: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  tag: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
    category: request.nextUrl.searchParams.get('category') ?? undefined,
    tag: request.nextUrl.searchParams.get('tag') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid journal filter.' }, { status: 422 });

  try {
    const [allPosts, taxonomy] = await Promise.all([listPublicPosts(), listPublicTaxonomy()]);
    const query = parsed.data.q.toLocaleLowerCase();
    const posts = allPosts.filter((post) => {
      const text = `${post.title} ${post.excerpt ?? ''} ${post.content} ${post.category?.name ?? ''} ${post.tags.map((tag) => tag.name).join(' ')}`.toLocaleLowerCase();
      return (!query || text.includes(query)) &&
        (!parsed.data.category || post.category?.slug === parsed.data.category) &&
        (!parsed.data.tag || post.tags.some((tag) => tag.slug === parsed.data.tag));
    });
    return NextResponse.json({ posts, ...taxonomy });
  } catch {
    return NextResponse.json({ error: 'The journal is temporarily unavailable.' }, { status: 503 });
  }
}
