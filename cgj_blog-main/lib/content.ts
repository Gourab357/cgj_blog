import 'server-only';

import { selectRows } from '@/lib/database';

export type PublicTaxonomy = { id: string; name: string; slug: string };

export type PublicPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  featured: boolean;
  published_at: string | null;
  updated_at: string;
  category: PublicTaxonomy | null;
  tags: PublicTaxonomy[];
};

type PublicPostRow = Omit<PublicPost, 'category' | 'tags'> & {
  category: PublicTaxonomy | null;
  post_tags: Array<{ tags: PublicTaxonomy | null }> | null;
};

const publicPostSelect = 'id,title,slug,excerpt,content,cover_image_url,cover_image_alt,featured,published_at,updated_at,category:categories(id,name,slug),post_tags(tags(id,name,slug))';

function toPublicPost(row: PublicPostRow): PublicPost {
  return {
    ...row,
    category: row.category ?? null,
    tags: (row.post_tags ?? []).flatMap((link) => link.tags ? [link.tags] : []),
  };
}

export async function listPublicPosts() {
  const rows = await selectRows<PublicPostRow>('posts', {
    select: publicPostSelect,
    status: 'eq.published',
    published_at: 'lte.now()',
    order: 'published_at.desc',
    limit: '100',
  }, 'anon');
  return rows.map(toPublicPost);
}

export async function getPublicPost(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const rows = await selectRows<PublicPostRow>('posts', {
    select: publicPostSelect,
    slug: `eq.${slug}`,
    status: 'eq.published',
    published_at: 'lte.now()',
    limit: '1',
  }, 'anon');
  return rows[0] ? toPublicPost(rows[0]) : null;
}

export async function listPublicTaxonomy() {
  const [categories, tags] = await Promise.all([
    selectRows<PublicTaxonomy>('categories', { select: 'id,name,slug', order: 'name.asc' }, 'anon'),
    selectRows<PublicTaxonomy>('tags', { select: 'id,name,slug', order: 'name.asc' }, 'anon'),
  ]);
  return { categories, tags };
}
