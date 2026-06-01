import { NextRequest, NextResponse } from 'next/server';
import { generateText, type TextGenerationProvider } from '../../../../lib/text-generation';
import {
  buildStyleDnaAnalysisPrompt,
  parseStyleDnaProfile,
} from '../../../../lib/style-dna';

export const runtime = 'nodejs';

interface StyleDnaAnalyzeBody {
  model?: string | null;
  provider?: TextGenerationProvider;
  samples?: string;
}

const STYLE_DNA_ANALYST_SYSTEM_PROMPT =
  'You are a precise writing style analyst. Return ONLY valid JSON. No markdown fences, no preamble, no explanation.';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as StyleDnaAnalyzeBody;
    const provider = body.provider === 'openrouter' ? 'openrouter' : 'gemini';
    const samples = typeof body.samples === 'string' ? body.samples.trim() : '';
    const openRouterModel = typeof body.model === 'string' ? body.model.trim() : null;

    if (samples.length < 80) {
      return NextResponse.json(
        { error: 'Paste at least a paragraph or two before extracting Style DNA.' },
        { status: 400 },
      );
    }

    const result = await generateText({
      provider,
      input: buildStyleDnaAnalysisPrompt(samples),
      openRouterModel,
      systemInstruction: STYLE_DNA_ANALYST_SYSTEM_PROMPT,
    });

    const profile = parseStyleDnaProfile(result.text);

    return NextResponse.json({
      data: {
        model: result.model,
        profile,
        provider: result.provider,
        resolvedModel: result.resolvedModel ?? null,
      },
    });
  } catch (err) {
    console.error('Style DNA analysis failed', err);
    return NextResponse.json(
      {
        error: 'Failed to extract Style DNA',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
