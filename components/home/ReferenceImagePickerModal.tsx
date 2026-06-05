import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { normalizeLocalAssetUrl } from '@/lib/asset-urls';
import { ImageGallerySelector } from '@/components/home/ImageGallerySelector';

interface DeviceReferenceImage {
  name: string;
  url: string;
}

interface ReferenceImagePickerModalProps {
  availableImages: string[];
  emptyMessage?: string;
  maxSelected?: number;
  onAddReferenceImages: (images: string[]) => void;
  onClearReferenceImages: () => void;
  onRemoveReferenceImage: (url: string) => void;
  onTogglePreviousImage: (url: string) => void;
  selectedImages: string[];
  title?: string;
}

export function ReferenceImagePickerModal({
  availableImages,
  emptyMessage = 'No previous generated images yet. Generate one first and it will show up here as a reusable reference.',
  maxSelected,
  onAddReferenceImages,
  onClearReferenceImages,
  onRemoveReferenceImage,
  onTogglePreviousImage,
  selectedImages,
  title = 'Reference images',
}: ReferenceImagePickerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deviceReferenceImages, setDeviceReferenceImages] = useState<DeviceReferenceImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const availableImageSet = useMemo(() => new Set(availableImages), [availableImages]);
  const selectedImageSet = useMemo(() => new Set(selectedImages), [selectedImages]);
  const selectedLibraryCount = selectedImages.filter((image) => availableImageSet.has(image)).length;
  const remainingSlots = typeof maxSelected === 'number' ? Math.max(0, maxSelected - selectedImages.length) : Infinity;
  const selectionLimitCopy = typeof maxSelected === 'number'
    ? `${selectedImages.length}/${maxSelected} selected`
    : `${selectedImages.length} selected`;

  useEffect(() => {
    setDeviceReferenceImages((current) => current.filter((item) => selectedImages.includes(item.url)));
  }, [selectedImages]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const allowedFiles = Number.isFinite(remainingSlots) ? files.slice(0, remainingSlots) : files;
    const nextDeviceImages: DeviceReferenceImage[] = [];

    for (const file of allowedFiles) {
      const reader = new FileReader();
      const fileDataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      nextDeviceImages.push({ name: file.name, url: fileDataUrl });
    }

    if (nextDeviceImages.length === 0) {
      event.target.value = '';
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

  const clearAllReferences = () => {
    setDeviceReferenceImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClearReferenceImages();
  };

  const togglePreviousImage = (image: string) => {
    if (!selectedImageSet.has(image) && remainingSlots <= 0) {
      return;
    }
    onTogglePreviousImage(image);
  };

  return (
    <div className="reference-picker">
      <div className="reference-picker-summary">
        <div>
          <label className="block mb-1">{title}</label>
          <p className="reference-selection-summary">
            {selectedImages.length > 0
              ? `${selectedLibraryCount} from previous images, ${deviceReferenceImages.length} from device.`
              : 'No references selected right now.'}
          </p>
        </div>
        <button type="button" className="gemini-secondary-button" onClick={() => setIsOpen(true)}>
          Manage references
        </button>
      </div>

      {selectedImages.length > 0 && (
        <div className="reference-selected-strip">
          {selectedImages.map((image, index) => (
            <div key={`${image}-${index}`} className="reference-selected-thumb">
              <Image src={normalizeLocalAssetUrl(image)} alt={`Selected reference ${index + 1}`} fill style={{ objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            className="system-prompt-detail-card reference-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reference-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">Asset selector</p>
                <h3 id="reference-picker-title">{title}</h3>
              </div>
              <button type="button" className="system-prompt-detail-close" onClick={() => setIsOpen(false)} aria-label="Close reference picker">
                x
              </button>
            </div>

            <div className="reference-picker-modal-grid">
              <section className="reference-picker-pane">
                <div className="system-prompt-library-header">
                  <strong>Device files</strong>
                  <span className="system-prompt-count">{selectionLimitCopy}</span>
                </div>
                <div className="reference-image-toolbar">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="reference-image-input"
                    disabled={remainingSlots <= 0}
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
                <p className="text-sm text-gray-600 mb-4">
                  Device files are added to the ordered reference list immediately after selection.
                </p>
                {deviceReferenceImages.length > 0 && (
                  <p className="reference-file-meta">
                    Device uploads: {deviceReferenceImages.map((item) => item.name).join(', ')}
                  </p>
                )}
              </section>

              <section className="reference-picker-pane">
                <div className="system-prompt-library-header">
                  <strong>Selected references</strong>
                  <span className="system-prompt-count">{selectionLimitCopy}</span>
                </div>
                {selectedImages.length > 0 ? (
                  <>
                    <p className="reference-selection-summary">
                      Selection order is preserved. Future two-point video models can use item 1 as start and item 2 as end.
                    </p>
                    <div className="reference-selected-list">
                      {selectedImages.map((image, index) => {
                        const fromLibrary = availableImageSet.has(image);
                        return (
                          <div key={`${image}-${index}`} className="reference-selected-card">
                            <div className="reference-selected-image">
                              <Image src={normalizeLocalAssetUrl(image)} alt={`Selected reference ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                            </div>
                            <div className="reference-selected-meta">
                              <span className="reference-source-pill">
                                {index + 1}. {fromLibrary ? 'Previous image' : 'Device upload'}
                              </span>
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
                      <button type="button" className="gemini-secondary-button" onClick={clearAllReferences}>
                        Clear all references
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="reference-empty-copy">No references selected right now.</p>
                )}
              </section>
            </div>

            <section className="reference-picker-pane">
              {availableImages.length > 0 ? (
                <ImageGallerySelector
                  availableImages={availableImages}
                  multiSelect
                  selectedImages={selectedImages}
                  onToggleImage={togglePreviousImage}
                  emptyMessage={emptyMessage}
                />
              ) : (
                <p className="reference-empty-copy">{emptyMessage}</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
