'use client';

import Cartesia from '@cartesia/cartesia-js';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import AsyncCreatableSelect from 'react-select/async-creatable';
import type { SingleValue } from 'react-select';
import { estimateTotalCost } from '../lib/cost';
import {
  GEMINI_ASPECT_RATIO_DIMENSIONS,
  GEMINI_ASPECT_RATIOS,
  getClosestGeminiAspectRatio,
  isGeminiImageModel,
  isOpenAiImageModel,
  type GeminiAspectRatio,
  type ImageGenerationModel,
} from '../lib/image-models';

const CARTESIA_SAMPLE_RATE = 44100;

interface GeneratedImage {
  url: string;
}

interface AlertDialogState {
  title: string;
  message: string;
  confirmLabel: string;
}

interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  isOwner: boolean;
  createdAt: string;
}

interface GeneratedAudioClip {
  createdAt?: string | null;
  filename: string;
  promptPreview?: string | null;
  url: string;
  voiceId?: string | null;
  voiceName?: string | null;
}

interface SystemPrompt {
  id: number;
  name: string;
  text: string;
  created_at: string;
}

interface SavedPrompt {
  created_at?: string;
  id: number;
  text: string;
}

type TextProvider = 'gemini' | 'openrouter';

interface OpenRouterModelOption {
  completionPrice?: string | null;
  contextLength?: number | null;
  label: string;
  promptPrice?: string | null;
  requestPrice?: string | null;
  value: string;
}

interface OpenRouterModelApiItem {
  completionPrice?: string | null;
  contextLength?: number | null;
  id: string;
  name: string;
  promptPrice?: string | null;
  requestPrice?: string | null;
}

interface TextGenerationResult {
  model: string;
  provider: TextProvider;
  resolvedModel?: string | null;
  systemPromptName?: string | null;
  text: string;
}

function mapOpenRouterModelToOption(item: OpenRouterModelApiItem): OpenRouterModelOption {
  return {
    value: item.id,
    label: item.name,
    contextLength: item.contextLength ?? null,
    promptPrice: item.promptPrice ?? null,
    completionPrice: item.completionPrice ?? null,
    requestPrice: item.requestPrice ?? null,
  };
}

function createOpenRouterCustomOption(value: string): OpenRouterModelOption {
  return {
    value,
    label: value,
    contextLength: null,
    promptPrice: null,
    completionPrice: null,
    requestPrice: null,
  };
}

const OPENROUTER_FREE_OPTION: OpenRouterModelOption = {
  value: 'openrouter/free',
  label: 'OpenRouter Free Router',
  contextLength: null,
  promptPrice: '0',
  completionPrice: '0',
  requestPrice: '0',
};

