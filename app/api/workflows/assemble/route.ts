import { execFile } from 'child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

interface AssembleBody {
  segmentId?: number;
  srt?: string | null;
  videoNoSound?: boolean;
  videoUrl?: string | null;
  voiceUrl?: string | null;
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

async function getMediaDurationSeconds(filePath: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

async function hasAudioStream(videoPath: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a',
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    videoPath,
  ]);
  return Boolean(stdout.trim());
}

function escapeSubtitlesPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export async function POST(req: NextRequest) {
  let tempDir: string | null = null;

  try {
    const body = (await req.json()) as AssembleBody;
    const srt = body.srt?.trim() || '';
    const videoPath = localPublicPathFromUrl(body.videoUrl, ['/generated-video/']);
    const voicePath = localPublicPathFromUrl(body.voiceUrl, ['/generated-audio/']);
    const videoNoSound = Boolean(body.videoNoSound);

    if (!videoPath || !voicePath) {
      return NextResponse.json({ error: 'Workflow assemble requires local video and voice assets.' }, { status: 400 });
    }

    if (!srt) {
      return NextResponse.json({ error: 'Workflow assemble requires SRT captions.' }, { status: 400 });
    }

    tempDir = await mkdtemp(join(tmpdir(), 'workflow-assemble-'));
    const subtitlePath = join(tempDir, 'captions.srt');
    await writeFile(subtitlePath, srt, 'utf8');

    const outputDir = join(process.cwd(), 'public', 'generated-video-assembled');
    await mkdir(outputDir, { recursive: true });

    const videoHasAudio = await hasAudioStream(videoPath);
    const videoDuration = await getMediaDurationSeconds(videoPath);
    const voiceDuration = await getMediaDurationSeconds(voicePath);

    if (!videoDuration || !voiceDuration) {
      return NextResponse.json({ error: 'Could not read workflow media duration.' }, { status: 400 });
    }

    const speedFactor = Math.max(0.05, voiceDuration / videoDuration);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${timestamp}-${body.segmentId || 'segment'}.mp4`;
    const outputPath = join(outputDir, outputFilename);
    const subtitleFilter = `subtitles='${escapeSubtitlesPath(subtitlePath)}'`;
    const videoFilter = `setpts=${speedFactor.toFixed(6)}*PTS,${subtitleFilter}`;

    const ffmpegArgs = videoHasAudio
      ? [
          '-y',
          '-i', videoPath,
          '-i', voicePath,
          '-filter_complex',
          `[0:v]${videoFilter}[vout];[0:a]volume=${videoNoSound ? '0.0' : '0.4'}[bg];[1:a]volume=1.0[voice];[voice][bg]amix=inputs=2:duration=first:normalize=0[aout]`,
          '-map', '[vout]',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '22',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputPath,
        ]
      : [
          '-y',
          '-i', videoPath,
          '-i', voicePath,
          '-filter_complex',
          `[0:v]${videoFilter}[vout];[1:a]volume=1.0[aout]`,
          '-map', '[vout]',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '22',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          outputPath,
        ];

    await execFileAsync('ffmpeg', ffmpegArgs);

    const metadata = {
      assembledAt: new Date().toISOString(),
      originalVideoDuration: videoDuration,
      sourceVideo: basename(videoPath),
      sourceVoice: basename(voicePath),
      videoNoSound,
      videoSpeedFactor: speedFactor,
      videoVolume: videoNoSound ? 0 : 0.4,
      voiceDuration,
    };
    await writeFile(outputPath.replace(/\.mp4$/i, '.json'), JSON.stringify(metadata, null, 2), 'utf8');

    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const url = host ? `${proto}://${host}/generated-video-assembled/${outputFilename}` : `/generated-video-assembled/${outputFilename}`;

    return NextResponse.json({ data: { url } });
  } catch (err) {
    console.error('Failed to assemble workflow segment', err);
    return NextResponse.json(
      { error: 'Failed to assemble workflow segment.', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
