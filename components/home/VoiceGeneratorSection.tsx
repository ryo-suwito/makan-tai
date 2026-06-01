import type { CartesiaVoice, GeneratedAudioClip } from '@/components/home/types';

interface VoiceGeneratorSectionProps {
  prompt: string;
  savedAudioClips: GeneratedAudioClip[];
  selectedVoice: CartesiaVoice | null;
  selectedVoiceId: string;
  voices: CartesiaVoice[];
  voicesError: string | null;
  voicesLoading: boolean;
  isGeneratingAudio: boolean;
  isPreviewing: boolean;
  onGenerateAudio: () => void;
  onPreviewPrompt: () => void;
  onPromptChange: (value: string) => void;
  onRefreshSavedAudio: () => void;
  onSelectedVoiceIdChange: (value: string) => void;
}

export function VoiceGeneratorSection({
  prompt,
  savedAudioClips,
  selectedVoice,
  selectedVoiceId,
  voices,
  voicesError,
  voicesLoading,
  isGeneratingAudio,
  isPreviewing,
  onGenerateAudio,
  onPreviewPrompt,
  onPromptChange,
  onRefreshSavedAudio,
  onSelectedVoiceIdChange,
}: VoiceGeneratorSectionProps) {
  return (
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
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="w-full p-2 border rounded"
            rows={6}
            placeholder="Write narration, dialogue, or spoken copy..."
          />
          <div className="voice-action-row">
            <button
              type="button"
              className={`voice-preview-button${isPreviewing ? ' is-stop' : ''}`}
              onClick={onPreviewPrompt}
              disabled={isGeneratingAudio}
            >
              {isPreviewing ? 'Stop preview' : 'Preview live'}
            </button>
            <button
              type="button"
              className="voice-save-button"
              onClick={onGenerateAudio}
              disabled={isGeneratingAudio || voicesLoading}
            >
              {isGeneratingAudio ? 'Saving WAV...' : 'Generate + save WAV'}
            </button>
          </div>
          <p className="voice-status-copy">
            {isPreviewing
              ? 'Streaming audio live from Cartesia.'
              : 'Live preview uses a short-lived token. Saved renders are generated and stored by Next.js on the server.'}
          </p>
        </div>

        <div>
          <label className="block mb-1">My Cartesia Voices</label>
          <select
            value={selectedVoiceId}
            onChange={(event) => onSelectedVoiceIdChange(event.target.value)}
            className="w-full p-2 border rounded mb-2"
            disabled={voicesLoading || voices.length === 0}
          >
            {voicesLoading && <option value="">Loading voices...</option>}
            {!voicesLoading && voices.length === 0 && <option value="">No owned voices found</option>}
            {!voicesLoading && voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} · {voice.language.toUpperCase()}
              </option>
            ))}
          </select>

          {voicesError && <p className="voice-error-copy">{voicesError}</p>}

          {selectedVoice && (
            <div className="voice-meta-card">
              <div className="voice-meta-row">
                <strong>{selectedVoice.name}</strong>
                <span className="voice-language-pill">{selectedVoice.language.toUpperCase()}</span>
              </div>
              <p className="voice-description">{selectedVoice.description || 'No description saved for this voice yet.'}</p>
              <p className="voice-id-copy">Voice ID: {selectedVoice.id}</p>
            </div>
          )}

          <div className="audio-library">
            <div className="audio-library-header">
              <strong>Saved audio clips</strong>
              <button type="button" className="audio-refresh-link" onClick={onRefreshSavedAudio}>
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
  );
}
