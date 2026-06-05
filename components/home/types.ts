import type { StyleDnaProfile } from '@/lib/style-dna';

export interface GeneratedImage {
  url: string;
}

export type FalImageModelId =
  | 'seedream-v4'
  | 'flux-kontext-pro'
  | 'nano-banana'
  | 'qwen-image'
  | 'qwen-image-edit-2511'
  | 'qwen-image-edit-2511-multiple-angles'
  | 'qwen-image-2-edit'
  | 'qwen-image-2-pro-edit'
  | 'qwen-image-edit-2511-lora';

export type FalImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type FalImageAcceleration = 'none' | 'regular' | 'high';

export interface FalImageModelOption {
  label: string;
  outputPerDollar: string;
  price: string;
  unit: 'image' | 'megapixel';
  value: FalImageModelId;
}

export interface FalImageLoraOption {
  defaultScale: number;
  description: string;
  id: string;
  label: string;
  path: string;
  repoUrl: string;
  safetensorsUrl: string;
}

export interface FalImageLoraSelection extends FalImageLoraOption {
  scale: number;
}

export interface FalQwenImageEdit2511Settings {
  acceleration: FalImageAcceleration;
  enableSafetyChecker: boolean;
  guidanceScale: number;
  negativePrompt: string;
  numInferenceSteps: number;
  outputFormat: FalImageOutputFormat;
  seed: number | null;
}

export interface FalQwenImageEdit2511MultipleAnglesSettings {
  acceleration: Extract<FalImageAcceleration, 'none' | 'regular'>;
  enableSafetyChecker: boolean;
  guidanceScale: number;
  horizontalAngle: number;
  loraScale: number;
  negativePrompt: string;
  numInferenceSteps: number;
  outputFormat: FalImageOutputFormat;
  seed: number | null;
  verticalAngle: number;
  zoom: number;
}

export interface FalQwenImage2EditSettings {
  enablePromptExpansion: boolean;
  enableSafetyChecker: boolean;
  negativePrompt: string;
  outputFormat: FalImageOutputFormat;
  seed: number | null;
}

export interface FalImageSettings {
  qwenImageEdit2511: FalQwenImageEdit2511Settings;
  qwenImageEdit2511MultipleAngles: FalQwenImageEdit2511MultipleAnglesSettings;
  qwenImage2Edit: FalQwenImage2EditSettings;
  qwenImageEdit2511Loras: FalImageLoraSelection[];
}

export type SelfHostImageModelId = 'flux-schnell' | 'flux-dev';

export interface SelfHostImageModelOption {
  label: string;
  note: string;
  value: SelfHostImageModelId;
}

export interface AlertDialogState {
  title: string;
  message: string;
  confirmLabel: string;
}

export interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  isOwner: boolean;
  createdAt: string;
}

export interface GeneratedAudioClip {
  createdAt?: string | null;
  filename: string;
  promptPreview?: string | null;
  url: string;
  voiceId?: string | null;
  voiceName?: string | null;
}

export type FalVideoModel =
  | 'fal-ai/wan/v2.2-a14b/image-to-video'
  | 'fal-ai/wan/v2.2-5b/image-to-video'
  | 'fal-ai/wan/v2.7/image-to-video'
  | 'fal-ai/hunyuan-video-image-to-video'
  | 'fal-ai/ltx-2.3/image-to-video/fast';

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

export interface GeneratedVideoClip {
  aspectRatio?: FalVideoAspectRatio | null;
  createdAt?: string | null;
  duration?: FalVideoDuration | null;
  filename: string;
  model?: FalVideoModel | null;
  promptPreview?: string | null;
  resolution?: FalVideoResolution | null;
  url: string;
}

export interface SystemPrompt {
  id: number;
  name: string;
  text: string;
  created_at: string;
}

export interface SavedPrompt {
  created_at?: string;
  id: number;
  text: string;
}

export interface SavedStyleDnaProfile {
  created_at: string;
  id: number;
  name: string;
  profile: StyleDnaProfile;
}

export type TextProvider = 'gemini' | 'openrouter';

export interface OpenRouterModelOption {
  completionPrice?: string | null;
  contextLength?: number | null;
  label: string;
  promptPrice?: string | null;
  requestPrice?: string | null;
  value: string;
}

export interface OpenRouterModelApiItem {
  completionPrice?: string | null;
  contextLength?: number | null;
  id: string;
  name: string;
  promptPrice?: string | null;
  requestPrice?: string | null;
}

export interface TextGenerationResult {
  model: string;
  provider: TextProvider;
  resolvedModel?: string | null;
  styleDnaName?: string | null;
  systemPromptName?: string | null;
  text: string;
}

export type WorkflowSegmentStatus = 'todo' | 'voice' | 'image' | 'video' | 'done';

export interface WorkflowSegmentDraft {
  image_prompt: string;
  order: number;
  text: string;
  video_no_sound: boolean;
  video_prompt: string;
}

export interface WorkflowSegment {
  assembled_url: string | null;
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  order: number;
  srt: string | null;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_no_sound: boolean;
  video_prompt: string;
  video_url: string | null;
  voice_url: string | null;
  workflow_id: number;
}

export interface Workflow {
  created_at: string;
  finalized_url: string | null;
  id: number;
  segments: WorkflowSegment[];
  title: string;
  updated_at: string;
  youtube_config_id: number | null;
  youtube_publish_url: string | null;
  youtube_published_at: string | null;
  youtube_video_id: string | null;
}

export type YouTubePrivacyStatus = 'private' | 'public' | 'unlisted';

export interface YouTubeProfile {
  channel_id: string | null;
  channel_title: string | null;
  created_at: string;
  google_account_email: string | null;
  google_account_id: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  id: number;
  name: string;
  scope: string | null;
  token_expires_at: string | null;
  token_type: string | null;
  updated_at: string;
}

export interface YouTubeConfig {
  category_id: string | null;
  contains_synthetic_media: boolean;
  created_at: string;
  default_description: string;
  default_tags: string[];
  id: number;
  name: string;
  privacy_status: YouTubePrivacyStatus;
  self_declared_made_for_kids: boolean;
  thumbnail_url: string | null;
  title_template: string;
  updated_at: string;
  youtube_profile_id: number | null;
}

export interface YouTubeConnectionStatus {
  callbackUrl: string;
  configured: boolean;
  hasExplicitRedirectUri: boolean;
}

export interface ThreadsConnectionStatus {
  callbackUrl: string;
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  userId: string | null;
}

export function mapOpenRouterModelToOption(item: OpenRouterModelApiItem): OpenRouterModelOption {
  return {
    value: item.id,
    label: item.name,
    contextLength: item.contextLength ?? null,
    promptPrice: item.promptPrice ?? null,
    completionPrice: item.completionPrice ?? null,
    requestPrice: item.requestPrice ?? null,
  };
}

export function createOpenRouterCustomOption(value: string): OpenRouterModelOption {
  return {
    value,
    label: value,
    contextLength: null,
    promptPrice: null,
    completionPrice: null,
    requestPrice: null,
  };
}

export const OPENROUTER_FREE_OPTION: OpenRouterModelOption = {
  value: 'openrouter/free',
  label: 'OpenRouter Free Router',
  contextLength: null,
  promptPrice: '0',
  completionPrice: '0',
  requestPrice: '0',
};

export const OPENROUTER_AUTO_OPTION: OpenRouterModelOption = {
  value: 'openrouter/auto',
  label: 'OpenRouter Auto Router',
  contextLength: null,
  promptPrice: null,
  completionPrice: null,
  requestPrice: null,
};
