import Image from 'next/image';
import { normalizeLocalAssetUrl } from '@/lib/asset-urls';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Quality } from '@/lib/cost';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import {
  GEMINI_ASPECT_RATIOS,
  type GeminiAspectRatio,
  type ImageGenerationModel,
} from '@/lib/image-models';
import { FAL_IMAGE_LORA_OPTIONS } from '@/lib/fal-image-loras';
import type {
  FalImageLoraOption,
  FalImageSettings,
  FalImageModelOption,
  SavedPrompt,
  SelfHostImageModelOption,
} from '@/components/home/types';
import { ImageGallerySelector } from '@/components/home/ImageGallerySelector';

interface ImageStudioSectionProps {
  availableImages: string[];
  batchSize: number;
  geminiAspectRatio: GeminiAspectRatio;
  inputPrompt: string;
  inputPromptPrefix: string;
  inputPromptSuffix: string;
  inputReferenceImages: string[];
  isFalImageModel: boolean;
  isGeminiModel: boolean;
  isOpenAiModel: boolean;
  isSelfHostImageModel: boolean;
  isSavingDisabled?: boolean;
  isSubmitting: boolean;
  falImageEstimate: string | null;
  falImageModel: FalImageModelOption;
  falImageSettings: FalImageSettings;
  falImageModelOptions: FalImageModelOption[];
  model: ImageGenerationModel;
  quality: Quality;
  savedPrompts: SavedPrompt[];
  selfHostImageModel: SelfHostImageModelOption;
  selfHostImageModelOptions: SelfHostImageModelOption[];
  totalCost: number | null;
  width: number;
  height: number;
  onAddReferenceImages: (images: string[]) => void;
  onBatchSizeChange: (value: number) => void;
  onClearPrompt: () => void;
  onClearReferenceImages: () => void;
  onDeleteSavedPrompt: (id: number) => void;
  onFalImageModelChange: (option: FalImageModelOption) => void;
  onFalImageSettingsChange: (settings: FalImageSettings) => void;
  onGenerateImage: () => void;
  onGeminiAspectRatioChange: (aspectRatio: GeminiAspectRatio) => void;
  onHeightChange: (value: number) => void;
  onLoadSavedPromptToMain: (text: string) => void;
  onLoadSavedPromptToPrefix: (text: string) => void;
  onLoadSavedPromptToSuffix: (text: string) => void;
  onModelChange: (model: ImageGenerationModel) => void;
  onPromptChange: (value: string) => void;
  onPromptPrefixChange: (value: string) => void;
  onPromptSuffixChange: (value: string) => void;
  onQualityChange: (quality: Quality) => void;
  onRemoveReferenceImage: (url: string) => void;
  onSavePrompt: () => void;
  onSelfHostImageModelChange: (option: SelfHostImageModelOption) => void;
  onTogglePreviousImage: (url: string) => void;
  onWidthChange: (value: number) => void;
}

interface DeviceReferenceImage {
  name: string;
  url: string;
}

