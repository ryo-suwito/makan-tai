'use client';

import Cartesia from '@cartesia/cartesia-js';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AlertDialog } from '@/components/home/AlertDialog';
import { ConnectedCockpitSection } from '@/components/home/ConnectedCockpitSection';
import { ImageStudioSection } from '@/components/home/ImageStudioSection';
import { PromptWriterSection } from '@/components/home/PromptWriterSection';
import { StyleDnaSection } from '@/components/home/StyleDnaSection';
import {
  OPENROUTER_FREE_OPTION,
  mapOpenRouterModelToOption,
  type AlertDialogState,
  type CartesiaVoice,
  type GeneratedAudioClip,
  type GeneratedImage,
  type OpenRouterModelApiItem,
  type OpenRouterModelOption,
  type SavedPrompt,
  type SavedStyleDnaProfile,
  type SystemPrompt,
  type TextGenerationResult,
  type TextProvider,
  type ThreadsConnectionStatus,
  type Workflow,
  type WorkflowSegment,
  type WorkflowSegmentDraft,
} from '@/components/home/types';
import { VoiceGeneratorSection } from '@/components/home/VoiceGeneratorSection';
import { WorkflowBoardSection } from '@/components/home/WorkflowBoardSection';
import { estimateTotalCost } from '@/lib/cost';
import {
  GEMINI_ASPECT_RATIO_DIMENSIONS,
  getClosestGeminiAspectRatio,
  isGeminiImageModel,
  isOpenAiImageModel,
  type GeminiAspectRatio,
  type ImageGenerationModel,
} from '@/lib/image-models';
import type { StyleDnaProfile } from '@/lib/style-dna';

const CARTESIA_SAMPLE_RATE = 44100;
const MAX_OPENROUTER_FAVORITES = 12;
const FLOATING_SHORTCUTS = [
  { href: '#cockpit', label: 'Connect', shortLabel: 'Hub' },
  { href: '#image-studio', label: 'Image Studio', shortLabel: 'Img' },
  { href: '#voice-generator', label: 'Voice Generator', shortLabel: 'Voice' },
  { href: '#style-dna', label: 'Style DNA', shortLabel: 'DNA' },
  { href: '#prompt-writer', label: 'Prompt Writer', shortLabel: 'Text' },
  { href: '#workflows', label: 'Workflows', shortLabel: 'Flow' },
];

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

