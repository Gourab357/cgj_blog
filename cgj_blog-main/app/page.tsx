import { HomeClient } from '@/components/HomeClient';
import { listPublicPosts, listPublicTaxonomy } from '@/lib/content';

export const dynamic = 'force-dynamic';

function validSlug(value: string | undefined) {
  return value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : null;
}

export default async function Home({ searchParams }: { searchParams: { category?: string; tag?: string } }) {
  try {
    const [posts, taxonomy] = await Promise.all([listPublicPosts(), listPublicTaxonomy()]);
    return <HomeClient initialPosts={posts} initialCategories={taxonomy.categories} initialTags={taxonomy.tags} initialCategory={validSlug(searchParams.category)} initialTag={validSlug(searchParams.tag)} />;
  } catch {
    return <HomeClient initialPosts={[]} initialCategories={[]} initialTags={[]} initialError="The journal is temporarily unavailable. Please try again shortly." initialCategory={null} initialTag={null} />;
  }
}
