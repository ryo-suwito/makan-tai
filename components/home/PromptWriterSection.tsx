import { useMemo, useState } from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import type { SingleValue } from 'react-select';
import {
  OPENROUTER_AUTO_OPTION,
  OPENROUTER_FREE_OPTION,
  createOpenRouterCustomOption,
  type OpenRouterModelOption,
  type SavedStyleDnaProfile,
  type SystemPrompt,
  type TextGenerationResult,
  type TextProvider,
  type WorkflowSegmentDraft,
} from '@/components/home/types';

interface PromptWriterSectionProps {
  currentInput: string;
  currentResult: TextGenerationResult | null;
  currentOutputText: string;
  currentStyleDna: SavedStyleDnaProfile | null;
  currentSystemPrompt: SystemPrompt | null;
  favoriteOpenRouterModels: OpenRouterModelOption[];
  isSelectedOpenRouterFavorite: boolean;
  openRouterModel: OpenRouterModelOption;
  openRouterModelsError: string | null;
  outputCharacterCount: number;
  provider: TextProvider;
  selectedStyleDnaId: string;
  selectedSystemPromptId: string;
  styleDnaProfiles: SavedStyleDnaProfile[];
  systemPromptDraftName: string;
  systemPromptDraftText: string;
  systemPromptSaving: boolean;
  systemPrompts: SystemPrompt[];
  isCreatingWorkflow: boolean;
  isGenerating: boolean;
  isPublishingToThreads: boolean;
  isThreadsLengthExceeded: boolean;
  isThreadsReady: boolean;
  onApplyTextToImagePrompt: () => void;
  onApplyTextToVoicePrompt: () => void;
  onAddOpenRouterFavorite: () => void;
  onClearSystemPromptDraft: () => void;
  onCreateWorkflowFromSegments: (title: string, segments: WorkflowSegmentDraft[]) => Promise<void>;
  onCurrentInputChange: (value: string) => void;
  onCurrentOutputTextChange: (value: string) => void;
  onDeleteSystemPrompt: (id: number) => void;
  onGenerateText: () => void;
  onLoadOpenRouterOptions: (query: string) => Promise<OpenRouterModelOption[]>;
  onLoadSystemPromptIntoEditor: (item: SystemPrompt) => void;
  onPublishToThreads: () => void;
  onProviderChange: (provider: TextProvider) => void;
  onRemoveOpenRouterFavorite: (value: string) => void;
  onSaveSystemPrompt: () => void;
  onSelectOpenRouterModel: (option: OpenRouterModelOption) => void;
  onSelectQuickOpenRouterFavorite: (option: OpenRouterModelOption) => void;
  onSelectedStyleDnaIdChange: (value: string) => void;
  onSelectedSystemPromptIdChange: (value: string) => void;
  onSystemPromptDraftNameChange: (value: string) => void;
  onSystemPromptDraftTextChange: (value: string) => void;
}

