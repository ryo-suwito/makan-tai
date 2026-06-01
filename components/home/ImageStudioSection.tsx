import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Quality } from '@/lib/cost';
import {
  GEMINI_ASPECT_RATIOS,
  type GeminiAspectRatio,
  type ImageGenerationModel,
} from '@/lib/image-models';
import type { SavedPrompt } from '@/components/home/types';

interface ImageStudioSectionProps {
  availableImages: string[];
  batchSize: number;
  geminiAspectRatio: GeminiAspectRatio;
  inputPrompt: string;
  inputReferenceImages: string[];
  isGeminiModel: boolean;
  isOpenAiModel: boolean;
  isSavingDisabled?: boolean;
  isSubmitting: boolean;
  model: ImageGenerationModel;
  quality: Quality;
  savedPrompts: SavedPrompt[];
  totalCost: number | null;
  width: number;
  height: number;
  onAddReferenceImages: (images: string[]) => void;
  onBatchSizeChange: (value: number) => void;
  onClearPrompt: () => void;
  onClearReferenceImages: () => void;
  onDeleteSavedPrompt: (id: number) => void;
  onGenerateImage: () => void;
  onGeminiAspectRatioChange: (aspectRatio: GeminiAspectRatio) => void;
  onHeightChange: (value: number) => void;
  onLoadSavedPrompt: (text: string) => void;
  onModelChange: (model: ImageGenerationModel) => void;
  onPromptChange: (value: string) => void;
  onQualityChange: (quality: Quality) => void;
  onRemoveReferenceImage: (url: string) => void;
  onSavePrompt: () => void;
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
  inputReferenceImages,
  isGeminiModel,
  isOpenAiModel,
  isSavingDisabled = false,
  isSubmitting,
  model,
  quality,
  savedPrompts,
  totalCost,
  width,
  height,
  onAddReferenceImages,
  onBatchSizeChange,
  onClearPrompt,
  onClearReferenceImages,
  onDeleteSavedPrompt,
  onGenerateImage,
  onGeminiAspectRatioChange,
  onHeightChange,
  onLoadSavedPrompt,
  onModelChange,
  onPromptChange,
  onQualityChange,
  onRemoveReferenceImage,
  onSavePrompt,
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block mb-1">Image Prompt</label>
        <textarea
          value={inputPrompt}
          onChange={(event) => onPromptChange(event.target.value)}
          className="w-full p-2 border rounded"
          rows={4}
        />
        <div className="flex space-x-2 mt-1">
          <button onClick={onSavePrompt} disabled={isSavingDisabled} className="px-3 py-1 bg-blue-500 text-white rounded">Save</button>
          <button onClick={onClearPrompt} className="px-3 py-1 bg-gray-300 rounded">Clear</button>
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
                  <button type="button" className="gemini-secondary-button" onClick={() => onLoadSavedPrompt(item.text)}>
                    Load
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
        </select>

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
                      <Image src={image} alt={`Selected reference ${index + 1}`} fill style={{ objectFit: 'cover' }} />
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
          <div className="system-prompt-library mb-4">
            <div className="reference-gallery-header">
              <strong>Select from previous images</strong>
              <span className="system-prompt-count">{selectedLibraryCount} selected</span>
            </div>
            <p className="reference-selection-summary">
              Browsing {visibleAvailableImages.length} of {availableImages.length} saved images. Scroll to load more.
            </p>
            <div ref={galleryScrollRef} className="reference-gallery-scroll">
              <div className="reference-gallery-grid">
                {visibleAvailableImages.map((image, index) => {
                  const isSelected = inputReferenceImages.includes(image);
                  return (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      className={`reference-gallery-item${isSelected ? ' reference-gallery-item-selected' : ''}`}
                      onClick={() => onTogglePreviousImage(image)}
                    >
                      <div className="reference-gallery-image">
                        <Image src={image} alt={`Available ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                      </div>
                      <div className="reference-gallery-meta">
                        <span>{isSelected ? 'Selected' : 'Click to add'}</span>
                        <span className="reference-gallery-check">{isSelected ? 'Remove' : `#${index + 1}`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div ref={gallerySentinelRef} className="reference-gallery-sentinel" />
            </div>
            {visibleAvailableCount < availableImages.length && (
              <button
                type="button"
                className="reference-load-more"
                onClick={() => setVisibleAvailableCount((current) => Math.min(current + 18, availableImages.length))}
              >
                Load more previous images
              </button>
            )}
          </div>
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
