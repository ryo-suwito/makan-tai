export function normalizeLocalAssetUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.pathname.startsWith('/generated/') || parsed.pathname.startsWith('/uploads/'))
    ) {
      return parsed.pathname;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
