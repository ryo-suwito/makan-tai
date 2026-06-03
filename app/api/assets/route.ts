import { unlink } from 'fs/promises';
import { join, normalize } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface DeleteAssetBody {
  url?: string;
}

const DELETABLE_PREFIXES = [
  '/generated/',
  '/generated-audio/',
  '/generated-video/',
  '/generated-video-assembled/',
  '/generated-video-finalized/',
];

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as DeleteAssetBody;
    const pathname = extractPathname(body.url);

    if (!pathname || !DELETABLE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.json({ success: true, deleted: false });
    }

    const publicDir = join(process.cwd(), 'public');
    const filePath = normalize(join(publicDir, pathname.replace(/^\//, '')));

    if (!filePath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid asset path.' }, { status: 400 });
    }

    await unlink(filePath).catch(() => undefined);

    if (pathname.startsWith('/generated-audio/') && pathname.toLowerCase().endsWith('.wav')) {
      const metadataPath = filePath.replace(/\.wav$/i, '.json');
      await unlink(metadataPath).catch(() => undefined);
    }

    if (pathname.startsWith('/generated-video/') && pathname.toLowerCase().endsWith('.mp4')) {
      const metadataPath = filePath.replace(/\.mp4$/i, '.json');
      await unlink(metadataPath).catch(() => undefined);
    }

    if (pathname.startsWith('/generated-video-assembled/') && pathname.toLowerCase().endsWith('.mp4')) {
      const metadataPath = filePath.replace(/\.mp4$/i, '.json');
      await unlink(metadataPath).catch(() => undefined);
    }

    if (pathname.startsWith('/generated-video-finalized/') && pathname.toLowerCase().endsWith('.mp4')) {
      const metadataPath = filePath.replace(/\.mp4$/i, '.json');
      await unlink(metadataPath).catch(() => undefined);
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    console.error('Failed to delete asset', err);
    return NextResponse.json({ error: 'Failed to delete asset.' }, { status: 500 });
  }
}

function extractPathname(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    return new URL(trimmed).pathname;
  } catch {
    return null;
  }
}
