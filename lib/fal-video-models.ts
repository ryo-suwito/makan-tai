export const FAL_VIDEO_MODELS = [
  'fal-ai/wan/v2.2-a14b/image-to-video',
  'fal-ai/wan/v2.2-5b/image-to-video',
  'fal-ai/wan/v2.7/image-to-video',
  'fal-ai/hunyuan-video-image-to-video',
  'fal-ai/ltx-2.3/image-to-video/fast',
] as const;

export type FalVideoModel = typeof FAL_VIDEO_MODELS[number];
export type FalVideoAspectRatio = 'auto' | '16:9' | '1:1' | '9:16';
export type FalVideoDuration =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '18'
  | '20';
export type FalVideoResolution = '480p' | '720p' | '1080p';

export interface FalVideoModelOption {
  label: string;
  note: string;
  value: FalVideoModel;
}

export const FAL_VIDEO_MODEL_OPTIONS: FalVideoModelOption[] = [
  {
    value: 'fal-ai/wan/v2.2-a14b/image-to-video',
    label: 'Wan 2.2 A14B',
    note: 'Stable default for workflow clips.',
  },
  {
    value: 'fal-ai/wan/v2.2-5b/image-to-video',
    label: 'Wan 2.2 5B',
    note: 'Smaller Wan variant.',
  },
  {
    value: 'fal-ai/wan/v2.7/image-to-video',
    label: 'Wan 2.7',
    note: 'Newer Wan image-to-video model.',
  },
  {
    value: 'fal-ai/hunyuan-video-image-to-video',
    label: 'Hunyuan',
    note: 'Alternative image-to-video model.',
  },
  {
    value: 'fal-ai/ltx-2.3/image-to-video/fast',
    label: 'LTX 2.3 Fast',
    note: 'Fast model, supports 5s and 10s.',
  },
];

export const DEFAULT_FAL_VIDEO_MODEL: FalVideoModel = 'fal-ai/wan/v2.2-a14b/image-to-video';
export const DEFAULT_FAL_VIDEO_DURATION: FalVideoDuration = '5';
export const DEFAULT_FAL_VIDEO_RESOLUTION: FalVideoResolution = '720p';
export const DEFAULT_FAL_VIDEO_ASPECT_RATIO: FalVideoAspectRatio = 'auto';

const MODEL_DURATIONS: Record<FalVideoModel, readonly FalVideoDuration[]> = {
  'fal-ai/wan/v2.2-a14b/image-to-video': ['5'],
  'fal-ai/wan/v2.2-5b/image-to-video': ['5'],
  'fal-ai/wan/v2.7/image-to-video': ['5'],
  'fal-ai/hunyuan-video-image-to-video': ['5'],
  'fal-ai/ltx-2.3/image-to-video/fast': ['5', '10'],
};

export function getSupportedFalVideoDurations(model: FalVideoModel) {
  return MODEL_DURATIONS[model];
}

export function isFalVideoModel(model: string): model is FalVideoModel {
  return FAL_VIDEO_MODELS.includes(model as FalVideoModel);
}

export function getClosestSupportedFalVideoDuration(model: FalVideoModel, seconds: number): FalVideoDuration {
  const supported = MODEL_DURATIONS[model];
  let closest = supported[0];
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const candidate of supported) {
    const delta = Math.abs(Number(candidate) - seconds);
    if (delta < smallestDelta) {
      closest = candidate;
      smallestDelta = delta;
    }
  }

  return closest;
}

export function buildFalVideoPayload(input: {
  aspectRatio: FalVideoAspectRatio;
  duration: FalVideoDuration;
  imageUrl: string;
  model: FalVideoModel;
  prompt: string;
  resolution: FalVideoResolution;
}) {
  if (input.model === 'fal-ai/ltx-2.3/image-to-video/fast') {
    return {
      endpoint: input.model,
      payload: {
        prompt: input.prompt,
        image_url: input.imageUrl,
        duration: input.duration,
        aspect_ratio: input.aspectRatio,
        resolution: input.resolution,
        generate_audio: false,
        enable_prompt_expansion: false,
      },
    };
  }

  return {
    endpoint: input.model,
    payload: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      duration: input.duration,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
    },
  };
}
