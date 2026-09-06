import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { deletePublicMedia, deleteRows, selectRows, updateRows } from '@/lib/database';
import { MediaAsset } from '@/lib/media';

export const runtime = 'nodejs';
const paramsSchema = z.object({ id: z.string().uuid() });
const updateSchema = z.object({ alt_text: z.string().trim().max(500).transform((value) => value || null) });

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const input = updateSchema.parse(await request.json());
    const [media] = await updateRows<MediaAsset>('media_assets', { id: `eq.${id}` }, input, 'service');
    if (!media) return NextResponse.json({ error: 'Media item not found.' }, { status: 404 });
    return NextResponse.json({ media });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid image description.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not update this media item.');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const { id } = paramsSchema.parse(params);
    const media = await selectRows<MediaAsset>('media_assets', {
      select: 'id,path,public_url,alt_text,content_type,byte_size,created_at',
      id: `eq.${id}`,
    }, 'service');
    const asset = media[0];
    if (!asset) return NextResponse.json({ error: 'Media item not found.' }, { status: 404 });
    const references = await selectRows<{ id: string }>('posts', { select: 'id', cover_image_url: `eq.${asset.public_url}`, limit: '1' }, 'service');
    if (references.length) return NextResponse.json({ error: 'This image is still used by an article. Replace the article image before deleting it.' }, { status: 409 });
    await deletePublicMedia(asset.path);
    await deleteRows<MediaAsset>('media_assets', { id: `eq.${id}` }, 'service');
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid media id.' }, { status: 422 });
    return adminApiErrorResponse(error, 'Could not delete this media item.');
  }
}
