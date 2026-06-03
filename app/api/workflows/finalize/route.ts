import { execFile } from 'child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowById, updateWorkflowFinalizedUrl } from '@/lib/db';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

interface FinalizeBody {
  workflowId?: number;
}

interface ProbedVideoInfo {
  audioBitrateKbps: number;
  durationSeconds: number;
  hasAudio: boolean;
  height: number;
  path: string;
  videoBitrateKbps: number;
  width: number;
  fps: number;
}

function localPublicPathFromUrl(value: string | null | undefined, allowedPrefixes: string[]) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let pathname = trimmed;
  if (!pathname.startsWith('/')) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }

  if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return join(process.cwd(), 'public', pathname.replace(/^\//, ''));
}

function parseFrameRate(value: string | null | undefined) {
  if (!value || value === '0/0') {
    return 0;
  }

  const [numerator, denominator] = value.split('/').map(Number);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function parseBitrateKbps(value: string | null | undefined) {
  const bitsPerSecond = Number(value);
  if (!Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) {
    return 0;
  }

  return Math.round(bitsPerSecond / 1000);
}

function evenDimension(value: number, fallback: number) {
  const rounded = Math.max(2, Math.round(value || fallback));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function recommendedVideoBitrateKbps(width: number, height: number) {
  const pixels = width * height;
  if (pixels <= 640 * 480) return 1800;
  if (pixels <= 1280 * 720) return 4500;
  if (pixels <= 1920 * 1080) return 8000;
  return 12000;
}

async function probeVideo(filePath: string): Promise<ProbedVideoInfo> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    filePath,
  ]);

  const data = JSON.parse(stdout) as {
    format?: { bit_rate?: string; duration?: string };
    streams?: Array<{
      avg_frame_rate?: string;
      bit_rate?: string;
      channels?: number;
      codec_type?: string;
      height?: number;
      r_frame_rate?: string;
      width?: number;
    }>;
  };

  const videoStream = data.streams?.find((stream) => stream.codec_type === 'video');
  if (!videoStream?.width || !videoStream?.height) {
    throw new Error(`Missing video stream metadata for ${basename(filePath)}.`);
  }

  const audioStream = data.streams?.find((stream) => stream.codec_type === 'audio');
  const fps = parseFrameRate(videoStream.avg_frame_rate) || parseFrameRate(videoStream.r_frame_rate) || 30;
  const videoBitrateKbps = parseBitrateKbps(videoStream.bit_rate) || parseBitrateKbps(data.format?.bit_rate);
  const audioBitrateKbps = parseBitrateKbps(audioStream?.bit_rate);
  const durationSeconds = Number(data.format?.duration);

  return {
    audioBitrateKbps,
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
    fps,
    hasAudio: Boolean(audioStream),
    height: Number(videoStream.height),
    path: filePath,
    videoBitrateKbps,
    width: Number(videoStream.width),
  };
}

async function normalizeClip(
  clip: ProbedVideoInfo,
  outputPath: string,
  target: {
    audioBitrateKbps: number;
    fps: number;
    height: number;
    videoBitrateKbps: number;
    width: number;
  },
) {
  const videoFilter = [
    `scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease`,
    `pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:black`,
    `fps=${target.fps}`,
    'format=yuv420p',
  ].join(',');

  const ffmpegArgs = clip.hasAudio
    ? [
        '-y',
        '-i', clip.path,
        '-vf', videoFilter,
        '-r', String(target.fps),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-b:v', `${target.videoBitrateKbps}k`,
        '-maxrate', `${target.videoBitrateKbps}k`,
        '-bufsize', `${target.videoBitrateKbps * 2}k`,
        '-c:a', 'aac',
        '-b:a', `${target.audioBitrateKbps}k`,
        '-ar', '48000',
        '-ac', '2',
        '-movflags', '+faststart',
        outputPath,
      ]
    : [
        '-y',
        '-i', clip.path,
        '-f', 'lavfi',
        '-t', String(clip.durationSeconds || 1),
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', videoFilter,
        '-r', String(target.fps),
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-pix_fmt', 'yuv420p',
        '-b:v', `${target.videoBitrateKbps}k`,
        '-maxrate', `${target.videoBitrateKbps}k`,
        '-bufsize', `${target.videoBitrateKbps * 2}k`,
        '-c:a', 'aac',
        '-b:a', `${target.audioBitrateKbps}k`,
        '-ar', '48000',
        '-ac', '2',
        '-shortest',
        '-movflags', '+faststart',
        outputPath,
      ];

  await execFileAsync('ffmpeg', ffmpegArgs);
}

