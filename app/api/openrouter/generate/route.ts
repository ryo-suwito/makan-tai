import { NextRequest, NextResponse } from 'next/server';
import { getStyleDnaProfileById, getSystemPromptById } from '../../../../lib/db';
import { buildStyleDnaInstruction } from '../../../../lib/style-dna';
import { generateText } from '../../../../lib/text-generation';

export const runtime = 'nodejs';

interface OpenRouterGenerateBody {
  input: string;
  model?: string | null;
  styleDnaId?: number | null;
  systemPromptId?: number | null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as OpenRouterGenerateBody;
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'openrouter/free';
    const systemPromptId = body.systemPromptId ?? null;
    const styleDnaId = body.styleDnaId ?? null;

    if (!input) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    let systemPrompt: { created_at: string; id: number; name: string; text: string } | null = null;
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
      provider: 'openrouter',
      input,
      openRouterModel: requestedModel,
      systemInstruction: systemInstruction || null,
    });

    if (!result.text.trim()) {
      return NextResponse.json({ error: 'OpenRouter returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        ...result,
        systemPromptName: systemPrompt?.name ?? null,
        styleDnaName: styleDna?.name ?? null,
      },
    });
  } catch (err: unknown) {
    console.error('OpenRouter generation failed', err);
    return NextResponse.json(
      {
        error: 'Failed to generate text',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
