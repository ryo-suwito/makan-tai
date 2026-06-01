import { NextRequest, NextResponse } from 'next/server';
import { getStyleDnaProfileById, getSystemPromptById } from '../../../../lib/db';
import { buildStyleDnaInstruction } from '../../../../lib/style-dna';
import { generateText } from '../../../../lib/text-generation';

export const runtime = 'nodejs';

interface GeminiGenerateBody {
  input: string;
  styleDnaId?: number | null;
  systemPromptId?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeminiGenerateBody;
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const systemPromptId = body.systemPromptId ?? null;
    const styleDnaId = body.styleDnaId ?? null;

    if (!input) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    let systemPrompt: { id: number; name: string; text: string; created_at: string } | null = null;
    if (typeof systemPromptId === 'number') {
      systemPrompt = getSystemPromptById(systemPromptId);
      if (!systemPrompt) {
        return NextResponse.json({ error: 'Selected system prompt was not found' }, { status: 404 });
      }
    }

    const styleDna = typeof styleDnaId === 'number'
      ? getStyleDnaProfileById(styleDnaId)
      : null;
    if (typeof styleDnaId === 'number' && !styleDna) {
      return NextResponse.json({ error: 'Selected Style DNA was not found' }, { status: 404 });
    }

    const systemInstruction = [systemPrompt?.text, styleDna ? buildStyleDnaInstruction(styleDna.profile) : null]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join('\n\n');

    const result = await generateText({
      provider: 'gemini',
      input,
      systemInstruction: systemInstruction || null,
    });

    if (!result.text.trim()) {
      return NextResponse.json({ error: 'Gemini returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        ...result,
        systemPromptName: systemPrompt?.name ?? null,
        styleDnaName: styleDna?.name ?? null,
      },
    });
  } catch (err: any) {
    console.error('Gemini generation failed', err);
    return NextResponse.json(
      {
        error: 'Failed to generate text',
        details: err?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
