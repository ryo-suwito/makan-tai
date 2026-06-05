import { NextRequest, NextResponse } from 'next/server';
import { listDirectLlmModels, type DirectLlmVendorSlug } from '../../../../lib/direct-llm-vendors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDirectVendorSlug(value: unknown): DirectLlmVendorSlug | null {
  if (value === 'gemini' || value === 'mimo' || value === 'deepseek') {
    return value;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const vendor = parseDirectVendorSlug(req.nextUrl.searchParams.get('vendor'));
  if (!vendor) {
    return NextResponse.json({ error: 'Valid direct LLM vendor is required.' }, { status: 400 });
  }

  const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';
  const limitParam = Number(req.nextUrl.searchParams.get('limit') || '24');
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 24;
  const models = await listDirectLlmModels(vendor);
  const filteredModels = query
    ? models.filter((item) => {
      const haystack = `${item.value} ${item.label}`.toLowerCase();
      return haystack.includes(query);
    })
    : models;

  return NextResponse.json({
    data: filteredModels.slice(0, limit),
    meta: {
      limit,
      query,
      vendor,
    },
  });
}
