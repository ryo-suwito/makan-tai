import type {
  FalImageModelId,
  FalImageModelOption,
  FalImageSettings,
  FalQwenImage2EditSettings,
  FalQwenImageEdit2511Settings,
  FalQwenImageEdit2511MultipleAnglesSettings,
} from '@/components/home/types';

const FAL_IMAGE_ASPECT_RATIOS = ['21:9', '16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '9:21'] as const;
type FalImageAspectRatio = typeof FAL_IMAGE_ASPECT_RATIOS[number];

interface FalImageModelConfig extends FalImageModelOption {
  editEndpoint?: string;
  maxBatchSize: number;
  requiresReferenceImages?: boolean;
  pricePerUnit: number;
  textEndpoint?: string;
}

export const DEFAULT_FAL_QWEN_IMAGE_EDIT_2511_SETTINGS: FalQwenImageEdit2511Settings = {
  negativePrompt: '',
  numInferenceSteps: 28,
  guidanceScale: 4.5,
  acceleration: 'regular',
  enableSafetyChecker: true,
  outputFormat: 'png',
  seed: null,
};

export const DEFAULT_FAL_QWEN_IMAGE_EDIT_2511_MULTIPLE_ANGLES_SETTINGS: FalQwenImageEdit2511MultipleAnglesSettings = {
  horizontalAngle: 0,
  verticalAngle: 0,
  zoom: 5,
  loraScale: 1,
  negativePrompt: '',
  numInferenceSteps: 28,
  guidanceScale: 4.5,
  acceleration: 'regular',
  enableSafetyChecker: true,
  outputFormat: 'png',
  seed: null,
};

export const DEFAULT_FAL_QWEN_IMAGE_2_EDIT_SETTINGS: FalQwenImage2EditSettings = {
  negativePrompt: '',
  enablePromptExpansion: true,
  enableSafetyChecker: true,
  outputFormat: 'png',
  seed: null,
};

export const DEFAULT_FAL_IMAGE_SETTINGS: FalImageSettings = {
  qwenImageEdit2511: DEFAULT_FAL_QWEN_IMAGE_EDIT_2511_SETTINGS,
  qwenImageEdit2511MultipleAngles: DEFAULT_FAL_QWEN_IMAGE_EDIT_2511_MULTIPLE_ANGLES_SETTINGS,
  qwenImage2Edit: DEFAULT_FAL_QWEN_IMAGE_2_EDIT_SETTINGS,
  qwenImageEdit2511Loras: [],
};

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
  'qwen-image-edit-2511': {
    value: 'qwen-image-edit-2511',
    label: 'Qwen Image Edit 2511',
    unit: 'megapixel',
    price: '$0.03',
    outputPerDollar: '33 megapixels',
    maxBatchSize: 4,
    pricePerUnit: 0.03,
    editEndpoint: 'fal-ai/qwen-image-edit-2511',
    requiresReferenceImages: true,
  },
  'qwen-image-edit-2511-multiple-angles': {
    value: 'qwen-image-edit-2511-multiple-angles',
    label: 'Qwen Image Edit 2511 Multiple Angles',
    unit: 'megapixel',
    price: '$0.035',
    outputPerDollar: '28 megapixels',
    maxBatchSize: 4,
    pricePerUnit: 0.035,
    editEndpoint: 'fal-ai/qwen-image-edit-2511-multiple-angles',
    requiresReferenceImages: true,
  },
  'qwen-image-2-edit': {
    value: 'qwen-image-2-edit',
    label: 'Qwen Image 2 Edit',
    unit: 'image',
    price: '$0.035',
    outputPerDollar: '28 images',
    maxBatchSize: 4,
    pricePerUnit: 0.035,
    editEndpoint: 'fal-ai/qwen-image-2/edit',
    requiresReferenceImages: true,
  },
  'qwen-image-2-pro-edit': {
    value: 'qwen-image-2-pro-edit',
    label: 'Qwen Image 2 Pro Edit',
    unit: 'image',
    price: '$0.075',
    outputPerDollar: '13 images',
    maxBatchSize: 4,
    pricePerUnit: 0.075,
    editEndpoint: 'fal-ai/qwen-image-2/pro/edit',
    requiresReferenceImages: true,
  },
  'qwen-image-edit-2511-lora': {
    value: 'qwen-image-edit-2511-lora',
    label: 'Qwen Image Edit 2511 LoRA',
    unit: 'megapixel',
    price: '$0.035',
    outputPerDollar: '28 megapixels',
    maxBatchSize: 4,
    pricePerUnit: 0.035,
    editEndpoint: 'fal-ai/qwen-image-edit-2511/lora',
    requiresReferenceImages: true,
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

export function falImageModelRequiresReferenceImages(model: FalImageModelId) {
  return Boolean(getFalImageModelConfig(model).requiresReferenceImages);
}

export function falImageModelRequiresPrompt(model: FalImageModelId) {
  return model !== 'qwen-image-edit-2511-multiple-angles';
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