export async function POST(req: NextRequest) {
  let normalizationDir: string | null = null;
  let concatListPath: string | null = null;

  try {
    const body = (await req.json()) as FinalizeBody;
    const workflowId = Number(body.workflowId);

    if (!Number.isFinite(workflowId) || workflowId <= 0) {
      return NextResponse.json({ error: 'Valid workflow id is required.' }, { status: 400 });
    }

    const workflow = getWorkflowById(workflowId);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }

    const clipPaths = workflow.segments
      .filter((segment) => segment.assembled_url)
      .map((segment) => localPublicPathFromUrl(segment.assembled_url, ['/generated-video-assembled/']))
      .filter((value): value is string => Boolean(value));

    if (clipPaths.length === 0) {
      return NextResponse.json({ error: 'Workflow needs assembled clips before finalize.' }, { status: 400 });
    }

    const probedClips = await Promise.all(clipPaths.map((clipPath) => probeVideo(clipPath)));
    const referenceClip = probedClips[0];
    if (!referenceClip) {
      return NextResponse.json({ error: 'Workflow needs at least one assembled clip before finalize.' }, { status: 400 });
    }

    const targetWidth = evenDimension(referenceClip.width, 1280);
    const targetHeight = evenDimension(referenceClip.height, 720);
    const targetFps = Math.max(12, Math.min(60, Math.round(referenceClip.fps || 30)));
    const targetVideoBitrateKbps = Math.max(
      recommendedVideoBitrateKbps(targetWidth, targetHeight),
      referenceClip.videoBitrateKbps || 0,
    );
    const targetAudioBitrateKbps = Math.max(128, referenceClip.audioBitrateKbps || 0);

    normalizationDir = await mkdtemp(join(tmpdir(), `workflow-finalize-${workflowId}-`));
    const normalizedClipPaths: string[] = [];

    for (let index = 0; index < probedClips.length; index += 1) {
      const clip = probedClips[index];
      const normalizedPath = join(normalizationDir, `${String(index + 1).padStart(3, '0')}.mp4`);
      await normalizeClip(clip, normalizedPath, {
        audioBitrateKbps: targetAudioBitrateKbps,
        fps: targetFps,
        height: targetHeight,
        videoBitrateKbps: targetVideoBitrateKbps,
        width: targetWidth,
      });
      normalizedClipPaths.push(normalizedPath);
    }

    const outputDir = join(process.cwd(), 'public', 'generated-video-finalized');
    await mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${timestamp}-workflow-${workflowId}.mp4`;
    const outputPath = join(outputDir, outputFilename);
    concatListPath = join(tmpdir(), `workflow-finalize-${workflowId}-${Date.now()}.txt`);

    const concatList = normalizedClipPaths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n');
    await writeFile(concatListPath, concatList, 'utf8');

    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      outputPath,
    ]);

    const metadata = {
      clipCount: clipPaths.length,
      finalizedAt: new Date().toISOString(),
      normalized: {
        audioBitrateKbps: targetAudioBitrateKbps,
        fps: targetFps,
        height: targetHeight,
        videoBitrateKbps: targetVideoBitrateKbps,
        width: targetWidth,
      },
      sourceClips: probedClips.map((clip) => ({
        audioBitrateKbps: clip.audioBitrateKbps,
        durationSeconds: clip.durationSeconds,
        filename: basename(clip.path),
        fps: clip.fps,
        hasAudio: clip.hasAudio,
        height: clip.height,
        videoBitrateKbps: clip.videoBitrateKbps,
        width: clip.width,
      })),
      workflowId,
    };
    await writeFile(outputPath.replace(/\.mp4$/i, '.json'), JSON.stringify(metadata, null, 2), 'utf8');

    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const finalizedUrl = host
      ? `${proto}://${host}/generated-video-finalized/${outputFilename}`
      : `/generated-video-finalized/${outputFilename}`;

    const previousUrl = workflow.finalized_url;
    const updatedWorkflow = updateWorkflowFinalizedUrl(workflowId, finalizedUrl);

    if (previousUrl && previousUrl !== finalizedUrl) {
      const previousPath = localPublicPathFromUrl(previousUrl, ['/generated-video-finalized/']);
      if (previousPath) {
        await rm(previousPath, { force: true }).catch(() => undefined);
        await rm(previousPath.replace(/\.mp4$/i, '.json'), { force: true }).catch(() => undefined);
      }
    }

    return NextResponse.json({ data: { workflow: updatedWorkflow, url: finalizedUrl } });
  } catch (err) {
    console.error('Failed to finalize workflow', err);
    return NextResponse.json(
      { error: 'Failed to finalize workflow.', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  } finally {
    if (normalizationDir) {
      await rm(normalizationDir, { recursive: true, force: true }).catch(() => undefined);
    }

    if (concatListPath) {
      await rm(concatListPath, { force: true }).catch(() => undefined);
    }
  }
}