export function ImageStudioSection({
  availableImages,
  batchSize,
  geminiAspectRatio,
  inputPrompt,
  inputPromptPrefix,
  inputPromptSuffix,
  inputReferenceImages,
  isFalImageModel,
  isGeminiModel,
  isOpenAiModel,
  isSelfHostImageModel,
  isSavingDisabled = false,
  isSubmitting,
  falImageEstimate,
  falImageModel,
  falImageSettings,
  falImageModelOptions,
  model,
  quality,
  savedPrompts,
  selfHostImageModel,
  selfHostImageModelOptions,
  totalCost,
  width,
  height,
  onAddReferenceImages,
  onBatchSizeChange,
  onClearPrompt,
  onClearReferenceImages,
  onDeleteSavedPrompt,
  onFalImageModelChange,
  onFalImageSettingsChange,
  onGenerateImage,
  onGeminiAspectRatioChange,
  onHeightChange,
  onLoadSavedPromptToMain,
  onLoadSavedPromptToPrefix,
  onLoadSavedPromptToSuffix,
  onModelChange,
  onPromptChange,
  onPromptPrefixChange,
  onPromptSuffixChange,
  onQualityChange,
  onRemoveReferenceImage,
  onSavePrompt,
  onSelfHostImageModelChange,
  onTogglePreviousImage,
  onWidthChange,
}: ImageStudioSectionProps) {
  const [deviceReferenceImages, setDeviceReferenceImages] = useState<DeviceReferenceImage[]>([]);
  const [visibleAvailableCount, setVisibleAvailableCount] = useState(18);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const gallerySentinelRef = useRef<HTMLDivElement | null>(null);
  const availableImageSet = useMemo(() => new Set(availableImages), [availableImages]);
  const visibleAvailableImages = availableImages.slice(0, visibleAvailableCount);
  const selectedLibraryCount = inputReferenceImages.filter((image) => availableImageSet.has(image)).length;

  useEffect(() => {
    setDeviceReferenceImages((current) => current.filter((item) => inputReferenceImages.includes(item.url)));
  }, [inputReferenceImages]);

  useEffect(() => {
    setVisibleAvailableCount((current) => {
      const next = Math.max(18, current);
      return Math.min(next, availableImages.length || 18);
    });
  }, [availableImages.length]);

  useEffect(() => {
    const root = galleryScrollRef.current;
    const sentinel = gallerySentinelRef.current;

    if (!root || !sentinel || visibleAvailableCount >= availableImages.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleAvailableCount((current) => Math.min(current + 18, availableImages.length));
          }
        });
      },
      {
        root,
        rootMargin: '120px 0px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [availableImages.length, visibleAvailableCount]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const nextDeviceImages: DeviceReferenceImage[] = [];

    for (const file of files) {
      const reader = new FileReader();
      const fileDataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      nextDeviceImages.push({ name: file.name, url: fileDataUrl });
    }

    if (nextDeviceImages.length === 0) {
      return;
    }

    setDeviceReferenceImages((current) => {
      const next = [...current];
      nextDeviceImages.forEach((item) => {
        if (!next.some((existing) => existing.url === item.url)) {
          next.push(item);
        }
      });
      return next;
    });
    onAddReferenceImages(nextDeviceImages.map((item) => item.url));
    event.target.value = '';
  };

  const clearDeviceSelections = () => {
    deviceReferenceImages.forEach((item) => onRemoveReferenceImage(item.url));
    setDeviceReferenceImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFalLora = (option: FalImageLoraOption) => {
    if (falImageSettings.qwenImageEdit2511Loras.some((item) => item.id === option.id)) {
      return;
    }

    if (falImageSettings.qwenImageEdit2511Loras.length >= 3) {
      return;
    }

    onFalImageSettingsChange({
      ...falImageSettings,
      qwenImageEdit2511Loras: [
        ...falImageSettings.qwenImageEdit2511Loras,
        {
          ...option,
          scale: option.defaultScale,
        },
      ],
    });
  };

  const removeFalLora = (id: string) => {
    onFalImageSettingsChange({
      ...falImageSettings,
      qwenImageEdit2511Loras: falImageSettings.qwenImageEdit2511Loras.filter((item) => item.id !== id),
    });
  };

  const updateFalLoraScale = (id: string, scale: number) => {
    onFalImageSettingsChange({
      ...falImageSettings,
      qwenImageEdit2511Loras: falImageSettings.qwenImageEdit2511Loras.map((item) => (
        item.id === id
          ? { ...item, scale }
          : item
      )),
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block mb-1">Prompt Prefix</label>
        <textarea
          value={inputPromptPrefix}
          onChange={(event) => onPromptPrefixChange(event.target.value)}
          className="w-full p-2 border rounded mb-3"
          rows={3}
          placeholder="Optional setup, camera language, framing, brand voice..."
        />

        <label className="block mb-1">Main Image Prompt</label>
        <textarea
          value={inputPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          className="w-full p-2 border rounded mb-3"
          rows={4}
          placeholder="What should actually happen in the image?"
        />

        <label className="block mb-1">Prompt Suffix</label>
        <textarea
          value={inputPromptSuffix}
          onChange={(event) => onPromptSuffixChange(event.target.value)}
          className="w-full p-2 border rounded"
          rows={3}
          placeholder="Optional finishing constraints, quality cues, exclusions..."
        />
        <div className="flex space-x-2 mt-1">
          <button onClick={onSavePrompt} disabled={isSavingDisabled} className="px-3 py-1 bg-blue-500 text-white rounded">Save</button>
          <button onClick={onClearPrompt} className="px-3 py-1 bg-gray-300 rounded">Clear all</button>
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
                  <button type="button" className="gemini-secondary-button" onClick={() => onLoadSavedPromptToPrefix(item.text)}>
                    Load to prefix
                  </button>
                  <button type="button" className="gemini-secondary-button" onClick={() => onLoadSavedPromptToMain(item.text)}>
                    Load to main
                  </button>
                  <button type="button" className="gemini-secondary-button" onClick={() => onLoadSavedPromptToSuffix(item.text)}>
                    Load to suffix
                  </button>
                  <button type="button" className="system-prompt-delete" onClick={() => onDeleteSavedPrompt(item.id)}>
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
        <select
          value={model}
          onChange={(event) => onModelChange(event.target.value as ImageGenerationModel)}
          className="w-full p-2 border rounded mb-2"
        >
          <option value="gpt-image-2">GPT Image 2</option>
          <option value="gpt-image-1.5">GPT Image 1.5</option>
          <option value="gpt-image-1">GPT Image 1</option>
          <option value="gpt-image-1-mini">GPT Image 1 Mini</option>
          <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
          <option value="a2e">A2E</option>
          <option value="fal-ai">Fal.ai</option>
          <option value="self-host">Self-Host</option>
        </select>

        {isFalImageModel && (
          <>
            <label className="block mb-1">Fal.ai Model</label>
            <div className="openrouter-model-select">
              <Select
                classNamePrefix="openrouter-select"
                formatOptionLabel={(option: FalImageModelOption) => (
                  <div>
                    <div>{option.label}</div>
                    <div className="openrouter-option-meta">
                      {option.unit} · {option.price} · {option.outputPerDollar}
                    </div>
                  </div>
                )}
                isClearable={false}
                menuPlacement="auto"
                onChange={(option: SingleValue<FalImageModelOption>) => {
                  if (option) {
                    onFalImageModelChange(option);
                  }
                }}
                options={falImageModelOptions}
                placeholder="Select a Fal.ai image model..."
                unstyled
                value={falImageModel}
              />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Fixed Fal.ai model list with current billing metadata. No favorites are stored for image models.
            </p>

            {(falImageModel.value === 'qwen-image-edit-2511' || falImageModel.value === 'qwen-image-edit-2511-lora') && (
              <div className="system-prompt-library mb-3">
                <div className="system-prompt-library-header">
                  <strong>{falImageModel.label} Settings</strong>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Edit-only model. Requires at least one reference image and exposes Qwen 2511-specific inference controls.
                </p>
                <label className="block mb-1">Negative Prompt</label>
                <textarea
                  value={falImageSettings.qwenImageEdit2511.negativePrompt}
                  onChange={(event) => onFalImageSettingsChange({
                    ...falImageSettings,
                    qwenImageEdit2511: {
                      ...falImageSettings.qwenImageEdit2511,
                      negativePrompt: event.target.value,
                    },
                  })}
                  className="w-full p-2 border rounded mb-3"
                  rows={2}
                  placeholder="Optional things to avoid..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block mb-1">Inference Steps</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={falImageSettings.qwenImageEdit2511.numInferenceSteps}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          numInferenceSteps: Math.max(1, Number(event.target.value) || 1),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Guidance Scale</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      value={falImageSettings.qwenImageEdit2511.guidanceScale}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          guidanceScale: Math.max(0, Number(event.target.value) || 0),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Acceleration</label>
                    <select
                      value={falImageSettings.qwenImageEdit2511.acceleration}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          acceleration: event.target.value as FalImageSettings['qwenImageEdit2511']['acceleration'],
                        },
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="none">None</option>
                      <option value="regular">Regular</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Output Format</label>
                    <select
                      value={falImageSettings.qwenImageEdit2511.outputFormat}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          outputFormat: event.target.value as FalImageSettings['qwenImageEdit2511']['outputFormat'],
                        },
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Seed</label>
                    <input
                      type="number"
                      min={0}
                      value={falImageSettings.qwenImageEdit2511.seed ?? ''}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          seed: event.target.value === '' ? null : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                      placeholder="Optional"
                    />
                  </div>
                  <label className="inline-flex items-center mt-7">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={falImageSettings.qwenImageEdit2511.enableSafetyChecker}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511: {
                          ...falImageSettings.qwenImageEdit2511,
                          enableSafetyChecker: event.target.checked,
                        },
                      })}
                    />
                    Enable safety checker
                  </label>
                </div>

                {falImageModel.value === 'qwen-image-edit-2511-lora' && (
                  <div className="mt-4">
                    <div className="system-prompt-library-header mb-2">
                      <strong>LoRA Registry</strong>
                      <span className="system-prompt-count">{falImageSettings.qwenImageEdit2511Loras.length}/3 selected</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Pick up to 3 LoRAs. The safetensors link is the exact path sent to Fal for the selected rows.
                    </p>
                    <div className="system-prompt-list mb-3">
                      {FAL_IMAGE_LORA_OPTIONS.map((option) => {
                        const selected = falImageSettings.qwenImageEdit2511Loras.some((item) => item.id === option.id);
                        const atCapacity = falImageSettings.qwenImageEdit2511Loras.length >= 3 && !selected;
                        return (
                          <div key={option.id} className="system-prompt-card">
                            <div className="system-prompt-card-header">
                              <strong>{option.label}</strong>
                              <span className="audio-date">Default scale {option.defaultScale}</span>
                            </div>
                            <p className="system-prompt-preview">{option.description}</p>
                            <div className="flex flex-wrap gap-2 text-sm mb-2">
                              <a href={option.repoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                Repo
                              </a>
                              <a href={option.safetensorsUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                Safetensors
                              </a>
                            </div>
                            <div className="system-prompt-actions">
                              {selected ? (
                                <button type="button" className="system-prompt-delete" onClick={() => removeFalLora(option.id)}>
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="gemini-secondary-button"
                                  onClick={() => addFalLora(option)}
                                  disabled={atCapacity}
                                >
                                  {atCapacity ? 'Max 3 selected' : 'Add LoRA'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {falImageSettings.qwenImageEdit2511Loras.length > 0 && (
                      <div className="system-prompt-list">
                        {falImageSettings.qwenImageEdit2511Loras.map((item) => (
                          <div key={item.id} className="system-prompt-card">
                            <div className="system-prompt-card-header">
                              <strong>{item.label}</strong>
                              <span className="audio-date">Selected</span>
                            </div>
                            <label className="block mb-1">Scale</label>
                            <input
                              type="number"
                              min={0}
                              max={3}
                              step={0.1}
                              value={item.scale}
                              onChange={(event) => updateFalLoraScale(item.id, Math.max(0, Number(event.target.value) || 0))}
                              className="w-full p-2 border rounded mb-2"
                            />
                            <p className="reference-file-meta break-all">{item.path}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {falImageModel.value === 'qwen-image-edit-2511-multiple-angles' && (
              <div className="system-prompt-library mb-3">
                <div className="system-prompt-library-header">
                  <strong>Multiple Angles Settings</strong>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Uses one reference image and auto-builds the camera prompt. Your prompt fields are optional here and get appended as additional prompt text.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block mb-1">Horizontal Angle</label>
                    <input
                      type="number"
                      min={0}
                      max={360}
                      step={1}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.horizontalAngle}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          horizontalAngle: Math.max(0, Math.min(360, Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Vertical Angle</label>
                    <input
                      type="number"
                      min={-90}
                      max={90}
                      step={1}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.verticalAngle}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          verticalAngle: Math.max(-90, Math.min(90, Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Zoom</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.zoom}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          zoom: Math.max(0, Math.min(10, Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">LoRA Scale</label>
                    <input
                      type="number"
                      min={0}
                      max={3}
                      step={0.1}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.loraScale}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          loraScale: Math.max(0, Number(event.target.value) || 0),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                <label className="block mb-1">Negative Prompt</label>
                <textarea
                  value={falImageSettings.qwenImageEdit2511MultipleAngles.negativePrompt}
                  onChange={(event) => onFalImageSettingsChange({
                    ...falImageSettings,
                    qwenImageEdit2511MultipleAngles: {
                      ...falImageSettings.qwenImageEdit2511MultipleAngles,
                      negativePrompt: event.target.value,
                    },
                  })}
                  className="w-full p-2 border rounded mb-3"
                  rows={2}
                  placeholder="Optional things to avoid..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block mb-1">Inference Steps</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.numInferenceSteps}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          numInferenceSteps: Math.max(1, Number(event.target.value) || 1),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Guidance Scale</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.guidanceScale}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          guidanceScale: Math.max(0, Number(event.target.value) || 0),
                        },
                      })}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">Acceleration</label>
                    <select
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.acceleration}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          acceleration: event.target.value as FalImageSettings['qwenImageEdit2511MultipleAngles']['acceleration'],
                        },
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="none">None</option>
                      <option value="regular">Regular</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Output Format</label>
                    <select
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.outputFormat}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          outputFormat: event.target.value as FalImageSettings['qwenImageEdit2511MultipleAngles']['outputFormat'],
                        },
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Seed</label>
                    <input
                      type="number"
                      min={0}
                      value={falImageSettings.qwenImageEdit2511MultipleAngles.seed ?? ''}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          seed: event.target.value === '' ? null : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                      placeholder="Optional"
                    />
                  </div>
                  <label className="inline-flex items-center mt-7">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={falImageSettings.qwenImageEdit2511MultipleAngles.enableSafetyChecker}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImageEdit2511MultipleAngles: {
                          ...falImageSettings.qwenImageEdit2511MultipleAngles,
                          enableSafetyChecker: event.target.checked,
                        },
                      })}
                    />
                    Enable safety checker
                  </label>
                </div>
              </div>
            )}

            {(falImageModel.value === 'qwen-image-2-edit' || falImageModel.value === 'qwen-image-2-pro-edit') && (
              <div className="system-prompt-library mb-3">
                <div className="system-prompt-library-header">
                  <strong>{falImageModel.label} Settings</strong>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Requires 1 to 3 reference images. Their order matters, so keep them arranged to match any “image 1 / image 2 / image 3” prompt language.
                </p>
                <label className="block mb-1">Negative Prompt</label>
                <textarea
                  value={falImageSettings.qwenImage2Edit.negativePrompt}
                  onChange={(event) => onFalImageSettingsChange({
                    ...falImageSettings,
                    qwenImage2Edit: {
                      ...falImageSettings.qwenImage2Edit,
                      negativePrompt: event.target.value,
                    },
                  })}
                  className="w-full p-2 border rounded mb-3"
                  rows={2}
                  placeholder="Optional things to avoid..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block mb-1">Output Format</label>
                    <select
                      value={falImageSettings.qwenImage2Edit.outputFormat}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImage2Edit: {
                          ...falImageSettings.qwenImage2Edit,
                          outputFormat: event.target.value as FalImageSettings['qwenImage2Edit']['outputFormat'],
                        },
                      })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">Seed</label>
                    <input
                      type="number"
                      min={0}
                      max={2147483647}
                      value={falImageSettings.qwenImage2Edit.seed ?? ''}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImage2Edit: {
                          ...falImageSettings.qwenImage2Edit,
                          seed: event.target.value === '' ? null : Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        },
                      })}
                      className="w-full p-2 border rounded"
                      placeholder="Optional"
                    />
                  </div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={falImageSettings.qwenImage2Edit.enablePromptExpansion}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImage2Edit: {
                          ...falImageSettings.qwenImage2Edit,
                          enablePromptExpansion: event.target.checked,
                        },
                      })}
                    />
                    Enable prompt expansion
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={falImageSettings.qwenImage2Edit.enableSafetyChecker}
                      onChange={(event) => onFalImageSettingsChange({
                        ...falImageSettings,
                        qwenImage2Edit: {
                          ...falImageSettings.qwenImage2Edit,
                          enableSafetyChecker: event.target.checked,
                        },
                      })}
                    />
                    Enable safety checker
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        {isSelfHostImageModel && (
          <>
            <label className="block mb-1">Self-Host Model</label>
            <div className="openrouter-model-select">
              <Select
                classNamePrefix="openrouter-select"
                formatOptionLabel={(option: SelfHostImageModelOption) => (
                  <div>
                    <div>{option.label}</div>
                    <div className="openrouter-option-meta">{option.note}</div>
                  </div>
                )}
                isClearable={false}
                menuPlacement="auto"
                onChange={(option: SingleValue<SelfHostImageModelOption>) => {
                  if (option) {
                    onSelfHostImageModelChange(option);
                  }
                }}
                options={selfHostImageModelOptions}
                placeholder="Select a self-host image model..."
                unstyled
                value={selfHostImageModel}
              />
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Routes image generation to the local self-host inference server.
            </p>
          </>
        )}

        <label className="block mb-1">Quality</label>
        <div className="flex space-x-3 mb-2">
          {(['low', 'medium', 'high'] as const).map((item) => (
            <label key={item} className={`inline-flex items-center ${isOpenAiModel ? '' : 'opacity-50'}`}>
              <input
                type="radio"
                className="mr-1"
                value={item}
                checked={quality === item}
                onChange={() => onQualityChange(item)}
                disabled={!isOpenAiModel}
              />
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </label>
          ))}
        </div>
        {!isOpenAiModel && (
          <p className="text-sm text-gray-600 mb-2">
            Quality only applies to GPT Image models. Gemini uses aspect ratio, while A2E, Fal.ai, and self-host ignore this control.
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
                  onClick={() => onGeminiAspectRatioChange(aspectRatio)}
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
              <input type="number" value={width} onChange={(event) => onWidthChange(Number(event.target.value))} className="w-20 p-1 border rounded" placeholder="Width" />
              <input type="number" value={height} onChange={(event) => onHeightChange(Number(event.target.value))} className="w-20 p-1 border rounded" placeholder="Height" />
              <div className="flex space-x-1">
                <button onClick={() => { onWidthChange(1024); onHeightChange(1024); }} className="px-2 py-1 bg-gray-200 rounded">1024x1024</button>
                <button onClick={() => { onWidthChange(1024); onHeightChange(1536); }} className="px-2 py-1 bg-gray-200 rounded">1024x1536</button>
                <button onClick={() => { onWidthChange(1536); onHeightChange(1024); }} className="px-2 py-1 bg-gray-200 rounded">1536x1024</button>
              </div>
            </div>
          </>
        )}

        <label className="block mb-1">Batch Size</label>
        <div className="flex space-x-2 mb-4">
          <input type="number" value={batchSize} onChange={(event) => onBatchSizeChange(Number(event.target.value))} className="w-20 p-1 border rounded" />
          <button onClick={() => onBatchSizeChange(1)} className="px-2 py-1 bg-gray-200 rounded">1</button>
          <button onClick={() => onBatchSizeChange(4)} className="px-2 py-1 bg-gray-200 rounded">4</button>
          <button onClick={() => onBatchSizeChange(8)} className="px-2 py-1 bg-gray-200 rounded">8</button>
        </div>

        <label className="block mb-1">Reference Images</label>
        <div className="reference-image-toolbar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="reference-image-input"
          />
          <button
            type="button"
            className="gemini-secondary-button"
            onClick={clearDeviceSelections}
            disabled={deviceReferenceImages.length === 0}
          >
            Clear device picks
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Select one or multiple reference images. They will be sent along with the prompt.</p>

        {deviceReferenceImages.length > 0 && (
          <p className="reference-file-meta">
            Device uploads: {deviceReferenceImages.map((item) => item.name).join(', ')}
          </p>
        )}

        {inputReferenceImages.length > 0 && (
          <div className="system-prompt-library mb-4">
            <div className="system-prompt-library-header">
              <strong>Selected references</strong>
              <span className="system-prompt-count">{inputReferenceImages.length}</span>
            </div>
            <p className="reference-selection-summary">
              {selectedLibraryCount} from previous images, {deviceReferenceImages.length} from device.
            </p>
            <div className="reference-selected-list">
              {inputReferenceImages.map((image, index) => {
                const fromLibrary = availableImageSet.has(image);
                return (
                  <div key={`${image}-${index}`} className="reference-selected-card">
                    <div className="reference-selected-image">
                      <Image src={normalizeLocalAssetUrl(image)} alt={`Selected reference ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                    </div>
                    <div className="reference-selected-meta">
                      <span className="reference-source-pill">{fromLibrary ? 'Previous image' : 'Device upload'}</span>
                      <button
                        type="button"
                        className="reference-selected-remove"
                        onClick={() => onRemoveReferenceImage(image)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="gemini-action-row">
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => {
                  clearDeviceSelections();
                  onClearReferenceImages();
                }}
              >
                Clear all references
              </button>
            </div>
          </div>
        )}

        {availableImages.length > 0 && (
          <ImageGallerySelector
            availableImages={availableImages}
            multiSelect
            selectedImages={inputReferenceImages}
            onToggleImage={onTogglePreviousImage}
            emptyMessage="No previous generated images yet. Generate one first and it will show up here as a reusable reference."
          />
        )}

        {availableImages.length === 0 && (
          <p className="reference-empty-copy">
            No previous generated images yet. Generate one first and it will show up here as a reusable reference.
          </p>
        )}

        {inputReferenceImages.length === 0 && (
          <p className="reference-empty-copy">
            No references selected right now.
          </p>
        )}

        <div className="mb-4">
          {totalCost !== null ? (
            <>
              <strong>Estimated cost:</strong> ${totalCost} for {batchSize} image(s)
            </>
          ) : isFalImageModel && falImageEstimate ? (
            <>
              <strong>Estimated cost:</strong> {falImageEstimate}
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
        <button onClick={onGenerateImage} disabled={isSubmitting} className="px-4 py-2 bg-green-500 text-white rounded w-full">
          {isSubmitting ? 'Generating...' : 'Generate image'}
        </button>
      </div>
    </div>
  );
}
