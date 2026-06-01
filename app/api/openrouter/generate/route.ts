import { NextRequest, NextResponse } from 'next/server';
import { getSystemPromptById } from '../../../../lib/db';

export const runtime = 'nodejs';

interface OpenRouterGenerateBody {
  input: string;
  model?: string | null;
  systemPromptId?: number | null;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
      role?: string;
    };
  }>;
  error?: {
    message?: string;
  };
  model?: string;
}

function getOpenRouterHeaders(req: NextRequest) {
  const referer =
    process.env.OPENROUTER_SITE_URL ||
    (() => {
      const host = req.headers.get('host');
      const proto = req.headers.get('x-forwarded-proto') || 'http';
      return host ? `${proto}://${host}` : 'http://localhost:3000';
    })();

  const title = process.env.OPENROUTER_APP_NAME || 'AI Image + Voice Studio';

  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': referer,
    'X-OpenRouter-Title': title,
  };
}

function extractMessageText(content: OpenRouterChatResponse['choices'][number]['message']['content']) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
  }

  return '';
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: getOpenRouterHeaders(req),
      body: JSON.stringify({
        model: requestedModel,
        temperature: 0.7,
        messages: [
          ...(systemPrompt
            ? [{ role: 'system', content: systemPrompt.text }]
            : []),
          { role: 'user', content: input },
        ],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenRouterChatResponse;
    if (!response.ok) {
      const errorMessage = data?.error?.message || 'OpenRouter request failed.';
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const text = extractMessageText(data.choices?.[0]?.message?.content);
    if (!text) {
      return NextResponse.json({ error: 'OpenRouter returned an empty response.' }, { status: 502 });
    }

    return NextResponse.json({
      data: {
        text,
        model: requestedModel,
        provider: 'openrouter',
        resolvedModel: data.model || null,
        systemPromptName: systemPrompt?.name ?? null,
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
