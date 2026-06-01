import { STYLE_DNA_DIMS, type StyleDnaProfile } from '@/lib/style-dna';
import type { SavedStyleDnaProfile } from '@/components/home/types';

interface StyleDnaSectionProps {
  analysisEngineLabel: string;
  draftName: string;
  draftProfile: StyleDnaProfile | null;
  isAnalyzing: boolean;
  isSaving: boolean;
  samples: string;
  savedProfiles: SavedStyleDnaProfile[];
  selectedStyleDnaId: string;
  onAnalyze: () => void;
  onClearDraft: () => void;
  onDeleteProfile: (id: number) => void;
  onDraftNameChange: (value: string) => void;
  onSamplesChange: (value: string) => void;
  onSave: () => void;
  onSelectProfileForWriter: (id: string) => void;
}

function StyleDnaDimensionBar({ label, left, right, value }: { label: string; left: string; right: string; value: StyleDnaProfile[typeof STYLE_DNA_DIMS[number]['key']] }) {
  return (
    <div className="style-dna-dimension">
      <div className="style-dna-dimension-header">
        <strong>{label}</strong>
        <span>{value.score}</span>
      </div>
      <div className="style-dna-scale">
        <span>{left}</span>
        <div className="style-dna-track">
          <span className="style-dna-tick" style={{ left: `${value.score}%` }} />
        </div>
        <span>{right}</span>
      </div>
      {value.notes && <p className="style-dna-note">{value.notes}</p>}
    </div>
  );
}

export function StyleDnaSection({
  analysisEngineLabel,
  draftName,
  draftProfile,
  isAnalyzing,
  isSaving,
  samples,
  savedProfiles,
  selectedStyleDnaId,
  onAnalyze,
  onClearDraft,
  onDeleteProfile,
  onDraftNameChange,
  onSamplesChange,
  onSave,
  onSelectProfileForWriter,
}: StyleDnaSectionProps) {
  return (
    <div className="gemini-section mt-6">
      <div className="gemini-section-header">
        <p className="voice-section-kicker">Writing DNA</p>
        <h2 className="text-xl font-bold mb-2">Style DNA Maker</h2>
        <p className="text-sm text-gray-600">
          Paste real writing samples, extract a reusable style fingerprint, save it, then optionally apply that DNA inside the Prompt Writer.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="gemini-panel">
          <label className="block mb-1">Style DNA Name</label>
          <input
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Deadpan startup founder"
          />

          <label className="block mb-1">Writing Samples</label>
          <textarea
            value={samples}
            onChange={(event) => onSamplesChange(event.target.value)}
            className="w-full p-2 border rounded"
            rows={9}
            placeholder="Paste a few paragraphs of authentic writing here..."
          />

          <div className="style-dna-meta-row">
            <span className="voice-language-pill">{analysisEngineLabel}</span>
            <span className="style-dna-char-count">{samples.length.toLocaleString()} chars</span>
          </div>

          <div className="gemini-action-row">
            <button
              type="button"
              className="gemini-generate-button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? 'Extracting...' : 'Extract style DNA'}
            </button>
            <button
              type="button"
              className="gemini-save-button"
              onClick={onSave}
              disabled={isSaving || !draftProfile}
            >
              {isSaving ? 'Saving...' : 'Save style DNA'}
            </button>
            <button
              type="button"
              className="gemini-secondary-button"
              onClick={onClearDraft}
            >
              Clear draft
            </button>
          </div>

          <div className="style-dna-profile-card">
            <div className="system-prompt-library-header">
              <strong>Current fingerprint</strong>
              {draftProfile && <span className="system-prompt-count">Ready</span>}
            </div>

            {!draftProfile && (
              <p className="audio-empty-copy">
                Extract a profile first. The saved prompt writer can then use it as an optional voice layer.
              </p>
            )}

            {draftProfile && (
              <div className="style-dna-profile-body">
                {STYLE_DNA_DIMS.map((dimension) => (
                  <StyleDnaDimensionBar
                    key={dimension.key}
                    label={dimension.label}
                    left={dimension.left}
                    right={dimension.right}
                    value={draftProfile[dimension.key]}
                  />
                ))}

                {draftProfile.distinctive_patterns.length > 0 && (
                  <div className="style-dna-pattern-block">
                    <strong>Distinctive patterns</strong>
                    <div className="style-dna-pattern-list">
                      {draftProfile.distinctive_patterns.map((pattern) => (
                        <span key={pattern} className="style-dna-tag">{pattern}</span>
                      ))}
                    </div>
                  </div>
                )}

                {draftProfile.style_summary && (
                  <p className="style-dna-summary">{draftProfile.style_summary}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="gemini-panel">
          <div className="system-prompt-library">
            <div className="system-prompt-library-header">
              <strong>Saved style DNA</strong>
              <span className="system-prompt-count">{savedProfiles.length}</span>
            </div>
            <div className="system-prompt-list">
              {savedProfiles.length === 0 && (
                <p className="audio-empty-copy">No Style DNA saved yet.</p>
              )}

              {savedProfiles.map((item) => (
                <div key={item.id} className={`system-prompt-card${selectedStyleDnaId === String(item.id) ? ' system-prompt-card-selected' : ''}`}>
                  <div className="system-prompt-card-header">
                    <strong>{item.name}</strong>
                    <span className="audio-date">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="system-prompt-preview">{item.profile.style_summary || 'No summary saved.'}</p>
                  {item.profile.distinctive_patterns.length > 0 && (
                    <div className="style-dna-pattern-list style-dna-pattern-list-compact">
                      {item.profile.distinctive_patterns.slice(0, 4).map((pattern) => (
                        <span key={pattern} className="style-dna-tag">{pattern}</span>
                      ))}
                    </div>
                  )}
                  <div className="system-prompt-actions">
                    <button
                      type="button"
                      className="gemini-secondary-button"
                      onClick={() => onSelectProfileForWriter(String(item.id))}
                    >
                      Use in writer
                    </button>
                    <button
                      type="button"
                      className="system-prompt-delete"
                      onClick={() => onDeleteProfile(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
