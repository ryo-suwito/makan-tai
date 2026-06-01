import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OpenRouterModelApiResponse {
  data?: Array<{
    architecture?: {
      output_modalities?: string[];
    };
    context_length?: number;
    id?: string;
    name?: string;
    pricing?: {
      completion?: string;
      prompt?: string;
      request?: string;
    };
  }>;
}

interface OpenRouterModelItem {
  completionPrice: string | null;
  contextLength: number | null;
  id: string;
  name: string;
  promptPrice: string | null;
  requestPrice: string | null;
}

const ROUTER_MODELS: OpenRouterModelItem[] = [
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    contextLength: null,
    promptPrice: '0',
    completionPrice: '0',
    requestPrice: '0',
  },
  {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto Router',
    contextLength: null,
    promptPrice: null,
    completionPrice: null,
    requestPrice: null,
  },
];

let cachedModels: OpenRouterModelItem[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function loadAllOpenRouterModels(apiKey: string) {
  const now = Date.now();
  if (cachedModels && now - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }

  const response = await fetch('https://openrouter.ai/api/v1/models?output_modalities=text', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => ({}))) as OpenRouterModelApiResponse;
  if (!response.ok) {
    throw new Error('Failed to load OpenRouter models.');
  }

  cachedModels = (Array.isArray(data.data) ? data.data : [])
    .filter((item) => item?.id && item?.name)
    .filter((item) => item.architecture?.output_modalities?.includes('text') ?? true)
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      contextLength: item.context_length ?? null,
      promptPrice: item.pricing?.prompt ?? null,
      completionPrice: item.pricing?.completion ?? null,
      requestPrice: item.pricing?.request ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  cachedAt = now;

  return cachedModels;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
  }

  try {
    const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
    const limitParam = Number(req.nextUrl.searchParams.get('limit') || '24');
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 24;

    const allModels = await loadAllOpenRouterModels(apiKey);
    const filteredModels = query
      ? allModels.filter((item) => {
        const haystack = `${item.id} ${item.name}`.toLowerCase();
        return haystack.includes(query);
      })
      : [];

    return NextResponse.json({
      data: [
        ...ROUTER_MODELS.filter((item) => {
          if (!query) {
            return true;
          }
          const haystack = `${item.id} ${item.name}`.toLowerCase();
          return haystack.includes(query);
        }),
        ...filteredModels.slice(0, limit),
      ],
      meta: {
        cached: Boolean(cachedModels),
        limit,
        query,
      },
    });
  } catch (err) {
    console.error('Failed to load OpenRouter models', err);
    return NextResponse.json({ error: 'Failed to load OpenRouter models.' }, { status: 500 });
  }
}
