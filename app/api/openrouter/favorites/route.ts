import { NextRequest, NextResponse } from 'next/server';
import {
  addOpenRouterFavorite,
  readOpenRouterFavorites,
  removeOpenRouterFavorite,
} from '@/lib/openrouter-favorites';

export const runtime = 'nodejs';

export async function GET() {
  const favorites = await readOpenRouterFavorites();
  return NextResponse.json({ data: favorites });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const favorites = await addOpenRouterFavorite(body.favorite);
    return NextResponse.json({ data: favorites });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save OpenRouter favorite.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const value = searchParams.get('value')?.trim();

  if (!value) {
    return NextResponse.json({ error: 'Missing favorite value.' }, { status: 400 });
  }

  const favorites = await removeOpenRouterFavorite(value);
  return NextResponse.json({ data: favorites });
}