const OPENROUTER_AUTO_OPTION: OpenRouterModelOption = {
  value: 'openrouter/auto',
  label: 'OpenRouter Auto Router',
  contextLength: null,
  promptPrice: null,
  completionPrice: null,
  requestPrice: null,
};

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
  const [prompt, setPrompt] = useState('');
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
  const [systemPromptSaving, setSystemPromptSaving] = useState(false);
  const [textProvider, setTextProvider] = useState<TextProvider>('gemini');
  const [openRouterModel, setOpenRouterModel] = useState<OpenRouterModelOption>(OPENROUTER_FREE_OPTION);
  const [openRouterModelsError, setOpenRouterModelsError] = useState<string | null>(null);
  const [geminiInput, setGeminiInput] = useState('');
  const [geminiResult, setGeminiResult] = useState<TextGenerationResult | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null);
  const ttsCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const ttsRequestIdRef = useRef(0);

  const selectedTtsVoice = ttsVoices.find((voice) => voice.id === selectedTtsVoiceId) ?? null;
  const selectedSystemPrompt = systemPrompts.find((item) => String(item.id) === selectedSystemPromptId) ?? null;
  const isOpenAiModel = isOpenAiImageModel(model);
  const isGeminiModel = isGeminiImageModel(model);
  const geminiAspectRatio = getClosestGeminiAspectRatio(width, height);
  const totalCost = estimateTotalCost(isOpenAiModel ? model : null, quality, width, height, batchSize);

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
    if (Array.isArray(data.uploads)) images.push(...data.uploads);
    if (Array.isArray(data.generated)) images.push(...data.generated);

    const absoluteImages = images.map((img) => {
      if (img.startsWith('/') && typeof window !== 'undefined' && window.location) {
        return `${window.location.origin}${img}`;
      }
      return img;
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
      if (!current) return current;
      return prompts.some((item) => String(item.id) === current) ? current : '';
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

  useEffect(() => {
    void loadSavedPrompts().catch((err) => console.error('Failed to load saved prompts', err));
    void loadAvailableImages().catch((err) => console.error('Failed to load images', err));
    void loadCartesiaVoices();
    void loadSavedAudioClips();
    void loadSystemPrompts().catch((err) => console.error('Failed to load system prompts', err));
  }, []);

  useEffect(() => {
    if (!alertDialog) return;

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
    setLoading(true);
    try {
      const response = await axios.post('/api/generate', {
        prompt,
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
        generatedItems.forEach((item: any) => {
          if (item?.url) {
            urls.push(item.url);
          }
        });
      } else if (model === 'a2e') {
        const resData = response.data?.data;
        if (resData && Array.isArray(resData.images)) {
          urls.push(...resData.images);
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
    if (!prompt) return;
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt }),
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
        message: `"${name}" is ready to use from the Gemini dropdown.`,
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
      const response = textProvider === 'openrouter'
        ? await axios.post('/api/openrouter/generate', {
          input,
          model: openRouterModel.value,
          systemPromptId,
        })
        : await axios.post('/api/gemini/generate', {
          input,
          systemPromptId,
        });

      const result = response.data?.data as TextGenerationResult | undefined;
      if (!result?.text?.trim()) {
        throw new Error('The model returned an empty response.');
      }

      setGeminiResult(result);
    } catch (err) {
      console.error('Text generation failed', err);
      showErrorDialog(textProvider === 'openrouter' ? 'OpenRouter generation failed' : 'Gemini generation failed', err);
    } finally {
      setGeminiLoading(false);
    }
  };

  const addReferenceImage = (url: string) => {
    let absolute = url;
    if (url.startsWith('/') && typeof window !== 'undefined' && window.location) {
      absolute = `${window.location.origin}${url}`;
    }
    setInputImages((prev) => [...prev, absolute]);
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

  const applyGeminiTextToImagePrompt = () => {
    if (!geminiResult?.text?.trim()) return;
    setPrompt(geminiResult.text.trim());
  };

  const applyGeminiTextToVoicePrompt = () => {
    if (!geminiResult?.text?.trim()) return;
    setTtsPrompt(geminiResult.text.trim());
  };

  const loadSystemPromptIntoEditor = (item: SystemPrompt) => {
    setSystemPromptName(item.name);
    setSystemPromptText(item.text);
  };

  return (
    <>
      <div className="min-h-screen p-6">
          <h1 className="text-2xl font-bold mb-4">AI Image + Voice Studio</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Image Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-2 border rounded"
                rows={4}
              />
              <div className="flex space-x-2 mt-1">
                <button onClick={handleSavePrompt} className="px-3 py-1 bg-blue-500 text-white rounded">Save</button>
                <button onClick={() => setPrompt('')} className="px-3 py-1 bg-gray-300 rounded">Clear</button>
              </div>

              <div className="system-prompt-library">
                <div className="system-prompt-library-header">
                  <strong>Saved image prompts</strong>
                  <span className="system-prompt-count">{savedPrompts.length}</span>
                </div>
                <div className="system-prompt-list">
                  {savedPrompts.length === 0 && (
                    <p className="audio-empty-copy">No saved image prompts yet.</p>
                  )}

                  {savedPrompts.map((item) => (
                    <div key={item.id} className="system-prompt-card">
                      <div className="system-prompt-card-header">
                        <strong>Prompt #{item.id}</strong>
                        {item.created_at && <span className="audio-date">{new Date(item.created_at).toLocaleDateString()}</span>}
                      </div>
                      <p className="system-prompt-preview">{item.text}</p>
                      <div className="system-prompt-actions">
                        <button type="button" className="gemini-secondary-button" onClick={() => setPrompt(item.text)}>
                          Load
                        </button>
                        <button type="button" className="system-prompt-delete" onClick={() => { void handleDeletePrompt(item.id); }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-1">Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value as ImageGenerationModel)} className="w-full p-2 border rounded mb-2">
                <option value="gpt-image-2">GPT Image 2</option>
                <option value="gpt-image-1.5">GPT Image 1.5</option>
                <option value="gpt-image-1">GPT Image 1</option>
                <option value="gpt-image-1-mini">GPT Image 1 Mini</option>
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                <option value="a2e">A2E</option>
              </select>

              <label className="block mb-1">Quality</label>
              <div className="flex space-x-3 mb-2">
                {['low', 'medium', 'high'].map((q) => (
                  <label key={q} className={`inline-flex items-center ${isOpenAiModel ? '' : 'opacity-50'}`}>
                    <input
                      type="radio"
                      className="mr-1"
                      value={q}
                      checked={quality === q}
                      onChange={() => setQuality(q as 'low' | 'medium' | 'high')}
                      disabled={!isOpenAiModel}
                    />
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </label>
                ))}
              </div>
              {!isOpenAiModel && (
                <p className="text-sm text-gray-600 mb-2">
                  Quality only applies to GPT Image models. Gemini uses aspect ratio, and A2E ignores this control.
                </p>
              )}

              {isGeminiModel ? (
                <>
                  <label className="block mb-1">Aspect Ratio</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {GEMINI_ASPECT_RATIOS.map((aspectRatio) => (
                      <button
                        key={aspectRatio}
                        type="button"
                        onClick={() => setGeminiAspectRatio(aspectRatio)}
                        className={`px-2 py-1 rounded border ${geminiAspectRatio === aspectRatio ? 'bg-green-500 text-white border-green-500' : 'bg-gray-100 border-gray-300'}`}
                      >
                        {aspectRatio}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Gemini 2.5 Flash Image uses aspect ratio instead of exact pixels. The current image shape maps to <strong>{geminiAspectRatio}</strong>.
                  </p>
                </>
              ) : (
                <>
                  <label className="block mb-1">Resolution</label>
                  <div className="flex space-x-2 mb-2">
                    <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-20 p-1 border rounded" placeholder="Width" />
                    <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-20 p-1 border rounded" placeholder="Height" />
                    <div className="flex space-x-1">
                      <button onClick={() => { setWidth(1024); setHeight(1024); }} className="px-2 py-1 bg-gray-200 rounded">1024x1024</button>
                      <button onClick={() => { setWidth(1024); setHeight(1536); }} className="px-2 py-1 bg-gray-200 rounded">1024x1536</button>
                      <button onClick={() => { setWidth(1536); setHeight(1024); }} className="px-2 py-1 bg-gray-200 rounded">1536x1024</button>
                    </div>
                  </div>
                </>
              )}

              <label className="block mb-1">Batch Size</label>
              <div className="flex space-x-2 mb-4">
                <input type="number" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="w-20 p-1 border rounded" />
                <button onClick={() => setBatchSize(1)} className="px-2 py-1 bg-gray-200 rounded">1</button>
                <button onClick={() => setBatchSize(4)} className="px-2 py-1 bg-gray-200 rounded">4</button>
                <button onClick={() => setBatchSize(8)} className="px-2 py-1 bg-gray-200 rounded">8</button>
              </div>

              <label className="block mb-1">Reference Images</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  const dataUrls: string[] = [];
                  for (const file of files) {
                    const reader = new FileReader();
                    const urlPromise = new Promise<string>((resolve) => {
                      reader.onloadend = () => resolve(reader.result as string);
                    });
                    reader.readAsDataURL(file);
                    dataUrls.push(await urlPromise);
                  }
                  setInputImages(dataUrls);
                }}
                className="mb-2"
              />
              <p className="text-sm text-gray-600 mb-4">Select one or multiple reference images. They will be sent along with the prompt.</p>

              {availableImages.length > 0 && (
                <div className="mb-4">
                  <strong>Select from previous images:</strong>
                  <div className="flex overflow-x-auto space-x-2 mt-2">
                    {availableImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 flex-shrink-0 border rounded overflow-hidden cursor-pointer"
                        onClick={() => addReferenceImage(img)}
                      >
                        <Image src={img} alt={`Available ${idx}`} fill style={{ objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                {totalCost !== null ? (
                  <>
                    <strong>Estimated cost:</strong> ${totalCost} for {batchSize} image(s)
                  </>
                ) : isGeminiModel ? (
                  <>
                    <strong>Gemini output:</strong> using aspect ratio <strong>{geminiAspectRatio}</strong>. No local price estimate yet.
                  </>
                ) : (
                  <>
                    <strong>Estimated cost:</strong> unavailable for this model.
                  </>
                )}
              </div>
              <button onClick={handleGenerate} disabled={loading} className="px-4 py-2 bg-green-500 text-white rounded w-full">
                {loading ? 'Generating...' : 'Generate image'}
              </button>
            </div>
          </div>

          <div className="voice-section mt-6">
            <div className="voice-section-header">
              <p className="voice-section-kicker">Cartesia</p>
              <h2 className="text-xl font-bold mb-2">Voice Generator</h2>
              <p className="text-sm text-gray-600">Separate from image generation. Preview your text in realtime or render a saved WAV file with your own cloned voices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1">Voice Prompt</label>
                <textarea
                  value={ttsPrompt}
                  onChange={(e) => setTtsPrompt(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={6}
                  placeholder="Write narration, dialogue, or spoken copy..."
                />
                <div className="voice-action-row">
                  <button
                    type="button"
                    className={`voice-preview-button${ttsPreviewLoading ? ' is-stop' : ''}`}
                    onClick={() => { void handlePreviewPrompt(); }}
                    disabled={ttsGenerating}
                  >
                    {ttsPreviewLoading ? 'Stop preview' : 'Preview live'}
                  </button>
                  <button
                    type="button"
                    className="voice-save-button"
                    onClick={() => { void handleGenerateAudio(); }}
                    disabled={ttsGenerating || ttsVoicesLoading}
                  >
                    {ttsGenerating ? 'Saving WAV...' : 'Generate + save WAV'}
                  </button>
                </div>
                <p className="voice-status-copy">
                  {ttsPreviewLoading
                    ? 'Streaming audio live from Cartesia.'
                    : 'Live preview uses a short-lived token. Saved renders are generated and stored by Next.js on the server.'}
                </p>
              </div>

              <div>
                <label className="block mb-1">My Cartesia Voices</label>
                <select
                  value={selectedTtsVoiceId}
                  onChange={(e) => setSelectedTtsVoiceId(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                  disabled={ttsVoicesLoading || ttsVoices.length === 0}
                >
                  {ttsVoicesLoading && <option value="">Loading voices...</option>}
                  {!ttsVoicesLoading && ttsVoices.length === 0 && <option value="">No owned voices found</option>}
                  {!ttsVoicesLoading && ttsVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} · {voice.language.toUpperCase()}
                    </option>
                  ))}
                </select>

                {ttsVoicesError && <p className="voice-error-copy">{ttsVoicesError}</p>}

                {selectedTtsVoice && (
                  <div className="voice-meta-card">
                    <div className="voice-meta-row">
                      <strong>{selectedTtsVoice.name}</strong>
                      <span className="voice-language-pill">{selectedTtsVoice.language.toUpperCase()}</span>
                    </div>
                    <p className="voice-description">{selectedTtsVoice.description || 'No description saved for this voice yet.'}</p>
                    <p className="voice-id-copy">Voice ID: {selectedTtsVoice.id}</p>
                  </div>
                )}

                <div className="audio-library">
                  <div className="audio-library-header">
                    <strong>Saved audio clips</strong>
                    <button type="button" className="audio-refresh-link" onClick={() => { void loadSavedAudioClips(); }}>
                      Refresh
                    </button>
                  </div>
                  <div className="audio-library-list">
                    {savedAudioClips.length === 0 && (
                      <p className="audio-empty-copy">No saved audio yet. Generate a WAV render and it will appear here.</p>
                    )}

                    {savedAudioClips.map((clip) => (
                      <div key={clip.url} className="audio-clip-card">
                        <div className="audio-clip-meta">
                          <div>
                            <strong>{clip.promptPreview || clip.voiceName || clip.filename}</strong>
                            <p className="audio-filename">
                              {clip.voiceName ? `${clip.voiceName} · ${clip.filename}` : clip.filename}
                            </p>
                          </div>
                          {clip.createdAt && <span className="audio-date">{new Date(clip.createdAt).toLocaleString()}</span>}
                        </div>
                        <audio controls preload="none" className="audio-player" src={clip.url} />
                        <a href={clip.url} target="_blank" rel="noreferrer" className="audio-open-link">Open file</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="gemini-section mt-6">
            <div className="gemini-section-header">
              <p className="voice-section-kicker">Text Models</p>
              <h2 className="text-xl font-bold mb-2">Prompt Writer</h2>
              <p className="text-sm text-gray-600">One-shot generation only. Pick a saved system prompt, choose Gemini or OpenRouter, send one request, and copy the output into the image or voice workflow.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="gemini-panel">
                <label className="block mb-1">System Prompt Name</label>
                <input
                  value={systemPromptName}
                  onChange={(e) => setSystemPromptName(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                  placeholder="Film noir image writer"
                />
                <label className="block mb-1">System Prompt Body</label>
                <textarea
                  value={systemPromptText}
                  onChange={(e) => setSystemPromptText(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={7}
                  placeholder="You write compact, visually rich prompts..."
                />
                <div className="gemini-action-row">
                  <button
                    type="button"
                    className="gemini-save-button"
                    onClick={() => { void handleSaveSystemPrompt(); }}
                    disabled={systemPromptSaving}
                  >
                    {systemPromptSaving ? 'Saving...' : 'Save system prompt'}
                  </button>
                  <button
                    type="button"
                    className="gemini-secondary-button"
                    onClick={() => {
                      setSystemPromptName('');
                      setSystemPromptText('');
                    }}
                  >
                    Clear draft
                  </button>
                </div>

                <div className="system-prompt-library">
                  <div className="system-prompt-library-header">
                    <strong>Saved system prompts</strong>
                    <span className="system-prompt-count">{systemPrompts.length}</span>
                  </div>
                  <div className="system-prompt-list">
                    {systemPrompts.length === 0 && (
                      <p className="audio-empty-copy">No system prompts saved yet.</p>
                    )}

                    {systemPrompts.map((item) => (
                      <div key={item.id} className="system-prompt-card">
                        <div className="system-prompt-card-header">
                          <strong>{item.name}</strong>
                          <span className="audio-date">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="system-prompt-preview">{item.text}</p>
                        <div className="system-prompt-actions">
                          <button type="button" className="gemini-secondary-button" onClick={() => loadSystemPromptIntoEditor(item)}>
                            Load
                          </button>
                          <button type="button" className="system-prompt-delete" onClick={() => { void handleDeleteSystemPrompt(item.id); }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="gemini-panel">
                <label className="block mb-1">Text Provider</label>
                <select
                  value={textProvider}
                  onChange={(e) => setTextProvider(e.target.value as TextProvider)}
                  className="w-full p-2 border rounded mb-2"
                >
                  <option value="gemini">Gemini Direct</option>
                  <option value="openrouter">OpenRouter</option>
                </select>

                {textProvider === 'openrouter' && (
                  <>
                    <label className="block mb-1">OpenRouter Model</label>
                    <div className="openrouter-model-select">
                      <AsyncCreatableSelect
                        cacheOptions
                        classNamePrefix="openrouter-select"
                        defaultOptions={[OPENROUTER_FREE_OPTION, OPENROUTER_AUTO_OPTION]}
                        formatCreateLabel={(inputValue) => `Use custom model slug: ${inputValue}`}
                        formatOptionLabel={(option) => (
                          <div>
                            <div>{option.label}</div>
                            <div className="openrouter-option-meta">{option.value}</div>
                          </div>
                        )}
                        isClearable={false}
                        loadOptions={loadOpenRouterOptions}
                        loadingMessage={() => 'Searching models...'}
                        menuPlacement="auto"
                        noOptionsMessage={({ inputValue }) => (inputValue ? 'No matching models.' : 'Type to search models.')}
                        onChange={(option: SingleValue<OpenRouterModelOption>) => {
                          if (option) {
                            selectOpenRouterModel(option);
                          }
                        }}
                        onCreateOption={(inputValue) => {
                          const customValue = inputValue.trim();
                          if (!customValue) {
                            return;
                          }
                          selectOpenRouterModel(createOpenRouterCustomOption(customValue));
                        }}
                        placeholder="Search OpenRouter models or type a slug..."
                        unstyled
                        value={openRouterModel}
                      />
                    </div>
                    <div className="gemini-action-row">
                      <button
                        type="button"
                        className="gemini-secondary-button"
                        onClick={() => {
                          selectOpenRouterModel(OPENROUTER_FREE_OPTION);
                        }}
                      >
                        Use free router
                      </button>
                      <button
                        type="button"
                        className="gemini-secondary-button"
                        onClick={() => {
                          selectOpenRouterModel(OPENROUTER_AUTO_OPTION);
                        }}
                      >
                        Use auto router
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Search is server-filtered, so the browser no longer downloads the full model catalog. Press Enter to use a custom slug that does not appear in the list.
                    </p>
                    {openRouterModelsError && <p className="voice-error-copy">{openRouterModelsError}</p>}
                  </>
                )}

                <label className="block mb-1">System Prompt for This Run</label>
                <select
                  value={selectedSystemPromptId}
                  onChange={(e) => setSelectedSystemPromptId(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                >
                  <option value="">No system prompt</option>
                  {systemPrompts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>

                {selectedSystemPrompt && (
                  <p className="gemini-selected-system-prompt">
                    Using: <strong>{selectedSystemPrompt.name}</strong>
                  </p>
                )}

                <label className="block mb-1">One-Shot Request</label>
                <textarea
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={8}
                  placeholder="Write me a cinematic image prompt for..."
                />

                <div className="gemini-action-row">
                  <button
                    type="button"
                    className="gemini-generate-button"
                    onClick={() => { void handleGenerateText(); }}
                    disabled={geminiLoading}
                  >
                    {geminiLoading ? 'Generating...' : textProvider === 'openrouter' ? 'Generate with OpenRouter' : 'Generate with Gemini'}
                  </button>
                </div>

                <div className="gemini-result-card">
                  <div className="gemini-result-header">
                    <strong>{geminiResult?.provider === 'openrouter' ? 'OpenRouter output' : 'Gemini output'}</strong>
                    {geminiResult?.model && <span className="voice-language-pill">{geminiResult.model}</span>}
                  </div>

                  {!geminiResult && (
                    <p className="audio-empty-copy">Your one-shot result will appear here.</p>
                  )}

                  {geminiResult && (
                    <>
                      {geminiResult.systemPromptName && (
                        <p className="gemini-selected-system-prompt">
                          System prompt: <strong>{geminiResult.systemPromptName}</strong>
                        </p>
                      )}
                      {geminiResult.provider === 'openrouter' && (
                        <p className="gemini-selected-system-prompt">
                          Route: <strong>{geminiResult.model}</strong>
                        </p>
                      )}
                      {geminiResult.provider === 'openrouter' && geminiResult.resolvedModel && geminiResult.resolvedModel !== geminiResult.model && (
                        <p className="gemini-selected-system-prompt">
                          Resolved model: <strong>{geminiResult.resolvedModel}</strong>
                        </p>
                      )}
                      <pre className="gemini-output-text">{geminiResult.text}</pre>
                      <div className="gemini-copy-row">
                        <button type="button" className="gemini-copy-button" onClick={applyGeminiTextToImagePrompt}>
                          Copy to image prompt
                        </button>
                        <button type="button" className="gemini-copy-button" onClick={applyGeminiTextToVoicePrompt}>
                          Copy to voice prompt
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {generated.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold mb-2">Image Results</h2>
              <div className="flex overflow-x-auto space-x-4">
                {generated.map((img, idx) => (
                  <div key={idx} className="relative w-64 h-64 flex-shrink-0 border rounded overflow-hidden cursor-pointer">
                    <Image src={img.url} alt={`Generated ${idx}`} fill style={{ objectFit: 'cover' }} onClick={() => window.open(img.url, '_blank')} />
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {alertDialog && (
        <div className="swal-overlay" role="presentation" onClick={closeAlertDialog}>
          <div
            className="swal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="swal-title"
            aria-describedby="swal-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swal-icon" aria-hidden="true">!</div>
            <h2 id="swal-title" className="swal-title">{alertDialog.title}</h2>
            <p id="swal-message" className="swal-message">{alertDialog.message}</p>
            <button className="swal-confirm" onClick={closeAlertDialog}>{alertDialog.confirmLabel}</button>
          </div>
        </div>
      )}
    </>
  );
}
