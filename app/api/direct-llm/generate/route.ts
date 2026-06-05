import { NextRequest, NextResponse } from 'next/server';
import { getStyleDnaProfileById, getSystemPromptById } from '../../../../lib/db';
import { getDirectLlmVendorConfig, type DirectLlmVendorSlug } from '../../../../lib/direct-llm-vendors';
import { buildStyleDnaInstruction } from '../../../../lib/style-dna';
import { generateText } from '../../../../lib/text-generation';

export const runtime = 'nodejs';

interface DirectLlmGenerateBody {
  input: string;
  model?: string | null;
  styleDnaId?: number | null;
  systemPromptId?: number | null;
  vendor?: string | null;
}

function parseDirectVendorSlug(value: unknown): DirectLlmVendorSlug | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (value === 'gemini' || value === 'mimo' || value === 'deepseek') {
    return value;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DirectLlmGenerateBody;
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : null;
    const vendor = parseDirectVendorSlug(body.vendor);
    const systemPromptId = body.systemPromptId ?? null;
    const styleDnaId = body.styleDnaId ?? null;

    if (!vendor) {
      return NextResponse.json({ error: 'Valid direct LLM vendor is required.' }, { status: 400 });
    }

    if (!input) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    const vendorConfig = getDirectLlmVendorConfig(vendor);
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
      provider: vendor,
      input,
      directModel: model,
      systemInstruction: systemInstruction || null,
    });

    if (!result.text.trim()) {
      return NextResponse.json({ error: `${vendorConfig.label} returned an empty response.` }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        ...result,
        systemPromptName: systemPrompt?.name ?? null,
        styleDnaName: styleDna?.name ?? null,
      },
    });
  } catch (err: unknown) {
    console.error('Direct LLM generation failed', err);
    return NextResponse.json(
      {
        error: 'Failed to generate text',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
