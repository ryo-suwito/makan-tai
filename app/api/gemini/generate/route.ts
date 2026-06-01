import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { getSystemPromptById } from '../../../../lib/db';

export const runtime = 'nodejs';

interface GeminiGenerateBody {
  input: string;
  systemPromptId?: number | null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
  }

  try {
    const body = (await req.json()) as GeminiGenerateBody;
    const input = typeof body.input === 'string' ? body.input.trim() : '';
    const systemPromptId = body.systemPromptId ?? null;

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

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: input,
      config: {
        systemInstruction: systemPrompt?.text,
        temperature: 0.7,
      },
    });

    return NextResponse.json({
      data: {
        text: response.text ?? '',
        model: 'gemini-3.5-flash',
        provider: 'gemini',
        requestedModel: 'gemini-3.5-flash',
        systemPromptName: systemPrompt?.name ?? null,
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
