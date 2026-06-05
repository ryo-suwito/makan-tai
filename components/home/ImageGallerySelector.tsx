import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeLocalAssetUrl } from '@/lib/asset-urls';

interface ImageGallerySelectorProps {
  availableImages: string[];
  selectedImage?: string | null;
  onSelectImage?: (url: string) => void;
  multiSelect?: boolean;
  selectedImages?: string[];
  onToggleImage?: (url: string) => void;
  maxVisible?: number;
  emptyMessage?: string;
}

export function ImageGallerySelector({
  availableImages,
  selectedImage,
  onSelectImage,
  multiSelect = false,
  selectedImages = [],
  onToggleImage,
  maxVisible = 18,
  emptyMessage = 'No images available yet.',
}: ImageGallerySelectorProps) {
  const [visibleCount, setVisibleCount] = useState(maxVisible);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const gallerySentinelRef = useRef<HTMLDivElement | null>(null);

  const visibleImages = useMemo(() => availableImages.slice(0, visibleCount), [availableImages, visibleCount]);
  const selectedSet = useMemo(() => new Set(selectedImages), [selectedImages]);
  const selectedCount = multiSelect ? selectedImages.length : 0;

  useEffect(() => {
    const sentinel = gallerySentinelRef.current;
    const scrollContainer = galleryScrollRef.current;
    if (!sentinel || !scrollContainer) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < availableImages.length) {
          setVisibleCount((current) => Math.min(current + maxVisible, availableImages.length));
        }
      },
      { root: scrollContainer, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [availableImages.length, maxVisible, visibleCount]);

  if (availableImages.length === 0) {
    return <p className="reference-empty-copy">{emptyMessage}</p>;
  }

  return (
    <div className="system-prompt-library mb-4">
      <div className="reference-gallery-header">
        <strong>{multiSelect ? 'Select from previous images' : 'Pick a start image'}</strong>
        {multiSelect && <span className="system-prompt-count">{selectedCount} selected</span>}
      </div>
      <p className="reference-selection-summary">
        Browsing {visibleImages.length} of {availableImages.length} saved images. Scroll to load more.
      </p>
      <div ref={galleryScrollRef} className="reference-gallery-scroll">
        <div className="reference-gallery-grid">
          {visibleImages.map((image, index) => {
            const isSelected = multiSelect ? selectedSet.has(image) : selectedImage === image;
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`reference-gallery-item${isSelected ? ' reference-gallery-item-selected' : ''}`}
                onClick={() => {
                  if (multiSelect && onToggleImage) {
                    onToggleImage(image);
                  } else if (onSelectImage) {
                    onSelectImage(image);
                  }
                }}
              >
                <div className="reference-gallery-image">
                  <Image src={normalizeLocalAssetUrl(image)} alt={`Image ${index + 1}`} fill style={{ objectFit: 'cover' }} />
                </div>
                <div className="reference-gallery-meta">
                  <span className="reference-gallery-check">{isSelected ? (multiSelect ? 'Remove' : '✓') : ''}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div ref={gallerySentinelRef} className="reference-gallery-sentinel" />
      </div>
      {visibleCount < availableImages.length && (
        <button
          type="button"
          className="reference-load-more"
          onClick={() => setVisibleCount((current) => Math.min(current + maxVisible, availableImages.length))}
        >
          Load more previous images
        </button>
      )}
    </div>
  );
}
