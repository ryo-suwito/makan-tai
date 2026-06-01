import Cartesia from '@cartesia/cartesia-js';
import { Buffer } from 'buffer';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface GenerateAudioBody {
  prompt: string;
  voiceId: string;
  voiceName?: string | null;
}

interface GeneratedAudioMetadata {
  createdAt: string;
  promptPreview: string;
  voiceId: string;
  voiceName: string | null;
}

function slugify(value: string) {
  const trimmed = value.trim().toLowerCase();
  const collapsed = trimmed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return collapsed || 'voice-render';
}

function createPromptPreview(value: string, maxLength = 56) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as GenerateAudioBody;
    const prompt = body.prompt?.trim();
    const voiceId = body.voiceId?.trim();

    if (!prompt || !voiceId) {
      return NextResponse.json({ error: 'Missing prompt or voiceId' }, { status: 400 });
    }

    const client = new Cartesia({ apiKey });
    const response = await client.tts.generate({
      model_id: 'sonic-3.5',
      transcript: prompt,
      voice: { mode: 'id', id: voiceId },
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le',
        sample_rate: 44100,
      },
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const generatedDir = join(process.cwd(), 'public', 'generated-audio');
    await mkdir(generatedDir, { recursive: true });

    const createdAt = new Date().toISOString();
    const promptPreview = createPromptPreview(prompt);
    const timestamp = createdAt.replace(/[:.]/g, '-');
    const fileStem = slugify(promptPreview);
    const filename = `${timestamp}-${fileStem}.wav`;
    await writeFile(join(generatedDir, filename), buffer);
    const metadata: GeneratedAudioMetadata = {
      createdAt,
      promptPreview,
      voiceId,
      voiceName: body.voiceName ?? null,
    };
    await writeFile(
      join(generatedDir, `${filename.replace(/\.wav$/i, '')}.json`),
      JSON.stringify(metadata, null, 2),
      'utf8',
    );

    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const url = host ? `${proto}://${host}/generated-audio/${filename}` : `/generated-audio/${filename}`;

    return NextResponse.json({
      data: {
        url,
        filename,
        voiceId,
        voiceName: body.voiceName ?? null,
        promptPreview,
        createdAt,
      },
    });
  } catch (err: any) {
    console.error('Failed to generate Cartesia audio', err);
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details: err?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
