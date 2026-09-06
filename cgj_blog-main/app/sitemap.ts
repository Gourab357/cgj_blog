import type { MetadataRoute } from 'next';
import { listPublicPosts } from '@/lib/content';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://cgj-nusrl.vercel.app';
  const posts = await listPublicPosts().catch(() => []);
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/publications`, lastModified: new Date() },
    ...posts.map((post) => ({ url: `${base}/post/${post.slug}`, lastModified: new Date(post.updated_at) })),
  ];
}
