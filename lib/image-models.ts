export const OPENAI_IMAGE_MODELS = [
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
] as const;

export const GEMINI_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
] as const;

export const OTHER_IMAGE_MODELS = [
  'a2e',
] as const;

export type OpenAiImageModel = typeof OPENAI_IMAGE_MODELS[number];
export type GeminiImageModel = typeof GEMINI_IMAGE_MODELS[number];
export type OtherImageModel = typeof OTHER_IMAGE_MODELS[number];
export type ImageGenerationModel = OpenAiImageModel | GeminiImageModel | OtherImageModel;

export const GEMINI_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;
export type GeminiAspectRatio = typeof GEMINI_ASPECT_RATIOS[number];

export const GEMINI_ASPECT_RATIO_DIMENSIONS: Record<GeminiAspectRatio, { height: number; width: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '9:16': { width: 576, height: 1024 },
  '16:9': { width: 1024, height: 576 },
};

export function isOpenAiImageModel(model: string): model is OpenAiImageModel {
  return OPENAI_IMAGE_MODELS.includes(model as OpenAiImageModel);
}

export function isGeminiImageModel(model: string): model is GeminiImageModel {
  return GEMINI_IMAGE_MODELS.includes(model as GeminiImageModel);
}

export function getClosestGeminiAspectRatio(width: number, height: number): GeminiAspectRatio {
  if (width <= 0 || height <= 0) {
    return '1:1';
  }

  const requestedRatio = width / height;
  let closest: GeminiAspectRatio = GEMINI_ASPECT_RATIOS[0];
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const ratio of GEMINI_ASPECT_RATIOS) {
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
