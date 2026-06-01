import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { OpenRouterModelOption } from '@/components/home/types';

const OPENROUTER_FAVORITES_PATH = join(process.cwd(), 'data', 'openrouter-favorites.json');
export const MAX_OPENROUTER_FAVORITES = 12;

function normalizeOpenRouterFavorite(input: unknown): OpenRouterModelOption | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const value = typeof record.value === 'string' ? record.value.trim() : '';
  const label = typeof record.label === 'string' ? record.label.trim() : '';

  if (!value || !label) {
    return null;
  }

  return {
    value,
    label,
    contextLength: typeof record.contextLength === 'number' ? record.contextLength : null,
    promptPrice: typeof record.promptPrice === 'string' ? record.promptPrice : null,
    completionPrice: typeof record.completionPrice === 'string' ? record.completionPrice : null,
    requestPrice: typeof record.requestPrice === 'string' ? record.requestPrice : null,
  };
}

function dedupeOpenRouterFavorites(options: OpenRouterModelOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) {
      return false;
    }

    seen.add(option.value);
    return true;
  });
}

async function ensureFavoritesDir() {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
}

export async function readOpenRouterFavorites() {
  await ensureFavoritesDir();

  try {
    const raw = await readFile(OPENROUTER_FAVORITES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as OpenRouterModelOption[];
    }

    return dedupeOpenRouterFavorites(
      parsed
        .map(normalizeOpenRouterFavorite)
        .filter((item): item is OpenRouterModelOption => item !== null),
    ).slice(0, MAX_OPENROUTER_FAVORITES);
  } catch {
    return [] as OpenRouterModelOption[];
  }
}

export async function writeOpenRouterFavorites(favorites: OpenRouterModelOption[]) {
  await ensureFavoritesDir();
  const next = dedupeOpenRouterFavorites(favorites).slice(0, MAX_OPENROUTER_FAVORITES);
  await writeFile(OPENROUTER_FAVORITES_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export async function addOpenRouterFavorite(favorite: unknown) {
  const normalized = normalizeOpenRouterFavorite(favorite);
  if (!normalized) {
    throw new Error('Invalid OpenRouter favorite.');
  }

  const current = await readOpenRouterFavorites();
  return writeOpenRouterFavorites([normalized, ...current]);
}

export async function removeOpenRouterFavorite(value: string) {
  const current = await readOpenRouterFavorites();
  return writeOpenRouterFavorites(current.filter((item) => item.value !== value));
}
