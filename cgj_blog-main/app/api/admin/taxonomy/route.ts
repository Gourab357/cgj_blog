import { NextResponse } from 'next/server';
import { adminApiErrorResponse, requireAdminApi } from '@/lib/auth';
import { selectRows } from '@/lib/database';
import { Category, Tag } from '@/lib/taxonomy';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdminApi();
    const [categories, tags] = await Promise.all([
      selectRows<Category>('categories', { select: 'id,name,slug,description', order: 'name.asc' }, 'service'),
      selectRows<Tag>('tags', { select: 'id,name,slug', order: 'name.asc' }, 'service'),
    ]);
    return NextResponse.json({ categories, tags });
  } catch (error) {
    return adminApiErrorResponse(error, 'Could not load categories and tags.');
  }
}
