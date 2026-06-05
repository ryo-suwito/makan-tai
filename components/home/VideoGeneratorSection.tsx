import type {
  FalVideoAspectRatio,
  FalVideoDuration,
  FalVideoModel,
  FalVideoResolution,
  GeneratedVideoClip,
} from '@/components/home/types';
import type { FalVideoModelOption } from '@/lib/fal-video-models';

interface VideoGeneratorSectionProps {
  aspectRatio: FalVideoAspectRatio;
  availableImages: string[];
  duration: FalVideoDuration;
  imageUrl: string;
  isGenerating: boolean;
  model: FalVideoModel;
  modelOptions: FalVideoModelOption[];
  prompt: string;
  resolution: FalVideoResolution;
  savedVideoClips: GeneratedVideoClip[];
  supportedDurations: readonly FalVideoDuration[];
  onAspectRatioChange: (value: FalVideoAspectRatio) => void;
  onDurationChange: (value: FalVideoDuration) => void;
  onGenerateVideo: () => void;
  onImageUrlChange: (value: string) => void;
  onModelChange: (value: FalVideoModel) => void;
  onPromptChange: (value: string) => void;
  onRefreshSavedVideos: () => void;
  onResolutionChange: (value: FalVideoResolution) => void;
}

const ASPECT_RATIO_OPTIONS: FalVideoAspectRatio[] = ['auto', '16:9', '1:1', '9:16'];
const RESOLUTION_OPTIONS: FalVideoResolution[] = ['480p', '720p', '1080p'];

export function VideoGeneratorSection({
  aspectRatio,
  availableImages,
  duration,
  imageUrl,
  isGenerating,
  model,
  modelOptions,
  prompt,
  resolution,
  savedVideoClips,
  supportedDurations,
  onAspectRatioChange,
  onDurationChange,
  onGenerateVideo,
  onImageUrlChange,
  onModelChange,
  onPromptChange,
  onRefreshSavedVideos,
  onResolutionChange,
}: VideoGeneratorSectionProps) {
  return (
    <div className="voice-section mt-6">
      <div className="voice-section-header">
        <p className="voice-section-kicker">Fal.ai</p>
        <h2 className="text-xl font-bold mb-2">Video Generator</h2>
        <p className="text-sm text-gray-600">
          Workflow video cards use the model and clip settings from this panel.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1">Video Prompt</label>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="w-full p-2 border rounded"
            rows={5}
            placeholder="Describe the motion, camera move, and pacing..."
          />

          <label className="block mb-1 mt-4">Start Image</label>
          <select
            value={imageUrl}
            onChange={(event) => onImageUrlChange(event.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select a generated image...</option>
            {availableImages.map((image) => (
              <option key={image} value={image}>
                {image}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Model</label>
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value as FalVideoModel)}
            className="w-full p-2 border rounded mb-2"
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mb-3">
            {modelOptions.find((option) => option.value === model)?.note}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block mb-1">Duration</label>
              <select
                value={duration}
                onChange={(event) => onDurationChange(event.target.value as FalVideoDuration)}
                className="w-full p-2 border rounded"
              >
                {supportedDurations.map((option) => (
                  <option key={option} value={option}>
                    {option}s
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(event) => onResolutionChange(event.target.value as FalVideoResolution)}
                className="w-full p-2 border rounded"
              >
                {RESOLUTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(event) => onAspectRatioChange(event.target.value as FalVideoAspectRatio)}
                className="w-full p-2 border rounded"
              >
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="voice-save-button mt-4"
            onClick={onGenerateVideo}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating video...' : 'Generate video'}
          </button>
        </div>
      </div>

      <div className="audio-library video-gallery mt-6">
        <div className="audio-library-header">
          <strong>Saved video clips</strong>
          <button type="button" className="audio-refresh-link" onClick={onRefreshSavedVideos}>
            Refresh
          </button>
        </div>
        <div className="video-gallery-grid">
          {savedVideoClips.length === 0 && (
            <p className="audio-empty-copy video-gallery-empty">No saved video clips yet.</p>
          )}

          {savedVideoClips.map((clip) => (
            <article key={clip.url} className="video-gallery-card">
              <div className="video-gallery-thumb">
                <video controls preload="metadata" playsInline className="video-gallery-player" src={clip.url} />
                {clip.duration && (
                  <span className="video-gallery-duration">{clip.duration}s</span>
                )}
              </div>

              <div className="video-gallery-body">
                <strong className="video-gallery-title">{clip.promptPreview || clip.filename}</strong>
                <p className="video-gallery-meta">
                  {[clip.model, clip.resolution, clip.aspectRatio].filter(Boolean).join(' • ') || clip.filename}
                </p>
                <p className="video-gallery-submeta">
                  {clip.createdAt ? new Date(clip.createdAt).toLocaleString() : 'Saved locally'}
                </p>
                <div className="video-gallery-actions">
                  <a href={clip.url} target="_blank" rel="noreferrer" className="audio-open-link video-gallery-link">Open file</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
