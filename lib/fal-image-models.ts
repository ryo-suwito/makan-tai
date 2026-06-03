import type { FalImageModelId, FalImageModelOption } from '@/components/home/types';

const FAL_IMAGE_ASPECT_RATIOS = ['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21'] as const;
type FalImageAspectRatio = typeof FAL_IMAGE_ASPECT_RATIOS[number];

interface FalImageModelConfig extends FalImageModelOption {
  editEndpoint?: string;
  maxBatchSize: number;
  pricePerUnit: number;
  textEndpoint: string;
}

const FAL_IMAGE_MODEL_CONFIG: Record<FalImageModelId, FalImageModelConfig> = {
  'seedream-v4': {
    value: 'seedream-v4',
    label: 'Seedream V4',
    unit: 'image',
    price: '$0.03',
    outputPerDollar: '33 images',
    maxBatchSize: 6,
    pricePerUnit: 0.03,
    textEndpoint: 'fal-ai/bytedance/seedream/v4/text-to-image',
    editEndpoint: 'fal-ai/bytedance/seedream/v4/edit',
  },
  'flux-kontext-pro': {
    value: 'flux-kontext-pro',
    label: 'Flux Kontext Pro',
    unit: 'image',
    price: '$0.04',
    outputPerDollar: '25 images',
    maxBatchSize: 4,
    pricePerUnit: 0.04,
    textEndpoint: 'fal-ai/flux-pro/kontext/text-to-image',
    editEndpoint: 'fal-ai/flux-pro/kontext',
  },
  'nano-banana': {
    value: 'nano-banana',
    label: 'Nanobanana',
    unit: 'image',
    price: '$0.0398',
    outputPerDollar: '25 images',
    maxBatchSize: 4,
    pricePerUnit: 0.0398,
    textEndpoint: 'fal-ai/nano-banana',
    editEndpoint: 'fal-ai/nano-banana/edit',
  },
  'qwen-image': {
    value: 'qwen-image',
    label: 'Qwen',
    unit: 'megapixel',
    price: '$0.02',
    outputPerDollar: '50 megapixels',
    maxBatchSize: 4,
    pricePerUnit: 0.02,
    textEndpoint: 'fal-ai/qwen-image',
    editEndpoint: 'fal-ai/qwen-image/image-to-image',
  },
};

export const FAL_IMAGE_MODEL_OPTIONS = Object.values(FAL_IMAGE_MODEL_CONFIG);
export const DEFAULT_FAL_IMAGE_MODEL = FAL_IMAGE_MODEL_OPTIONS[0];

export function getFalImageModelConfig(model: FalImageModelId) {
  return FAL_IMAGE_MODEL_CONFIG[model];
}

export function isFalImageModelId(value: string): value is FalImageModelId {
  return value in FAL_IMAGE_MODEL_CONFIG;
}

export function clampFalImageBatchSize(model: FalImageModelId, batchSize: number) {
  const safeBatchSize = Math.max(1, Math.floor(batchSize || 1));
  return Math.min(safeBatchSize, getFalImageModelConfig(model).maxBatchSize);
}

export function estimateFalImageTotalCost(model: FalImageModelId, width: number, height: number, batchSize: number) {
  const config = getFalImageModelConfig(model);
  const safeBatchSize = clampFalImageBatchSize(model, batchSize);

  if (config.unit === 'image') {
    return parseFloat((config.pricePerUnit * safeBatchSize).toFixed(5));
  }

  const megapixels = Math.max(1, Math.ceil((Math.max(1, width) * Math.max(1, height)) / 1_000_000));
  return parseFloat((config.pricePerUnit * megapixels * safeBatchSize).toFixed(5));
}

export function getClosestFalImageAspectRatio(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return '1:1';
  }

  const requestedRatio = width / height;
  let closest: FalImageAspectRatio = FAL_IMAGE_ASPECT_RATIOS[0];
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const ratio of FAL_IMAGE_ASPECT_RATIOS) {
    const [ratioWidth, ratioHeight] = ratio.split(':').map(Number);
    const candidate = ratioWidth / ratioHeight;
    const delta = Math.abs(candidate - requestedRatio);

    if (delta < smallestDelta) {
      closest = ratio;
      smallestDelta = delta;
    }
  }

  return closest;
}
