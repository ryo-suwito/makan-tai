import type { StyleDnaProfile } from '@/lib/style-dna';

export interface GeneratedImage {
  url: string;
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
  video_prompt: string;
}

export interface WorkflowSegment {
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  order: number;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_prompt: string;
  video_url: string | null;
  voice_url: string | null;
  workflow_id: number;
}

export interface Workflow {
  created_at: string;
  id: number;
  segments: WorkflowSegment[];
  title: string;
  updated_at: string;
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
