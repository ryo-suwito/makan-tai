import { Buffer } from 'buffer';
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import {
  buildFalVideoPayload,
  DEFAULT_FAL_VIDEO_ASPECT_RATIO,
  DEFAULT_FAL_VIDEO_DURATION,
  DEFAULT_FAL_VIDEO_MODEL,
  DEFAULT_FAL_VIDEO_RESOLUTION,
  isFalVideoModel,
  type FalVideoAspectRatio,
  type FalVideoDuration,
  type FalVideoModel,
  type FalVideoResolution,
} from '@/lib/fal-video-models';

export const runtime = 'nodejs';

interface GenerateFalVideoBody {
  aspectRatio?: FalVideoAspectRatio;
  duration?: FalVideoDuration;
  imageUrl?: string;
  model?: FalVideoModel;
  prompt?: string;
  resolution?: FalVideoResolution;
}

interface GeneratedVideoMetadata {
  aspectRatio: FalVideoAspectRatio;
  createdAt: string;
  duration: FalVideoDuration;
  model: FalVideoModel;
  promptPreview: string;
  resolution: FalVideoResolution;
  sourceUrl: string;
}

interface GeneratedVideoClip {
  aspectRatio?: FalVideoAspectRatio | null;
  createdAt?: string | null;
  duration?: FalVideoDuration | null;
  filename: string;
  model?: FalVideoModel | null;
  promptPreview?: string | null;
  resolution?: FalVideoResolution | null;
  url: string;
}

function buildAbsoluteGeneratedVideoUrl(req: NextRequest, filename: string) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}/generated-video/${filename}` : `/generated-video/${filename}`;
}

function slugify(value: string) {
  const trimmed = value.trim().toLowerCase();
  const collapsed = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return collapsed || 'fal-video';
}

function createPromptPreview(value: string, maxLength = 56) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function mimeTypeFromExtension(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/png';
}

async function fetchImageSourceAsDataUrl(source: string): Promise<string> {
  const trimmedSource = source.trim();
  const dataUrlMatch = trimmedSource.match(/^data:(.+?);base64,(.+)$/);

  if (dataUrlMatch) {
    return trimmedSource;
  }

  const localPath = (() => {
    if (
      trimmedSource.startsWith('/uploads/')
      || trimmedSource.startsWith('/generated/')
      || trimmedSource.startsWith('/generated-video/')
    ) {
      return join(process.cwd(), 'public', trimmedSource.replace(/^\//, ''));
    }

    try {
      const parsed = new URL(trimmedSource);
      if (
        parsed.pathname.startsWith('/uploads/')
        || parsed.pathname.startsWith('/generated/')
        || parsed.pathname.startsWith('/generated-video/')
      ) {
        return join(process.cwd(), 'public', parsed.pathname.replace(/^\//, ''));
      }
    } catch {
      // Fall back to network fetch below.
    }

    return null;
  })();

  if (localPath) {
    const buffer = await readFile(localPath);
    return `data:${mimeTypeFromExtension(localPath)};base64,${buffer.toString('base64')}`;
  }

  const response = await fetch(trimmedSource);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow start image: ${response.status} ${response.statusText}`);
  }

  const mimeType = response.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function persistFalVideo(
  req: NextRequest,
  videoUrl: string,
  metadata: GeneratedVideoMetadata,
) {
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download Fal video: ${videoResponse.status} ${videoResponse.statusText}`);
  }

  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  const generatedDir = join(process.cwd(), 'public', 'generated-video');
  await mkdir(generatedDir, { recursive: true });

  const timestamp = metadata.createdAt.replace(/[:.]/g, '-');
  const fileStem = slugify(metadata.promptPreview);
  const filename = `${timestamp}-${fileStem}.mp4`;
  await writeFile(join(generatedDir, filename), buffer);
  await writeFile(
    join(generatedDir, filename.replace(/\.mp4$/i, '.json')),
    JSON.stringify(metadata, null, 2),
    'utf8',
  );

  return {
    filename,
    url: buildAbsoluteGeneratedVideoUrl(req, filename),
  };
}

export async function GET() {
  const generatedDir = join(process.cwd(), 'public', 'generated-video');

  try {
    const files = (await readdir(generatedDir)).filter((filename) => filename.toLowerCase().endsWith('.mp4'));
    const clips = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(generatedDir, filename);
        const fileStat = await stat(filePath);
        let metadata: GeneratedVideoMetadata | null = null;

        try {
          const metadataFile = join(generatedDir, `${filename.replace(/\.mp4$/i, '')}.json`);
          metadata = JSON.parse(await readFile(metadataFile, 'utf8')) as GeneratedVideoMetadata;
        } catch {
          metadata = null;
        }

        return {
          aspectRatio: metadata?.aspectRatio ?? null,
          createdAt: metadata?.createdAt || fileStat.mtime.toISOString(),
          duration: metadata?.duration ?? null,
          filename,
          model: metadata?.model ?? null,
          promptPreview: metadata?.promptPreview ?? null,
          resolution: metadata?.resolution ?? null,
          url: `/generated-video/${filename}`,
        } satisfies GeneratedVideoClip;
      }),
    );

    clips.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ generated: clips });
  } catch {
    return NextResponse.json({ generated: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateFalVideoBody;
    const prompt = body.prompt?.trim() || '';
    const imageUrl = body.imageUrl?.trim() || '';
    const model = body.model && isFalVideoModel(body.model) ? body.model : DEFAULT_FAL_VIDEO_MODEL;
    const duration = body.duration ?? DEFAULT_FAL_VIDEO_DURATION;
    const resolution = body.resolution ?? DEFAULT_FAL_VIDEO_RESOLUTION;
    const aspectRatio = body.aspectRatio ?? DEFAULT_FAL_VIDEO_ASPECT_RATIO;

    if (!prompt) {
      return NextResponse.json({ error: 'Video prompt is required.' }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required for image-to-video generation.' }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json({ error: 'Missing FAL_KEY' }, { status: 500 });
    }

    const normalizedImageUrl = await fetchImageSourceAsDataUrl(imageUrl);
    const { endpoint, payload } = buildFalVideoPayload({
      prompt,
      imageUrl: normalizedImageUrl,
      model,
      duration,
      resolution,
      aspectRatio,
    });

    const response = await axios.post(`https://fal.run/${endpoint}`, payload, {
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 1000 * 60 * 10,
    });

    const videoUrl = response.data?.video?.url;
    if (typeof videoUrl !== 'string' || !videoUrl) {
      return NextResponse.json({ error: 'Fal did not return a video URL.', details: response.data }, { status: 502 });
    }

    const createdAt = new Date().toISOString();
    const promptPreview = createPromptPreview(prompt);
    const persisted = await persistFalVideo(req, videoUrl, {
      aspectRatio,
      createdAt,
      duration,
      model,
      promptPreview,
      resolution,
      sourceUrl: videoUrl,
    });

    return NextResponse.json({
      data: {
        ...persisted,
        createdAt,
        promptPreview,
        model,
        duration,
        resolution,
        aspectRatio,
      },
    });
  } catch (err) {
    console.error('Fal video generation failed', err);
    return NextResponse.json(
      {
        error: 'Failed to generate Fal video.',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
