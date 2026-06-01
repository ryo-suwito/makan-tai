import type { OpenAiImageModel } from './image-models';

export type Quality = 'low' | 'medium' | 'high';

const COST_TABLE: Record<OpenAiImageModel, Record<Quality, { '1024x1024': number; '1024x1536': number; '1536x1024': number }>> = {
  'gpt-image-2': {
    low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
    medium: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
    high: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
  },
  'gpt-image-1.5': {
    low: { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
    medium: { '1024x1024': 0.034, '1024x1536': 0.05, '1536x1024': 0.05 },
    high: { '1024x1024': 0.133, '1024x1536': 0.2, '1536x1024': 0.2 },
  },
  'gpt-image-1': {
    low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
    medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
    high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 },
  },
  'gpt-image-1-mini': {
    low: { '1024x1024': 0.005, '1024x1536': 0.006, '1536x1024': 0.006 },
    medium: { '1024x1024': 0.011, '1024x1536': 0.015, '1536x1024': 0.015 },
    high: { '1024x1024': 0.036, '1024x1536': 0.052, '1536x1024': 0.052 },
  },
};

export function estimateImageCost(model: OpenAiImageModel, quality: Quality, width: number, height: number): number {
  const key = `${Math.min(width, 1536)}x${Math.min(height, 1536)}` as '1024x1024' | '1024x1536' | '1536x1024';

  if (COST_TABLE[model][quality][key]) {
    return COST_TABLE[model][quality][key];
  }

  const baseSize = 1024 * 1024;
  const requestedSize = width * height;
  const baseCost = COST_TABLE[model][quality]['1024x1024'];
  return parseFloat(((requestedSize / baseSize) * baseCost).toFixed(5));
}

export function estimateTotalCost(
  model: OpenAiImageModel | null,
  quality: Quality,
  width: number,
  height: number,
  batchSize: number,
): number | null {
  if (!model) {
    return null;
  }

  const perImage = estimateImageCost(model, quality, width, height);
  return parseFloat((perImage * batchSize).toFixed(5));
}
