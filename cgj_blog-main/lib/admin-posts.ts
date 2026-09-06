import 'server-only';

import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
const nullableUuid = z.string().uuid().nullable();

export type TaxonomyItem = { id: string; name: string; slug: string };

export const postInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.').max(240),
  excerpt: optionalText(1_000),
  content: z.string().trim().min(1).max(100_000),
  cover_image_url: optionalText(2_048).refine((value) => !value || /^https?:\/\//.test(value), 'Cover image URL must use http or https.'),
  cover_image_alt: optionalText(500),
  category_id: nullableUuid,
  tag_ids: z.array(z.string().uuid()).max(20).refine((ids) => new Set(ids).size === ids.length, 'Tags must be unique.'),
  status: z.enum(['draft', 'published']),
  featured: z.boolean(),
});

export type PostInput = z.infer<typeof postInputSchema>;

export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  status: 'draft' | 'published';
  featured: boolean;
  published_at: string | null;
  updated_at: string;
  category: TaxonomyItem | null;
  tags: TaxonomyItem[];
};

export type AdminPostRow = Omit<AdminPost, 'category' | 'tags'> & {
  category: TaxonomyItem | null;
  post_tags: Array<{ tags: TaxonomyItem | null }> | null;
};

export const adminPostSelect = 'id,title,slug,excerpt,content,cover_image_url,cover_image_alt,status,featured,published_at,updated_at,category:categories(id,name,slug),post_tags(tags(id,name,slug))';

export function postPayload(input: PostInput, publishedAt: string | null) {
  const { tag_ids: _tagIds, ...post } = input;
  return { ...post, published_at: input.status === 'published' ? publishedAt ?? new Date().toISOString() : null };
}

export function toAdminPost(row: AdminPostRow): AdminPost {
  return {
    ...row,
    category: row.category ?? null,
    tags: (row.post_tags ?? []).flatMap((link) => link.tags ? [link.tags] : []),
  };
}
