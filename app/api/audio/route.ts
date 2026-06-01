import { NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

interface GeneratedAudioClip {
  createdAt: string;
  filename: string;
  promptPreview?: string | null;
  url: string;
  voiceId?: string | null;
  voiceName?: string | null;
}

interface GeneratedAudioMetadata {
  createdAt: string;
  promptPreview: string;
  voiceId: string;
  voiceName: string | null;
}

export async function GET() {
  const generatedDir = join(process.cwd(), 'public', 'generated-audio');

  try {
    const files = (await readdir(generatedDir)).filter((filename) => filename.toLowerCase().endsWith('.wav'));
    const clips = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(generatedDir, filename);
        const fileStat = await stat(filePath);
        let metadata: GeneratedAudioMetadata | null = null;

        try {
          const metadataFile = join(generatedDir, `${filename.replace(/\.wav$/i, '')}.json`);
          metadata = JSON.parse(await readFile(metadataFile, 'utf8')) as GeneratedAudioMetadata;
        } catch {
          metadata = null;
        }

        return {
          createdAt: metadata?.createdAt || fileStat.mtime.toISOString(),
          filename,
          promptPreview: metadata?.promptPreview ?? null,
          url: `/generated-audio/${filename}`,
          voiceId: metadata?.voiceId ?? null,
          voiceName: metadata?.voiceName ?? null,
        } satisfies GeneratedAudioClip;
      }),
    );

    clips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ generated: clips });
  } catch {
    return NextResponse.json({ generated: [] });
  }
}