export function PromptWriterSection({
  currentInput,
  currentResult,
  currentOutputText,
  currentStyleDna,
  currentSystemPrompt,
  favoriteOpenRouterModels,
  isSelectedOpenRouterFavorite,
  openRouterModel,
  openRouterModelsError,
  outputCharacterCount,
  provider,
  selectedStyleDnaId,
  selectedSystemPromptId,
  styleDnaProfiles,
  systemPromptDraftName,
  systemPromptDraftText,
  systemPromptSaving,
  systemPrompts,
  isCreatingWorkflow,
  isGenerating,
  isPublishingToThreads,
  isThreadsLengthExceeded,
  isThreadsReady,
  onApplyTextToImagePrompt,
  onApplyTextToVoicePrompt,
  onAddOpenRouterFavorite,
  onClearSystemPromptDraft,
  onCreateWorkflowFromSegments,
  onCurrentInputChange,
  onCurrentOutputTextChange,
  onDeleteSystemPrompt,
  onGenerateText,
  onLoadOpenRouterOptions,
  onLoadSystemPromptIntoEditor,
  onPublishToThreads,
  onProviderChange,
  onRemoveOpenRouterFavorite,
  onSaveSystemPrompt,
  onSelectOpenRouterModel,
  onSelectQuickOpenRouterFavorite,
  onSelectedStyleDnaIdChange,
  onSelectedSystemPromptIdChange,
  onSystemPromptDraftNameChange,
  onSystemPromptDraftTextChange,
}: PromptWriterSectionProps) {
  const [detailPrompt, setDetailPrompt] = useState<SystemPrompt | null>(null);
  const [workflowTitle, setWorkflowTitle] = useState('');
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const threadsButtonLabel = isPublishingToThreads ? 'Publishing to Threads...' : 'Publish to Threads';
  const openRouterDefaultOptions = [
    ...favoriteOpenRouterModels,
    OPENROUTER_FREE_OPTION,
    OPENROUTER_AUTO_OPTION,
  ].filter((option, index, all) => all.findIndex((item) => item.value === option.value) === index);
  const formatSystemPromptDate = (date: string) => new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const workflowSegments = useMemo(
    () => parseWorkflowSegmentsFromText(currentOutputText),
    [currentOutputText],
  );
  const canAddToWorkflow = workflowSegments.length > 0;

  const openWorkflowModal = () => {
    const fallbackTitle = currentResult?.systemPromptName || currentResult?.styleDnaName || 'Generated workflow';
    setWorkflowTitle(fallbackTitle);
    setWorkflowModalOpen(true);
  };

  const submitWorkflow = async () => {
    const title = workflowTitle.trim();
    if (!title || workflowSegments.length === 0) {
      return;
    }

    await onCreateWorkflowFromSegments(title, workflowSegments);
    setWorkflowModalOpen(false);
  };

  return (
    <div className="gemini-section mt-6">
      <div className="gemini-section-header">
        <p className="voice-section-kicker">Text Models</p>
        <h2 className="text-xl font-bold mb-2">Prompt Writer</h2>
        <p className="text-sm text-gray-600">One-shot generation only. Pick a saved system prompt, optionally layer a Style DNA profile on top, choose Gemini or OpenRouter, send one request, and copy the output into the image or voice workflow.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="gemini-panel">
          <label className="block mb-1">System Prompt Name</label>
          <input
            value={systemPromptDraftName}
            onChange={(event) => onSystemPromptDraftNameChange(event.target.value)}
            className="w-full p-2 border rounded mb-2"
            placeholder="Film noir image writer"
          />
          <label className="block mb-1">System Prompt Body</label>
          <textarea
            value={systemPromptDraftText}
            onChange={(event) => onSystemPromptDraftTextChange(event.target.value)}
            className="w-full p-2 border rounded"
            rows={7}
            placeholder="You write compact, visually rich prompts..."
          />
          <div className="gemini-action-row">
            <button
              type="button"
              className="gemini-save-button"
              onClick={onSaveSystemPrompt}
              disabled={systemPromptSaving}
            >
              {systemPromptSaving ? 'Saving...' : 'Save system prompt'}
            </button>
            <button
              type="button"
              className="gemini-secondary-button"
              onClick={onClearSystemPromptDraft}
            >
              Clear draft
            </button>
          </div>

        </div>

        <div className="gemini-panel">
          <label className="block mb-1">Text Provider</label>
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as TextProvider)}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="gemini">Gemini Direct</option>
            <option value="openrouter">OpenRouter</option>
          </select>

          {provider === 'openrouter' && (
            <>
              <div className="openrouter-favorites-header">
                <strong>Quick access</strong>
                <span className="system-prompt-count">{favoriteOpenRouterModels.length}</span>
              </div>

              {favoriteOpenRouterModels.length > 0 && (
                <div className="openrouter-favorites-list">
                  {favoriteOpenRouterModels.map((item) => (
                    <div
                      key={item.value}
                      className={`openrouter-favorite-chip${item.value === openRouterModel.value ? ' openrouter-favorite-chip-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="openrouter-favorite-pick"
                        onClick={() => onSelectQuickOpenRouterFavorite(item)}
                      >
                        <span>{item.label}</span>
                        <span className="openrouter-favorite-slug">{item.value}</span>
                      </button>
                      <button
                        type="button"
                        className="openrouter-favorite-remove"
                        onClick={() => onRemoveOpenRouterFavorite(item.value)}
                        aria-label={`Remove ${item.label} from favorites`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="block mb-1">OpenRouter Model</label>
              <div className="openrouter-model-select">
                <AsyncCreatableSelect
                  cacheOptions
                  classNamePrefix="openrouter-select"
                  defaultOptions={openRouterDefaultOptions}
                  formatCreateLabel={(inputValue) => `Use custom model slug: ${inputValue}`}
                  formatOptionLabel={(option) => (
                    <div>
                      <div>{option.label}</div>
                      <div className="openrouter-option-meta">{option.value}</div>
                    </div>
                  )}
                  isClearable={false}
                  loadOptions={onLoadOpenRouterOptions}
                  loadingMessage={() => 'Searching models...'}
                  menuPlacement="auto"
                  noOptionsMessage={({ inputValue }) => (inputValue ? 'No matching models.' : 'Type to search models.')}
                  onChange={(option: SingleValue<OpenRouterModelOption>) => {
                    if (option) {
                      onSelectOpenRouterModel(option);
                    }
                  }}
                  onCreateOption={(inputValue) => {
                    const customValue = inputValue.trim();
                    if (!customValue) {
                      return;
                    }
                    onSelectOpenRouterModel(createOpenRouterCustomOption(customValue));
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
                  onClick={() => onSelectOpenRouterModel(OPENROUTER_FREE_OPTION)}
                >
                  Use free router
                </button>
                <button
                  type="button"
                  className="gemini-secondary-button"
                  onClick={() => onSelectOpenRouterModel(OPENROUTER_AUTO_OPTION)}
                >
                  Use auto router
                </button>
                <button
                  type="button"
                  className="gemini-secondary-button"
                  onClick={isSelectedOpenRouterFavorite ? () => onRemoveOpenRouterFavorite(openRouterModel.value) : onAddOpenRouterFavorite}
                >
                  {isSelectedOpenRouterFavorite ? 'Remove favorite' : 'Save favorite'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Search is server-filtered, so the browser no longer downloads the full model catalog. Press Enter to use a custom slug that does not appear in the list. Favorites are stored on this server for quick reuse across sessions.
              </p>
              {openRouterModelsError && <p className="voice-error-copy">{openRouterModelsError}</p>}
            </>
          )}

          <label className="block mb-1">System Prompt for This Run</label>
          <select
            value={selectedSystemPromptId}
            onChange={(event) => onSelectedSystemPromptIdChange(event.target.value)}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="">No system prompt</option>
            {systemPrompts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          {currentSystemPrompt && (
            <p className="gemini-selected-system-prompt">
              Using: <strong>{currentSystemPrompt.name}</strong>
            </p>
          )}

          <label className="block mb-1">Style DNA for This Run</label>
          <select
            value={selectedStyleDnaId}
            onChange={(event) => onSelectedStyleDnaIdChange(event.target.value)}
            className="w-full p-2 border rounded mb-2"
          >
            <option value="">No style DNA</option>
            {styleDnaProfiles.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          {currentStyleDna && (
            <p className="gemini-selected-system-prompt">
              Style DNA: <strong>{currentStyleDna.name}</strong>
            </p>
          )}

          <label className="block mb-1">One-Shot Request</label>
          <textarea
            value={currentInput}
            onChange={(event) => onCurrentInputChange(event.target.value)}
            className="w-full p-2 border rounded"
            rows={8}
            placeholder="Write me a cinematic image prompt for..."
          />

          <div className="gemini-action-row">
            <button
              type="button"
              className="gemini-generate-button"
              onClick={onGenerateText}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          <div className="gemini-result-card">
            <div className="gemini-result-header">
              <strong>Output</strong>
              {currentResult?.model && <span className="voice-language-pill">{currentResult.model}</span>}
            </div>

            {!currentResult && (
              <p className="audio-empty-copy">Your one-shot result will appear here.</p>
            )}

            {currentResult && (
              <>
                {currentResult.systemPromptName && (
                  <p className="gemini-selected-system-prompt">
                    System prompt: <strong>{currentResult.systemPromptName}</strong>
                  </p>
                )}
                {currentResult.styleDnaName && (
                  <p className="gemini-selected-system-prompt">
                    Style DNA: <strong>{currentResult.styleDnaName}</strong>
                  </p>
                )}
                {currentResult.provider === 'openrouter' && (
                  <p className="gemini-selected-system-prompt">
                    Route: <strong>{currentResult.model}</strong>
                  </p>
                )}
                {currentResult.provider === 'openrouter' && currentResult.resolvedModel && currentResult.resolvedModel !== currentResult.model && (
                  <p className="gemini-selected-system-prompt">
                    Resolved model: <strong>{currentResult.resolvedModel}</strong>
                  </p>
                )}
                <div className="gemini-output-meta-row">
                  <span className={`gemini-char-pill${isThreadsLengthExceeded ? ' gemini-char-pill-warning' : ''}`}>
                    {outputCharacterCount} chars
                  </span>
                  <span className={`gemini-char-pill${isThreadsLengthExceeded ? ' gemini-char-pill-warning' : ''}`}>
                    Threads max 500
                  </span>
                </div>
                {isThreadsLengthExceeded && (
                  <p className="voice-error-copy">
                    Trim this output to 500 characters or fewer before publishing to Threads.
                  </p>
                )}
                <textarea
                  value={currentOutputText}
                  onChange={(event) => onCurrentOutputTextChange(event.target.value)}
                  className="gemini-output-textarea"
                  rows={10}
                />
                <div className="gemini-copy-row">
                  {canAddToWorkflow && (
                    <button type="button" className="gemini-save-button" onClick={openWorkflowModal}>
                      Add to workflow
                    </button>
                  )}
                  <button type="button" className="gemini-copy-button" onClick={onApplyTextToImagePrompt}>
                    Copy to image prompt
                  </button>
                  <button type="button" className="gemini-copy-button" onClick={onApplyTextToVoicePrompt}>
                    Copy to voice prompt
                  </button>
                  <button
                    type="button"
                    className="threads-publish-button"
                    onClick={onPublishToThreads}
                    disabled={!isThreadsReady || isThreadsLengthExceeded || isPublishingToThreads}
                  >
                    {threadsButtonLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="system-prompt-library system-prompt-library-entity">
        <div className="system-prompt-library-header">
          <strong>Saved system prompts</strong>
          <span className="system-prompt-count">{systemPrompts.length}</span>
        </div>
        <div className="system-prompt-table-shell">
          {systemPrompts.length === 0 && (
            <p className="audio-empty-copy">No system prompts saved yet.</p>
          )}

          {systemPrompts.length > 0 && (
            <table className="system-prompt-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Preview</th>
                  <th scope="col">Saved</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {systemPrompts.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedSystemPromptId === String(item.id) ? 'system-prompt-row-active' : undefined}
                    onClick={() => setDetailPrompt(item)}
                  >
                    <td>
                      <button
                        type="button"
                        className="system-prompt-name-button"
                        onClick={() => setDetailPrompt(item)}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="system-prompt-preview-button"
                        onClick={() => setDetailPrompt(item)}
                      >
                        {item.text}
                      </button>
                    </td>
                    <td className="system-prompt-date-cell">{formatSystemPromptDate(item.created_at)}</td>
                    <td>
                      <div className="system-prompt-table-actions" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="system-prompt-load-small" onClick={() => onLoadSystemPromptIntoEditor(item)}>
                          Load
                        </button>
                        <button type="button" className="system-prompt-delete-small" onClick={() => onDeleteSystemPrompt(item.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detailPrompt && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setDetailPrompt(null)}>
          <div
            className="system-prompt-detail-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-prompt-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">Saved system prompt</p>
                <h3 id="system-prompt-detail-title">{detailPrompt.name}</h3>
              </div>
              <button
                type="button"
                className="system-prompt-detail-close"
                onClick={() => setDetailPrompt(null)}
                aria-label="Close system prompt detail"
              >
                x
              </button>
            </div>
            <p className="system-prompt-detail-date">Saved {formatSystemPromptDate(detailPrompt.created_at)}</p>
            <pre className="system-prompt-detail-text">{detailPrompt.text}</pre>
            <div className="system-prompt-detail-actions">
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => {
                  onLoadSystemPromptIntoEditor(detailPrompt);
                  setDetailPrompt(null);
                }}
              >
                Load
              </button>
              <button
                type="button"
                className="system-prompt-delete"
                onClick={() => {
                  onDeleteSystemPrompt(detailPrompt.id);
                  setDetailPrompt(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {workflowModalOpen && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setWorkflowModalOpen(false)}>
          <div
            className="system-prompt-detail-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">Workflow</p>
                <h3 id="workflow-title">Add segments to workflow</h3>
              </div>
              <button
                type="button"
                className="system-prompt-detail-close"
                onClick={() => setWorkflowModalOpen(false)}
                aria-label="Close workflow dialog"
              >
                x
              </button>
            </div>
            <p className="system-prompt-detail-date">
              {workflowSegments.length} segment{workflowSegments.length === 1 ? '' : 's'} will start in Todo.
            </p>
            <label className="block mb-1">Workflow Title</label>
            <input
              value={workflowTitle}
              onChange={(event) => setWorkflowTitle(event.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Launch script batch"
            />
            <div className="system-prompt-detail-actions">
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => setWorkflowModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gemini-save-button"
                onClick={() => { void submitWorkflow(); }}
                disabled={!workflowTitle.trim() || isCreatingWorkflow}
              >
                {isCreatingWorkflow ? 'Saving...' : 'Save workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractJsonCandidate(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}

function parseWorkflowSegmentsFromText(value: string): WorkflowSegmentDraft[] {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(extractJsonCandidate(value)) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { segments?: unknown }).segments)) {
      return [];
    }

    return (parsed as { segments: unknown[] }).segments
      .map((segment, index) => {
        if (!segment || typeof segment !== 'object') {
          return null;
        }

        const record = segment as Record<string, unknown>;
        const text = typeof record.text === 'string' ? record.text.trim() : '';
        const imagePrompt = typeof record.image_prompt === 'string' ? record.image_prompt.trim() : '';
        const videoPrompt = typeof record.video_prompt === 'string' ? record.video_prompt.trim() : '';

        if (!text && !imagePrompt && !videoPrompt) {
          return null;
        }

        return {
          order: Number.isFinite(Number(record.order)) ? Number(record.order) : index + 1,
          text,
          image_prompt: imagePrompt,
          video_no_sound: Boolean(record.video_no_sound),
          video_prompt: videoPrompt,
        } satisfies WorkflowSegmentDraft;
      })
      .filter((segment): segment is WorkflowSegmentDraft => segment !== null)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}