async function getCartesiaToken(): Promise<string> {
  const response = await fetch('/api/cartesia/token', { method: 'POST' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || typeof data.token !== 'string') {
    const message = typeof data.error === 'string' ? data.error : 'Failed to authenticate with Cartesia.';
    throw new Error(message);
  }

  return data.token;
}

export default function Home() {
  const [promptPrefix, setPromptPrefix] = useState('');
  const [prompt, setPrompt] = useState('');
  const [promptSuffix, setPromptSuffix] = useState('');
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [batchSize, setBatchSize] = useState(1);
  const [model, setModel] = useState<ImageGenerationModel>('gpt-image-2');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [inputImages, setInputImages] = useState<string[]>([]);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);

  const [ttsPrompt, setTtsPrompt] = useState('');
  const [ttsVoices, setTtsVoices] = useState<CartesiaVoice[]>([]);
  const [selectedTtsVoiceId, setSelectedTtsVoiceId] = useState('');
  const [savedAudioClips, setSavedAudioClips] = useState<GeneratedAudioClip[]>([]);
  const [ttsPreviewLoading, setTtsPreviewLoading] = useState(false);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsVoicesLoading, setTtsVoicesLoading] = useState(false);
  const [ttsVoicesError, setTtsVoicesError] = useState<string | null>(null);

  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [systemPromptName, setSystemPromptName] = useState('');
  const [systemPromptText, setSystemPromptText] = useState('');
  const [selectedSystemPromptId, setSelectedSystemPromptId] = useState('');
  const [styleDnaProfiles, setStyleDnaProfiles] = useState<SavedStyleDnaProfile[]>([]);
  const [styleDnaName, setStyleDnaName] = useState('');
  const [styleDnaSamples, setStyleDnaSamples] = useState('');
  const [styleDnaDraftProfile, setStyleDnaDraftProfile] = useState<StyleDnaProfile | null>(null);
  const [selectedStyleDnaId, setSelectedStyleDnaId] = useState('');
  const [styleDnaAnalyzing, setStyleDnaAnalyzing] = useState(false);
  const [styleDnaSaving, setStyleDnaSaving] = useState(false);
  const [systemPromptSaving, setSystemPromptSaving] = useState(false);
  const [textProvider, setTextProvider] = useState<TextProvider>('gemini');
  const [openRouterModel, setOpenRouterModel] = useState<OpenRouterModelOption>(OPENROUTER_FREE_OPTION);
  const [favoriteOpenRouterModels, setFavoriteOpenRouterModels] = useState<OpenRouterModelOption[]>([]);
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | null>(null);
  const [geminiInput, setGeminiInput] = useState('');
  const [geminiResult, setGeminiResult] = useState<TextGenerationResult | null>(null);
  const [geminiOutputText, setGeminiOutputText] = useState('');
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [threadsPublishing, setThreadsPublishing] = useState(false);
  const [threadsConnection, setThreadsConnection] = useState<ThreadsConnectionStatus | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowSaving, setWorkflowSaving] = useState(false);

  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null);
  const ttsCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const ttsRequestIdRef = useRef(0);

  const selectedTtsVoice = ttsVoices.find((voice) => voice.id === selectedTtsVoiceId) ?? null;
  const selectedSystemPrompt = systemPrompts.find((item) => String(item.id) === selectedSystemPromptId) ?? null;
  const selectedStyleDna = styleDnaProfiles.find((item) => String(item.id) === selectedStyleDnaId) ?? null;
  const isOpenAiModel = isOpenAiImageModel(model);
  const isGeminiModel = isGeminiImageModel(model);
  const geminiAspectRatio = getClosestGeminiAspectRatio(width, height);
  const totalCost = estimateTotalCost(isOpenAiModel ? model : null, quality, width, height, batchSize);
  const styleDnaEngineLabel = `OpenRouter · ${openRouterModel.label}`;
  const outputCharacterCount = geminiOutputText.length;
  const isThreadsLengthExceeded = outputCharacterCount > 500;
  const isThreadsReady = Boolean(threadsConnection?.connected);
  const isSelectedOpenRouterFavorite = favoriteOpenRouterModels.some((item) => item.value === openRouterModel.value);
  const composedImagePrompt = [promptPrefix.trim(), prompt.trim(), promptSuffix.trim()]
    .filter(Boolean)
    .join('\n\n');

  const closeAlertDialog = () => setAlertDialog(null);

  const getErrorMessage = (err: unknown) => {
    if (axios.isAxiosError(err)) {
      const apiMessage = err.response?.data?.error ?? err.response?.data?.message ?? err.response?.data?.details;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
      if (err.message) {
        return err.message;
      }
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return 'Something went wrong. Please try again.';
  };

  const showErrorDialog = (title: string, err: unknown, confirmLabel = 'Close') => {
    setAlertDialog({
      title,
      message: getErrorMessage(err),
      confirmLabel,
    });
  };

  const loadSavedPrompts = async () => {
    const response = await fetch('/api/prompts');
    const data = await response.json();
    setSavedPrompts(Array.isArray(data.data) ? data.data as SavedPrompt[] : []);
  };

  const loadAvailableImages = async () => {
    const response = await fetch('/api/images');
    const data = await response.json();
    const images: string[] = [];

    if (Array.isArray(data.uploads)) {
      images.push(...data.uploads);
    }
    if (Array.isArray(data.generated)) {
      images.push(...data.generated);
    }

    const absoluteImages = images.map((image) => {
      if (image.startsWith('/') && typeof window !== 'undefined' && window.location) {
        return `${window.location.origin}${image}`;
      }
      return image;
    });

    setAvailableImages(absoluteImages);
  };

  const loadCartesiaVoices = async () => {
    setTtsVoicesLoading(true);
    setTtsVoicesError(null);

    try {
      const response = await fetch('/api/cartesia/voices');
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load Cartesia voices.');
      }

      const voices = Array.isArray(data.data) ? data.data as CartesiaVoice[] : [];
      setTtsVoices(voices);
      setSelectedTtsVoiceId((current) => {
        if (voices.some((voice) => voice.id === current)) {
          return current;
        }
        return voices[0]?.id ?? '';
      });
    } catch (err) {
      console.error('Failed to load Cartesia voices', err);
      setTtsVoicesError(getErrorMessage(err));
    } finally {
      setTtsVoicesLoading(false);
    }
  };

  const loadSavedAudioClips = async () => {
    try {
      const response = await fetch('/api/audio');
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load saved audio clips.');
      }

      setSavedAudioClips(Array.isArray(data.generated) ? data.generated : []);
    } catch (err) {
      console.error('Failed to load saved audio clips', err);
    }
  };

  const loadSystemPrompts = async () => {
    const response = await fetch('/api/system-prompts');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load system prompts.');
    }

    const prompts = Array.isArray(data.data) ? data.data as SystemPrompt[] : [];
    setSystemPrompts(prompts);
    setSelectedSystemPromptId((current) => {
      if (!current) {
        return current;
      }
      return prompts.some((item) => String(item.id) === current) ? current : '';
    });
  };

  const loadStyleDnaProfiles = async () => {
    const response = await fetch('/api/style-dna');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load Style DNA profiles.');
    }

    const profiles = Array.isArray(data.data) ? data.data as SavedStyleDnaProfile[] : [];
    setStyleDnaProfiles(profiles);
    setSelectedStyleDnaId((current) => {
      if (!current) {
        return current;
      }
      return profiles.some((item) => String(item.id) === current) ? current : '';
    });
  };

  const loadOpenRouterOptions = async (query: string) => {
    setOpenRouterModelsError(null);

    try {
      const searchParams = new URLSearchParams();
      if (query.trim()) {
        searchParams.set('q', query.trim());
      }
      searchParams.set('limit', '24');

      const response = await fetch(`/api/openrouter/models?${searchParams.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load OpenRouter models.');
      }

      const models = Array.isArray(data.data) ? data.data as OpenRouterModelApiItem[] : [];
      return models.map(mapOpenRouterModelToOption);
    } catch (err) {
      console.error('Failed to load OpenRouter models', err);
      setOpenRouterModelsError(getErrorMessage(err));
      return [];
    }
  };

  const loadOpenRouterFavorites = async () => {
    const response = await fetch('/api/openrouter/favorites');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load OpenRouter favorites.');
    }

    const favorites = Array.isArray(data.data)
      ? data.data as OpenRouterModelOption[]
      : [];

    setFavoriteOpenRouterModels(
      dedupeOpenRouterFavorites(
        favorites
          .map(normalizeOpenRouterFavorite)
          .filter((item): item is OpenRouterModelOption => item !== null),
      ).slice(0, MAX_OPENROUTER_FAVORITES),
    );
  };

  const loadThreadsStatus = async () => {
    const response = await fetch('/api/threads/status');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load Threads connection status.');
    }

    setThreadsConnection((data.data as ThreadsConnectionStatus | undefined) ?? null);
  };

  const loadWorkflows = async () => {
    const response = await fetch('/api/workflows');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load workflows.');
    }

    setWorkflows(Array.isArray(data.data) ? data.data as Workflow[] : []);
  };

  useEffect(() => {
    void loadSavedPrompts().catch((err) => console.error('Failed to load saved prompts', err));
    void loadAvailableImages().catch((err) => console.error('Failed to load images', err));
    void loadCartesiaVoices();
    void loadSavedAudioClips();
    void loadSystemPrompts().catch((err) => console.error('Failed to load system prompts', err));
    void loadStyleDnaProfiles().catch((err) => console.error('Failed to load Style DNA profiles', err));
    void loadOpenRouterFavorites().catch((err) => console.error('Failed to load OpenRouter favorites', err));
    void loadThreadsStatus().catch((err) => console.error('Failed to load Threads status', err));
    void loadWorkflows().catch((err) => console.error('Failed to load workflows', err));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const threadsStatus = url.searchParams.get('threads');
    const threadsMessage = url.searchParams.get('threads_message');

    if (!threadsStatus) {
      return;
    }

    if (threadsStatus === 'connected') {
      setAlertDialog({
        title: 'Threads connected',
        message: 'Your Threads account is now connected and ready for publishing.',
        confirmLabel: 'Nice',
      });
      void loadThreadsStatus().catch((err) => console.error('Failed to refresh Threads status', err));
    } else if (threadsStatus === 'error') {
      setAlertDialog({
        title: 'Threads connection failed',
        message: threadsMessage || 'The Threads OAuth flow did not complete successfully.',
        confirmLabel: 'Close',
      });
    }

    url.searchParams.delete('threads');
    url.searchParams.delete('threads_message');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!alertDialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAlertDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alertDialog]);

  useEffect(() => {
    return () => {
      const cleanup = ttsCleanupRef.current;
      ttsCleanupRef.current = null;

      if (cleanup) {
        void cleanup();
      }
    };
  }, []);

  const cleanupTtsPlayback = async () => {
    const cleanup = ttsCleanupRef.current;
    ttsCleanupRef.current = null;

    if (cleanup) {
      await cleanup();
    }
  };

  const stopTtsPlayback = async () => {
    ttsRequestIdRef.current += 1;
    await cleanupTtsPlayback();
    setTtsPreviewLoading(false);
  };

  const handlePreviewPrompt = async () => {
    if (ttsPreviewLoading) {
      await stopTtsPlayback();
      return;
    }

    const transcript = ttsPrompt.trim();
    if (!transcript) {
      setAlertDialog({
        title: 'Speech prompt needed',
        message: 'Write a text prompt first, then start the Cartesia preview.',
        confirmLabel: 'Okay',
      });
      return;
    }

    if (!selectedTtsVoiceId) {
      setAlertDialog({
        title: 'Voice needed',
        message: 'Choose one of your Cartesia voices before starting the preview.',
        confirmLabel: 'Okay',
      });
      return;
    }

    await stopTtsPlayback();

    const requestId = ttsRequestIdRef.current + 1;
    ttsRequestIdRef.current = requestId;
    setTtsPreviewLoading(true);

    let ws: Awaited<ReturnType<Cartesia['tts']['websocket']>> | null = null;
    let audioContext: AudioContext | null = null;

    const cleanup = async () => {
      try {
        ws?.close();
      } catch {
        // Ignore teardown failures.
      }

      if (audioContext && audioContext.state !== 'closed') {
        try {
          await audioContext.close();
        } catch {
          // Ignore teardown failures.
        }
      }
    };

    ttsCleanupRef.current = cleanup;

    try {
      const token = await getCartesiaToken();
      const client = new Cartesia({ token });
      ws = await client.tts.websocket();

      audioContext = new AudioContext({ sampleRate: CARTESIA_SAMPLE_RATE });
      await audioContext.resume();

      let nextStartTime = audioContext.currentTime;
      const stream = ws.generate({
        model_id: 'sonic-3.5',
        transcript,
        voice: { mode: 'id', id: selectedTtsVoiceId },
        output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: CARTESIA_SAMPLE_RATE },
      });

      for await (const event of stream) {
        if (requestId !== ttsRequestIdRef.current) {
          break;
        }

        if (event.type !== 'chunk' || !event.audio) {
          continue;
        }

        const aligned = new ArrayBuffer(event.audio.byteLength);
        new Uint8Array(aligned).set(event.audio);
        const floats = new Float32Array(aligned);
        const buffer = audioContext.createBuffer(1, floats.length, CARTESIA_SAMPLE_RATE);
        buffer.getChannelData(0).set(floats);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        const startTime = Math.max(nextStartTime, audioContext.currentTime);
        source.start(startTime);
        nextStartTime = startTime + buffer.duration;
      }

      const remainingMs = Math.max(0, nextStartTime - audioContext.currentTime) * 1000;
      if (remainingMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
      }
    } catch (err) {
      if (requestId === ttsRequestIdRef.current) {
        console.error('Cartesia preview failed', err);
        showErrorDialog('Voice preview failed', err);
      }
    } finally {
      await cleanup();

      if (requestId === ttsRequestIdRef.current) {
        ttsCleanupRef.current = null;
        setTtsPreviewLoading(false);
      }
    }
  };

  const handleGenerateAudio = async () => {
    const transcript = ttsPrompt.trim();
    if (!transcript) {
      setAlertDialog({
        title: 'Speech prompt needed',
        message: 'Write a text prompt first, then generate a saved audio file.',
        confirmLabel: 'Okay',
      });
      return;
    }

    if (!selectedTtsVoiceId) {
      setAlertDialog({
        title: 'Voice needed',
        message: 'Choose one of your Cartesia voices before generating audio.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setTtsGenerating(true);
    await stopTtsPlayback();

    try {
      const response = await axios.post('/api/cartesia/generate', {
        prompt: transcript,
        voiceId: selectedTtsVoiceId,
        voiceName: selectedTtsVoice?.name ?? null,
      });

      const clip = response.data?.data as GeneratedAudioClip | undefined;
      if (!clip?.url) {
        throw new Error('Cartesia did not return a saved audio file.');
      }

      await loadSavedAudioClips();
      setAlertDialog({
        title: 'Audio saved',
        message: `${selectedTtsVoice?.name ?? 'Voice render'} was stored on the server and added to your saved clips.`,
        confirmLabel: 'Nice',
      });
    } catch (err) {
      console.error('Cartesia generation failed', err);
      showErrorDialog('Audio generation failed', err);
    } finally {
      setTtsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    const finalPrompt = composedImagePrompt.trim();
    if (!finalPrompt) {
      setAlertDialog({
        title: 'Image prompt needed',
        message: 'Write a main prompt or use the prefix/suffix fields before generating an image.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/generate', {
        prompt: finalPrompt,
        width,
        height,
        batchSize,
        model,
        quality,
        inputImages,
      });

      const urls: string[] = [];
      const generatedItems = response.data?.data;

      if (Array.isArray(generatedItems)) {
        generatedItems.forEach((item: { url?: string }) => {
          if (item?.url) {
            urls.push(item.url);
          }
        });
      } else if (model === 'a2e') {
        const responseData = response.data?.data;
        if (responseData && Array.isArray(responseData.images)) {
          urls.push(...responseData.images);
        } else {
          console.log('A2E task response', response.data);
        }
      }

      setGenerated(urls.map((url) => ({ url })));
      await loadAvailableImages();
    } catch (err) {
      console.error(err);
      showErrorDialog('Generation failed', err, 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrompt = async () => {
    const text = composedImagePrompt.trim();
    if (!text) {
      return;
    }

    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    await loadSavedPrompts();
  };

  const handleDeletePrompt = async (id: number) => {
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' });
    await loadSavedPrompts();
  };

  const handleSaveSystemPrompt = async () => {
    const name = systemPromptName.trim();
    const text = systemPromptText.trim();

    if (!name || !text) {
      setAlertDialog({
        title: 'System prompt needed',
        message: 'Give the system prompt a name and body before saving it.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setSystemPromptSaving(true);
    try {
      await fetch('/api/system-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, text }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save system prompt.');
        }
      });

      setSystemPromptName('');
      setSystemPromptText('');
      await loadSystemPrompts();
      setAlertDialog({
        title: 'System prompt saved',
        message: `"${name}" is ready to use from the Prompt Writer dropdown.`,
        confirmLabel: 'Nice',
      });
    } catch (err) {
      console.error('Failed to save system prompt', err);
      showErrorDialog('Save failed', err);
    } finally {
      setSystemPromptSaving(false);
    }
  };

  const handleDeleteSystemPrompt = async (id: number) => {
    try {
      await fetch(`/api/system-prompts?id=${id}`, { method: 'DELETE' }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete system prompt.');
        }
      });

      if (selectedSystemPromptId === String(id)) {
        setSelectedSystemPromptId('');
      }

      await loadSystemPrompts();
    } catch (err) {
      console.error('Failed to delete system prompt', err);
      showErrorDialog('Delete failed', err);
    }
  };

  const handleGenerateText = async () => {
    const input = geminiInput.trim();
    if (!input) {
      setAlertDialog({
        title: 'Text input needed',
        message: 'Write a one-shot request before generating text.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setGeminiLoading(true);

    try {
      const systemPromptId = selectedSystemPromptId ? Number(selectedSystemPromptId) : null;
      const styleDnaId = selectedStyleDnaId ? Number(selectedStyleDnaId) : null;
      const response = textProvider === 'openrouter'
        ? await axios.post('/api/openrouter/generate', {
          input,
          model: openRouterModel.value,
          styleDnaId,
          systemPromptId,
        })
        : await axios.post('/api/gemini/generate', {
          input,
          styleDnaId,
          systemPromptId,
        });

      const result = response.data?.data as TextGenerationResult | undefined;
      if (!result?.text?.trim()) {
        throw new Error('The model returned an empty response.');
      }

      setGeminiResult(result);
      setGeminiOutputText(result.text);
    } catch (err) {
      console.error('Text generation failed', err);
      showErrorDialog(textProvider === 'openrouter' ? 'OpenRouter generation failed' : 'Gemini generation failed', err);
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleAnalyzeStyleDna = async () => {
    const samples = styleDnaSamples.trim();
    if (samples.length < 80) {
      setAlertDialog({
        title: 'More writing needed',
        message: 'Paste at least a paragraph or two before extracting Style DNA.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setStyleDnaAnalyzing(true);
    setStyleDnaDraftProfile(null);

    try {
      const response = await axios.post('/api/style-dna/analyze', {
        samples,
        provider: 'openrouter',
        model: openRouterModel.value,
      });

      const profile = response.data?.data?.profile as StyleDnaProfile | undefined;
      if (!profile) {
        throw new Error('The model did not return a usable Style DNA profile.');
      }

      setStyleDnaDraftProfile(profile);
    } catch (err) {
      console.error('Style DNA analysis failed', err);
      showErrorDialog('Style DNA extraction failed', err);
    } finally {
      setStyleDnaAnalyzing(false);
    }
  };

  const handleSaveStyleDna = async () => {
    const name = styleDnaName.trim();

    if (!name || !styleDnaDraftProfile) {
      setAlertDialog({
        title: 'Style DNA needed',
        message: 'Extract a Style DNA profile and give it a name before saving it.',
        confirmLabel: 'Okay',
      });
      return;
    }

    setStyleDnaSaving(true);

    try {
      const response = await fetch('/api/style-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, profile: styleDnaDraftProfile }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save Style DNA.');
      }

      const saved = data.data as SavedStyleDnaProfile | undefined;
      setStyleDnaName('');
      setStyleDnaSamples('');
      setStyleDnaDraftProfile(null);
      await loadStyleDnaProfiles();
      if (saved?.id) {
        setSelectedStyleDnaId(String(saved.id));
      }
      setAlertDialog({
        title: 'Style DNA saved',
        message: `"${name}" is now available from the Prompt Writer Style DNA dropdown.`,
        confirmLabel: 'Nice',
      });
    } catch (err) {
      console.error('Failed to save Style DNA', err);
      showErrorDialog('Save failed', err);
    } finally {
      setStyleDnaSaving(false);
    }
  };

  const handleDeleteStyleDna = async (id: number) => {
    try {
      await fetch(`/api/style-dna?id=${id}`, { method: 'DELETE' }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete Style DNA.');
        }
      });

      if (selectedStyleDnaId === String(id)) {
        setSelectedStyleDnaId('');
      }

      await loadStyleDnaProfiles();
    } catch (err) {
      console.error('Failed to delete Style DNA', err);
      showErrorDialog('Delete failed', err);
    }
  };

  const handlePublishToThreads = async () => {
    if (!threadsConnection?.configured) {
      setAlertDialog({
        title: 'Threads not configured',
        message: 'Add THREADS_APP_ID and THREADS_APP_SECRET before connecting Threads.',
        confirmLabel: 'Okay',
      });
      return;
    }

    if (!threadsConnection.connected) {
      if (typeof window !== 'undefined') {
        const returnTo = encodeURIComponent(window.location.pathname);
        window.location.assign(`/api/threads/oauth/start?returnTo=${returnTo}`);
      }
      return;
    }

    const text = geminiOutputText.trim();
    if (!text) {
      setAlertDialog({
        title: 'Nothing to publish',
        message: 'Generate a text result first, then publish it to Threads.',
        confirmLabel: 'Okay',
      });
      return;
    }

    if (text.length > 500) {
      setAlertDialog({
        title: 'Threads limit exceeded',
        message: `Threads text posts are limited to 500 characters. Your current edited output is ${text.length} characters.`,
        confirmLabel: 'Okay',
      });
      return;
    }

    setThreadsPublishing(true);

    try {
      const response = await axios.post('/api/threads/publish', { text });
      const permalink = typeof response.data?.data?.permalink === 'string' ? response.data.data.permalink : null;
      setAlertDialog({
        title: 'Published to Threads',
        message: permalink
          ? `Your generated text is live on Threads.\n${permalink}`
          : 'Your generated text was published to Threads.',
        confirmLabel: 'Nice',
      });
    } catch (err) {
      console.error('Threads publish failed', err);
      showErrorDialog('Threads publish failed', err);
    } finally {
      setThreadsPublishing(false);
    }
  };

  const addReferenceImages = (images: string[]) => {
    setInputImages((prev) => {
      const next = [...prev];
      images.forEach((image) => {
        if (!next.includes(image)) {
          next.push(image);
        }
      });
      return next;
    });
  };

  const removeReferenceImage = (url: string) => {
    setInputImages((prev) => prev.filter((item) => item !== url));
  };

  const clearReferenceImages = () => {
    setInputImages([]);
  };

  const toggleReferenceImage = (url: string) => {
    let absolute = url;
    if (url.startsWith('/') && typeof window !== 'undefined' && window.location) {
      absolute = `${window.location.origin}${url}`;
    }

    setInputImages((prev) => (
      prev.includes(absolute)
        ? prev.filter((item) => item !== absolute)
        : [...prev, absolute]
    ));
  };

  const setGeminiAspectRatio = (aspectRatio: GeminiAspectRatio) => {
    const preset = GEMINI_ASPECT_RATIO_DIMENSIONS[aspectRatio];
    setWidth(preset.width);
    setHeight(preset.height);
  };

  const selectOpenRouterModel = (option: OpenRouterModelOption) => {
    setOpenRouterModel(option);
    setOpenRouterModelsError(null);
  };

  const addOpenRouterFavorite = async () => {
    try {
      const response = await fetch('/api/openrouter/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: openRouterModel }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save OpenRouter favorite.');
      }

      const favorites = Array.isArray(data.data) ? data.data as OpenRouterModelOption[] : [];
      setFavoriteOpenRouterModels(favorites);
    } catch (err) {
      console.error('Failed to save OpenRouter favorite', err);
      showErrorDialog('OpenRouter favorite failed', err);
    }
  };

  const removeOpenRouterFavorite = async (value: string) => {
    try {
      const searchParams = new URLSearchParams({ value });
      const response = await fetch(`/api/openrouter/favorites?${searchParams.toString()}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to remove OpenRouter favorite.');
      }

      const favorites = Array.isArray(data.data) ? data.data as OpenRouterModelOption[] : [];
      setFavoriteOpenRouterModels(favorites);
    } catch (err) {
      console.error('Failed to remove OpenRouter favorite', err);
      showErrorDialog('OpenRouter favorite failed', err);
    }
  };

  const applyGeminiTextToImagePrompt = () => {
    if (!geminiOutputText.trim()) {
      return;
    }
    setPrompt(geminiOutputText.trim());
  };

  const applyGeminiTextToVoicePrompt = () => {
    if (!geminiOutputText.trim()) {
      return;
    }
    setTtsPrompt(geminiOutputText.trim());
  };

  const createWorkflowFromSegments = async (title: string, segments: WorkflowSegmentDraft[]) => {
    setWorkflowSaving(true);

    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, segments }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create workflow.');
      }

      await loadWorkflows();
      setAlertDialog({
        title: 'Workflow saved',
        message: `"${title}" is now available on the workflow board.`,
        confirmLabel: 'Nice',
      });
    } catch (err) {
      console.error('Failed to create workflow', err);
      showErrorDialog('Workflow save failed', err);
    } finally {
      setWorkflowSaving(false);
    }
  };

  const generateWorkflowImage = async (segment: WorkflowSegment) => {
    const segmentPrompt = (segment.image_prompt || segment.text).trim();
    if (!segmentPrompt) {
      throw new Error('This workflow segment needs text or an image prompt before generating an image.');
    }

    setPrompt(segmentPrompt);
    setLoading(true);

    try {
      const finalPrompt = [promptPrefix.trim(), segmentPrompt, promptSuffix.trim()]
        .filter(Boolean)
        .join('\n\n');
      const response = await axios.post('/api/generate', {
        prompt: finalPrompt,
        width,
        height,
        batchSize: 1,
        model,
        quality,
        inputImages,
      });

      const urls: string[] = [];
      const generatedItems = response.data?.data;

      if (Array.isArray(generatedItems)) {
        generatedItems.forEach((item: { url?: string }) => {
          if (item?.url) {
            urls.push(item.url);
          }
        });
      } else if (model === 'a2e') {
        const responseData = response.data?.data;
        if (responseData && Array.isArray(responseData.images)) {
          urls.push(...responseData.images);
        }
      }

      if (urls.length === 0) {
        throw new Error('Image generation completed without returning an image URL.');
      }

      setGenerated(urls.map((url) => ({ url })));
      await loadAvailableImages();
      return urls[0];
    } finally {
      setLoading(false);
    }
  };

  const loadSystemPromptIntoEditor = (item: SystemPrompt) => {
    setSystemPromptName(item.name);
    setSystemPromptText(item.text);
  };

  return (
    <>
      <nav className="floating-shortcuts" aria-label="Tool shortcuts">
        {FLOATING_SHORTCUTS.map((shortcut) => (
          <a key={shortcut.href} className="floating-shortcut-link" href={shortcut.href}>
            <span aria-hidden="true" className="floating-shortcut-dot" />
            <span className="floating-shortcut-short">{shortcut.shortLabel}</span>
            <span className="floating-shortcut-label">{shortcut.label}</span>
          </a>
        ))}
      </nav>

      <div className="min-h-screen p-6">
        <section id="cockpit" className="shortcut-target" aria-label="Connected cockpit">
          <ConnectedCockpitSection
            threadsConnection={threadsConnection}
            onConnectThreads={() => {
              if (typeof window !== 'undefined') {
                const returnTo = encodeURIComponent(window.location.pathname);
                window.location.assign(`/api/threads/oauth/start?returnTo=${returnTo}`);
              }
            }}
          />
        </section>

        <h1 className="text-2xl font-bold mb-4">AI Image + Voice Studio</h1>

        <section id="image-studio" className="shortcut-target" aria-label="Image studio">
          <ImageStudioSection
            availableImages={availableImages}
            batchSize={batchSize}
            geminiAspectRatio={geminiAspectRatio}
            height={height}
            inputPrompt={prompt}
            inputPromptPrefix={promptPrefix}
            inputPromptSuffix={promptSuffix}
            inputReferenceImages={inputImages}
            isGeminiModel={isGeminiModel}
            isOpenAiModel={isOpenAiModel}
            isSavingDisabled={!composedImagePrompt.trim()}
            isSubmitting={loading}
            model={model}
            quality={quality}
            savedPrompts={savedPrompts}
            totalCost={totalCost}
            width={width}
            onAddReferenceImages={addReferenceImages}
            onBatchSizeChange={setBatchSize}
            onClearPrompt={() => {
              setPromptPrefix('');
              setPrompt('');
              setPromptSuffix('');
            }}
            onClearReferenceImages={clearReferenceImages}
            onDeleteSavedPrompt={(id) => { void handleDeletePrompt(id); }}
            onGenerateImage={() => { void handleGenerate(); }}
            onGeminiAspectRatioChange={setGeminiAspectRatio}
            onHeightChange={setHeight}
            onLoadSavedPromptToMain={setPrompt}
            onLoadSavedPromptToPrefix={setPromptPrefix}
            onLoadSavedPromptToSuffix={setPromptSuffix}
            onModelChange={setModel}
            onPromptChange={setPrompt}
            onPromptPrefixChange={setPromptPrefix}
            onPromptSuffixChange={setPromptSuffix}
            onQualityChange={setQuality}
            onRemoveReferenceImage={removeReferenceImage}
            onSavePrompt={() => { void handleSavePrompt(); }}
            onTogglePreviousImage={toggleReferenceImage}
            onWidthChange={setWidth}
          />
        </section>

        <section id="voice-generator" className="shortcut-target" aria-label="Voice generator">
          <VoiceGeneratorSection
            prompt={ttsPrompt}
            savedAudioClips={savedAudioClips}
            selectedVoice={selectedTtsVoice}
            selectedVoiceId={selectedTtsVoiceId}
            voices={ttsVoices}
            voicesError={ttsVoicesError}
            voicesLoading={ttsVoicesLoading}
            isGeneratingAudio={ttsGenerating}
            isPreviewing={ttsPreviewLoading}
            onGenerateAudio={() => { void handleGenerateAudio(); }}
            onPreviewPrompt={() => { void handlePreviewPrompt(); }}
            onPromptChange={setTtsPrompt}
            onRefreshSavedAudio={() => { void loadSavedAudioClips(); }}
            onSelectedVoiceIdChange={setSelectedTtsVoiceId}
          />
        </section>

        <section id="style-dna" className="shortcut-target" aria-label="Style DNA">
          <StyleDnaSection
            analysisEngineLabel={styleDnaEngineLabel}
            draftName={styleDnaName}
            draftProfile={styleDnaDraftProfile}
            isAnalyzing={styleDnaAnalyzing}
            isSaving={styleDnaSaving}
            samples={styleDnaSamples}
            savedProfiles={styleDnaProfiles}
            selectedStyleDnaId={selectedStyleDnaId}
            onAnalyze={() => { void handleAnalyzeStyleDna(); }}
            onClearDraft={() => {
              setStyleDnaName('');
              setStyleDnaSamples('');
              setStyleDnaDraftProfile(null);
            }}
            onDeleteProfile={(id) => { void handleDeleteStyleDna(id); }}
            onDraftNameChange={setStyleDnaName}
            onSamplesChange={setStyleDnaSamples}
            onSave={() => { void handleSaveStyleDna(); }}
            onSelectProfileForWriter={setSelectedStyleDnaId}
          />
        </section>

        <section id="prompt-writer" className="shortcut-target" aria-label="Prompt writer">
          <PromptWriterSection
            currentInput={geminiInput}
            currentOutputText={geminiOutputText}
            currentResult={geminiResult}
            currentStyleDna={selectedStyleDna}
            currentSystemPrompt={selectedSystemPrompt}
            favoriteOpenRouterModels={favoriteOpenRouterModels}
            isSelectedOpenRouterFavorite={isSelectedOpenRouterFavorite}
            openRouterModel={openRouterModel}
            openRouterModelsError={openRouterModelsError}
            outputCharacterCount={outputCharacterCount}
            provider={textProvider}
            selectedStyleDnaId={selectedStyleDnaId}
            selectedSystemPromptId={selectedSystemPromptId}
            styleDnaProfiles={styleDnaProfiles}
            systemPromptDraftName={systemPromptName}
            systemPromptDraftText={systemPromptText}
            systemPromptSaving={systemPromptSaving}
            systemPrompts={systemPrompts}
            isCreatingWorkflow={workflowSaving}
            isGenerating={geminiLoading}
            isPublishingToThreads={threadsPublishing}
            isThreadsLengthExceeded={isThreadsLengthExceeded}
            isThreadsReady={isThreadsReady}
            onApplyTextToImagePrompt={applyGeminiTextToImagePrompt}
            onApplyTextToVoicePrompt={applyGeminiTextToVoicePrompt}
            onAddOpenRouterFavorite={() => { void addOpenRouterFavorite(); }}
            onClearSystemPromptDraft={() => {
              setSystemPromptName('');
              setSystemPromptText('');
            }}
            onCreateWorkflowFromSegments={createWorkflowFromSegments}
            onCurrentInputChange={setGeminiInput}
            onCurrentOutputTextChange={setGeminiOutputText}
            onDeleteSystemPrompt={(id) => { void handleDeleteSystemPrompt(id); }}
            onGenerateText={() => { void handleGenerateText(); }}
            onLoadOpenRouterOptions={loadOpenRouterOptions}
            onLoadSystemPromptIntoEditor={loadSystemPromptIntoEditor}
            onPublishToThreads={() => { void handlePublishToThreads(); }}
            onProviderChange={setTextProvider}
            onRemoveOpenRouterFavorite={(value) => { void removeOpenRouterFavorite(value); }}
            onSaveSystemPrompt={() => { void handleSaveSystemPrompt(); }}
            onSelectOpenRouterModel={selectOpenRouterModel}
            onSelectQuickOpenRouterFavorite={selectOpenRouterModel}
            onSelectedStyleDnaIdChange={setSelectedStyleDnaId}
            onSelectedSystemPromptIdChange={setSelectedSystemPromptId}
            onSystemPromptDraftNameChange={setSystemPromptName}
            onSystemPromptDraftTextChange={setSystemPromptText}
          />
        </section>

        <section id="workflows" className="shortcut-target" aria-label="Workflows">
          <WorkflowBoardSection
            isLoading={loading || ttsGenerating}
            selectedVoice={selectedTtsVoice}
            workflows={workflows}
            onError={showErrorDialog}
            onGenerateImage={generateWorkflowImage}
            onReload={loadWorkflows}
          />
        </section>

      </div>

      {alertDialog && (
        <AlertDialog alertDialog={alertDialog} onClose={closeAlertDialog} />
      )}
    </>
  );
}
