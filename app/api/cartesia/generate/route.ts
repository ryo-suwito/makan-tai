import { Buffer } from 'buffer';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CARTESIA_VERSION = '2026-03-01';
const SAMPLE_RATE = 44100;

interface GenerateAudioBody {
  prompt: string;
  voiceId: string;
  voiceName?: string | null;
}

interface GeneratedAudioMetadata {
  createdAt: string;
  promptPreview: string;
  srt: string | null;
  voiceId: string;
  voiceName: string | null;
}

interface CartesiaSseEvent {
  data?: string;
  message?: string;
  title?: string;
  type?: string;
  word_timestamps?: {
    end?: number[];
    start?: number[];
    words?: string[];
  };
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
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function createWavHeader(dataLength: number, sampleRate: number) {
  const channelCount = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channelCount * bitsPerSample / 8;
  const blockAlign = channelCount * bitsPerSample / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channelCount, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

function formatSrtTimestamp(seconds: number) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(secs).padStart(2, '0'),
  ].join(':') + `,${String(milliseconds).padStart(3, '0')}`;
}

function buildSrt(words: string[], starts: number[], ends: number[]) {
  if (words.length === 0 || starts.length === 0 || ends.length === 0) {
    return null;
  }

  const captions: string[] = [];
  let captionIndex = 1;
  let currentWords: string[] = [];
  let currentStart = 0;
  let currentEnd = 0;

  const flushCaption = () => {
    if (currentWords.length === 0) {
      return;
    }

    captions.push([
      String(captionIndex),
      `${formatSrtTimestamp(currentStart)} --> ${formatSrtTimestamp(currentEnd)}`,
      currentWords.join(' '),
    ].join('\n'));
    captionIndex += 1;
    currentWords = [];
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]?.trim();
    const start = starts[index];
    const end = ends[index];

    if (!word || !Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    if (currentWords.length === 0) {
      currentWords.push(word);
      currentStart = start;
      currentEnd = end;
      continue;
    }

    const nextText = `${currentWords.join(' ')} ${word}`;
    const gap = start - currentEnd;
    const duration = end - currentStart;
    const shouldFlush =
      currentWords.length >= 8 ||
      nextText.length > 48 ||
      gap > 0.65 ||
      duration > 3.5;

    if (shouldFlush) {
      flushCaption();
      currentWords.push(word);
      currentStart = start;
      currentEnd = end;
      continue;
    }

    currentWords.push(word);
    currentEnd = end;
  }

  flushCaption();
  return captions.length > 0 ? `${captions.join('\n\n')}\n` : null;
}

async function generateCartesiaAudioWithTimestamps(input: { apiKey: string; prompt: string; voiceId: string }) {
  const response = await fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cartesia-Version': CARTESIA_VERSION,
      'X-API-Key': input.apiKey,
    },
    body: JSON.stringify({
      model_id: 'sonic-3.5',
      transcript: input.prompt,
      voice: { mode: 'id', id: input.voiceId },
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
        sample_rate: SAMPLE_RATE,
      },
      add_timestamps: true,
      use_normalized_timestamps: true,
    }),
  });

  if (!response.ok || !response.body) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Cartesia SSE request failed with status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const audioChunks: Buffer[] = [];
  const words: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let buffered = '';

  const handlePayload = (payload: string) => {
    if (!payload.trim()) {
      return;
    }

    const event = JSON.parse(payload) as CartesiaSseEvent;

    if (event.type === 'chunk' && typeof event.data === 'string') {
      audioChunks.push(Buffer.from(event.data, 'base64'));
      return;
    }

    if (event.type === 'timestamps' && event.word_timestamps) {
      words.push(...(event.word_timestamps.words ?? []));
      starts.push(...(event.word_timestamps.start ?? []));
      ends.push(...(event.word_timestamps.end ?? []));
      return;
    }

    if (event.type === 'error') {
      throw new Error(event.message || event.title || 'Cartesia SSE returned an error.');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorIndex = buffered.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const eventBlock = buffered.slice(0, separatorIndex);
      buffered = buffered.slice(separatorIndex + 2);
      const payload = eventBlock
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');

      if (payload) {
        handlePayload(payload);
      }

      separatorIndex = buffered.indexOf('\n\n');
    }

    if (done) {
      break;
    }
  }

  if (buffered.trim()) {
    const payload = buffered
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (payload) {
      handlePayload(payload);
    }
  }

  const pcmBuffer = Buffer.concat(audioChunks);
  const wavBuffer = Buffer.concat([createWavHeader(pcmBuffer.length, SAMPLE_RATE), pcmBuffer]);
  const srt = buildSrt(words, starts, ends);

  return { wavBuffer, srt };
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

    const { wavBuffer, srt } = await generateCartesiaAudioWithTimestamps({ apiKey, prompt, voiceId });
    const generatedDir = join(process.cwd(), 'public', 'generated-audio');
    await mkdir(generatedDir, { recursive: true });

    const createdAt = new Date().toISOString();
    const promptPreview = createPromptPreview(prompt);
    const timestamp = createdAt.replace(/[:.]/g, '-');
    const fileStem = slugify(promptPreview);
    const filename = `${timestamp}-${fileStem}.wav`;
    await writeFile(join(generatedDir, filename), wavBuffer);

    const metadata: GeneratedAudioMetadata = {
      createdAt,
      promptPreview,
      srt,
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
        srt,
      },
    });
  } catch (err) {
    console.error('Failed to generate Cartesia audio', err);
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
