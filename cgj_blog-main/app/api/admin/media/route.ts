import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminApiErrorResponse, assertSameOrigin, requireAdminApi } from '@/lib/auth';
import { deletePublicMedia, insertRow, selectRows, uploadPublicMedia } from '@/lib/database';
import { MediaAsset } from '@/lib/media';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function safeFileName(name: string) {
  const extension = name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/)?.[0] ?? '';
  const base = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'image';
  return `${base}${extension}`;
}

function hasValidImageSignature(bytes: Buffer, type: string) {
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/gif') return bytes.length > 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a');
  return type === 'image/webp' && bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
}

export async function GET() {
  try {
    await requireAdminApi();
    const media = await selectRows<MediaAsset>('media_assets', {
      select: 'id,path,public_url,alt_text,content_type,byte_size,created_at',
      order: 'created_at.desc',
      limit: '100',
    }, 'service');
    return NextResponse.json({ media });
  } catch (error) {
    return adminApiErrorResponse(error, 'Could not load the media library.');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireAdminApi();
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Upload a PNG, JPG, WebP, or GIF image no larger than 5 MB.' }, { status: 422 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(bytes, file.type)) return NextResponse.json({ error: 'The uploaded file does not match its claimed image type.' }, { status: 422 });
    const path = `media/${randomUUID()}-${safeFileName(file.name)}`;
    let url: string | null = null;
    try {
      url = await uploadPublicMedia(path, bytes, file.type);
      const [media] = await insertRow<MediaAsset>('media_assets', {
        path,
        public_url: url,
        alt_text: file.name.replace(/\.[^.]+$/, '').slice(0, 500) || null,
        content_type: file.type,
        byte_size: file.size,
      }, 'service');
      return NextResponse.json({ media }, { status: 201 });
    } catch (error) {
      if (url) await deletePublicMedia(path).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return adminApiErrorResponse(error, 'Could not upload this image.');
  }
}
