import Image from 'next/image';
import type { GeneratedImage } from '@/components/home/types';

interface ImageResultsGalleryProps {
  generatedImages: GeneratedImage[];
}

export function ImageResultsGallery({ generatedImages }: ImageResultsGalleryProps) {
  if (generatedImages.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-2">Image Results</h2>
      <div className="flex overflow-x-auto space-x-4">
        {generatedImages.map((image, index) => (
          <div key={`${image.url}-${index}`} className="relative w-64 h-64 flex-shrink-0 border rounded overflow-hidden cursor-pointer">
            <Image
              src={image.url}
              alt={`Generated ${index}`}
              fill
              style={{ objectFit: 'cover' }}
              onClick={() => window.open(image.url, '_blank')}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
