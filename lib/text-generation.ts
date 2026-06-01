import { GoogleGenAI } from '@google/genai';

export type TextGenerationProvider = 'gemini' | 'openrouter';

export interface GenerateTextParams {
  input: string;
  openRouterModel?: string | null;
  provider: TextGenerationProvider;
  systemInstruction?: string | null;
}

export interface GenerateTextResult {
  model: string;
  provider: TextGenerationProvider;
  resolvedModel?: string | null;
  text: string;
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

function extractOpenRouterMessageText(content: OpenRouterChatResponse['choices'][number]['message']['content']) {
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

function getOpenRouterHeaders() {
  const referer = process.env.OPENROUTER_SITE_URL || 'http://localhost:3000';
  const title = process.env.OPENROUTER_APP_NAME || 'AI Image + Voice Studio';

  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': referer,
    'X-OpenRouter-Title': title,
  };
}

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const input = params.input.trim();
  const systemInstruction = params.systemInstruction?.trim() || null;

  if (!input) {
    throw new Error('Missing input');
  }

  if (params.provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY');
    }

    const model = 'gemini-3.5-flash';
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: input,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: 0.7,
      },
    });

    return {
      text: response.text ?? '',
      model,
      provider: 'gemini',
      resolvedModel: null,
    };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const requestedModel = params.openRouterModel?.trim() || 'openrouter/free';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: requestedModel,
      temperature: 0.7,
      messages: [
        ...(systemInstruction
          ? [{ role: 'system', content: systemInstruction }]
          : []),
        { role: 'user', content: input },
      ],
    }),
  });

  const data = (await response.json().catch(() => ({}))) as OpenRouterChatResponse;
  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenRouter request failed.');
  }

  return {
    text: extractOpenRouterMessageText(data.choices?.[0]?.message?.content),
    model: requestedModel,
    provider: 'openrouter',
    resolvedModel: data.model || null,
  };
}
