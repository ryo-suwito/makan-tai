import { useEffect, useState } from 'react';
import type {
  CartesiaVoice,
  Workflow,
  WorkflowSegment,
  WorkflowSegmentStatus,
} from '@/components/home/types';

const WORKFLOW_COLUMNS: { label: string; status: WorkflowSegmentStatus }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'voice', label: 'Voice' },
  { status: 'image', label: 'Image' },
  { status: 'video', label: 'Video' },
  { status: 'done', label: 'Done' },
];

interface WorkflowBoardSectionProps {
  isLoading: boolean;
  selectedVoice: CartesiaVoice | null;
  workflows: Workflow[];
  onError: (title: string, err: unknown) => void;
  onGenerateImage: (segment: WorkflowSegment) => Promise<string>;
  onReload: () => Promise<void>;
}

interface SegmentDraftState {
  image_prompt: string;
  text: string;
  video_prompt: string;
}

interface NukeDialogState {
  armedIn: number;
  expiresIn: number;
  workflow: Workflow;
}

export function WorkflowBoardSection({
  isLoading,
  selectedVoice,
  workflows,
  onError,
  onGenerateImage,
  onReload,
}: WorkflowBoardSectionProps) {
  const [busySegmentId, setBusySegmentId] = useState<number | null>(null);
  const [busyWorkflowId, setBusyWorkflowId] = useState<number | null>(null);
  const [editingSegment, setEditingSegment] = useState<WorkflowSegment | null>(null);
  const [draft, setDraft] = useState<SegmentDraftState>({ text: '', image_prompt: '', video_prompt: '' });
  const [nukeDialog, setNukeDialog] = useState<NukeDialogState | null>(null);

  useEffect(() => {
    if (!nukeDialog) {
      return;
    }

    const timer = window.setInterval(() => {
      setNukeDialog((current) => {
        if (!current) {
          return null;
        }

        const nextArmedIn = Math.max(0, current.armedIn - 1);
        const nextExpiresIn = current.expiresIn - 1;

        if (nextExpiresIn <= 0) {
          return null;
        }

        return {
          ...current,
          armedIn: nextArmedIn,
          expiresIn: nextExpiresIn,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [nukeDialog]);

  const openEditor = (segment: WorkflowSegment) => {
    setEditingSegment(segment);
    setDraft({
      text: segment.text,
      image_prompt: segment.image_prompt,
      video_prompt: segment.video_prompt,
    });
  };

  const updateSegment = async (id: number, updates: Partial<WorkflowSegment>) => {
    const response = await fetch('/api/workflows/segments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update workflow segment.');
    }

    return data.data as WorkflowSegment;
  };

  const deleteAsset = async (url: string | null) => {
    if (!url) {
      return;
    }

    await fetch('/api/assets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch((err) => {
      console.error('Failed to delete old workflow asset', err);
    });
  };

  const generateVoice = async (segment: WorkflowSegment) => {
    if (!selectedVoice) {
      throw new Error('Choose a Cartesia voice before generating workflow voice.');
    }

    const response = await fetch('/api/cartesia/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: segment.text,
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.data?.url !== 'string') {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate workflow voice.');
    }

    return toRelativeAssetUrl(data.data.url);
  };

  const replaceSegmentAsset = async (
    segment: WorkflowSegment,
    assetKey: 'image_url' | 'voice_url',
    generate: () => Promise<string>,
  ) => {
    setBusySegmentId(segment.id);

    try {
      const oldUrl = segment[assetKey];
      const nextUrl = await generate();
      const updatedSegment = await updateSegment(segment.id, { [assetKey]: nextUrl });
      setEditingSegment((current) => (current?.id === segment.id ? updatedSegment : current));
      await deleteAsset(oldUrl);
      await onReload();
    } catch (err) {
      onError('Workflow regenerate failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const moveSegment = async (segment: WorkflowSegment, status: WorkflowSegmentStatus) => {
    setBusySegmentId(segment.id);

    try {
      const updates: Partial<WorkflowSegment> = { status };

      if (status === 'voice' && !segment.voice_url) {
        updates.voice_url = await generateVoice(segment);
      }

      if (status === 'image' && !segment.image_url) {
        updates.image_url = toRelativeAssetUrl(await onGenerateImage(segment));
      }

      await updateSegment(segment.id, updates);
      await onReload();
    } catch (err) {
      onError('Workflow move failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const saveDraft = async () => {
    if (!editingSegment) {
      return;
    }

    setBusySegmentId(editingSegment.id);
    try {
      await updateSegment(editingSegment.id, draft);
      setEditingSegment(null);
      await onReload();
    } catch (err) {
      onError('Workflow update failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const openNukeDialog = (workflow: Workflow) => {
    setNukeDialog({
      workflow,
      armedIn: 3,
      expiresIn: 12,
    });
  };

  const nukeWorkflow = async () => {
    if (!nukeDialog || nukeDialog.armedIn > 0) {
      return;
    }

    const workflowId = nukeDialog.workflow.id;
    setBusyWorkflowId(workflowId);

    try {
      const response = await fetch(`/api/workflows?id=${workflowId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete workflow.');
      }

      setNukeDialog(null);
      await onReload();
    } catch (err) {
      onError('Workflow nuke failed', err);
    } finally {
      setBusyWorkflowId(null);
    }
  };

  return (
    <div className="workflow-section mt-6">
      <div className="gemini-section-header">
        <p className="voice-section-kicker">Persistent Board</p>
        <h2 className="text-xl font-bold mb-2">Workflows</h2>
        <p className="text-sm text-gray-600">
          JSON segments from Prompt Writer become persistent cards. Move a card into Voice or Image to generate missing media once.
        </p>
      </div>

      {workflows.length > 0 && (
        <div className="workflow-control-strip">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="workflow-control-item">
              <div>
                <strong>{workflow.title}</strong>
                <p className="audio-empty-copy">{workflow.segments.length} segment{workflow.segments.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                className="workflow-nuke-button"
                onClick={() => openNukeDialog(workflow)}
                disabled={busyWorkflowId === workflow.id || isLoading}
              >
                Nuke workflow
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="workflow-board">
        {WORKFLOW_COLUMNS.map((column) => {
          const columnSegments = workflows.flatMap((workflow) => (
            workflow.segments
              .filter((segment) => segment.status === column.status)
              .map((segment) => ({ workflow, segment }))
          ));

          return (
            <div key={column.status} className="workflow-column">
              <div className="workflow-column-header">
                <strong>{column.label}</strong>
                <span className="system-prompt-count">{columnSegments.length}</span>
              </div>

              <div className="workflow-card-list">
                {columnSegments.length === 0 && (
                  <p className="audio-empty-copy">No cards here.</p>
                )}

                {columnSegments.map(({ workflow, segment }) => (
                  <article key={segment.id} className="workflow-card">
                    <button type="button" className="workflow-card-main" onClick={() => openEditor(segment)}>
                      <span className="workflow-card-title">{workflow.title}</span>
                      <span className="workflow-card-order">Segment {segment.order}</span>
                      <span className="workflow-card-text">{segment.text || segment.image_prompt || segment.video_prompt}</span>
                    </button>

                    {segment.image_url && (
                      <img className="workflow-card-image" src={buildDisplayUrl(segment.image_url)} alt="" />
                    )}

                    {segment.voice_url && (
                      <audio controls preload="none" className="audio-player" src={buildDisplayUrl(segment.voice_url)} />
                    )}

                    <div className="workflow-card-actions">
                      <button
                        type="button"
                        className="gemini-secondary-button"
                        disabled={busySegmentId === segment.id || isLoading}
                        onClick={() => {
                          void replaceSegmentAsset(segment, 'voice_url', () => generateVoice(segment));
                        }}
                      >
                        Regenerate voice
                      </button>
                      <button
                        type="button"
                        className="gemini-secondary-button"
                        disabled={busySegmentId === segment.id || isLoading}
                        onClick={() => {
                          void replaceSegmentAsset(segment, 'image_url', async () => toRelativeAssetUrl(await onGenerateImage(segment)));
                        }}
                      >
                        Regenerate image
                      </button>
                    </div>

                    <div className="workflow-card-actions">
                      {WORKFLOW_COLUMNS.map((target) => (
                        <button
                          key={target.status}
                          type="button"
                          className={target.status === segment.status ? 'workflow-status-active' : 'gemini-secondary-button'}
                          disabled={busySegmentId === segment.id || target.status === segment.status || isLoading}
                          onClick={() => { void moveSegment(segment, target.status); }}
                        >
                          {target.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {workflows.length === 0 && (
        <div className="system-prompt-library">
          <p className="audio-empty-copy">
            No workflows yet. Generate parseable segment JSON in Prompt Writer, then use Add to workflow.
          </p>
        </div>
      )}

      {editingSegment && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setEditingSegment(null)}>
          <div
            className="system-prompt-detail-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="segment-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">Segment {editingSegment.order}</p>
                <h3 id="segment-edit-title">Edit workflow card</h3>
              </div>
              <button
                type="button"
                className="system-prompt-detail-close"
                onClick={() => setEditingSegment(null)}
                aria-label="Close segment editor"
              >
                x
              </button>
            </div>

            <label className="block mb-1">Text</label>
            <textarea
              value={draft.text}
              onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
              className="w-full p-2 border rounded"
              rows={4}
            />

            <label className="block mb-1">Image Prompt</label>
            <textarea
              value={draft.image_prompt}
              onChange={(event) => setDraft((current) => ({ ...current, image_prompt: event.target.value }))}
              className="w-full p-2 border rounded"
              rows={4}
            />

            <label className="block mb-1">Video Prompt</label>
            <textarea
              value={draft.video_prompt}
              onChange={(event) => setDraft((current) => ({ ...current, video_prompt: event.target.value }))}
              className="w-full p-2 border rounded"
              rows={4}
            />

            <div className="workflow-asset-grid">
              <div>
                <span className="cockpit-meta-label">Voice URL</span>
                <p className="cockpit-meta-value">{editingSegment.voice_url || 'Not generated'}</p>
              </div>
              <div>
                <span className="cockpit-meta-label">Image URL</span>
                <p className="cockpit-meta-value">{editingSegment.image_url || 'Not generated'}</p>
              </div>
              <div>
                <span className="cockpit-meta-label">Video URL</span>
                <p className="cockpit-meta-value">{editingSegment.video_url || 'TBD'}</p>
              </div>
            </div>

            <div className="system-prompt-detail-actions">
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => {
                  void replaceSegmentAsset(editingSegment, 'voice_url', () => generateVoice(editingSegment));
                }}
                disabled={busySegmentId === editingSegment.id}
              >
                Regenerate voice
              </button>
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => {
                  void replaceSegmentAsset(editingSegment, 'image_url', async () => toRelativeAssetUrl(await onGenerateImage(editingSegment)));
                }}
                disabled={busySegmentId === editingSegment.id}
              >
                Regenerate image
              </button>
              <button type="button" className="gemini-secondary-button" onClick={() => setEditingSegment(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="gemini-save-button"
                onClick={() => { void saveDraft(); }}
                disabled={busySegmentId === editingSegment.id}
              >
                {busySegmentId === editingSegment.id ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {nukeDialog && (
        <div className="system-prompt-detail-overlay" role="presentation" onClick={() => setNukeDialog(null)}>
          <div
            className="system-prompt-detail-card workflow-nuke-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workflow-nuke-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="system-prompt-detail-header">
              <div>
                <p className="voice-section-kicker">Destructive Action</p>
                <h3 id="workflow-nuke-title">Nuke workflow?</h3>
              </div>
              <button
                type="button"
                className="system-prompt-detail-close"
                onClick={() => setNukeDialog(null)}
                aria-label="Cancel workflow nuke"
              >
                x
              </button>
            </div>

            <div className="workflow-nuke-summary">
              <strong>{nukeDialog.workflow.title}</strong>
              <p>
                This removes the workflow, all segment cards, and local generated assets attached to those cards.
              </p>
              <span className="workflow-nuke-countdown">
                {nukeDialog.armedIn > 0
                  ? `Arming in ${nukeDialog.armedIn}s`
                  : `Auto-cancel in ${nukeDialog.expiresIn}s`}
              </span>
            </div>

            <div className="system-prompt-detail-actions">
              <button type="button" className="gemini-secondary-button" onClick={() => setNukeDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="workflow-nuke-confirm"
                onClick={() => { void nukeWorkflow(); }}
                disabled={nukeDialog.armedIn > 0 || busyWorkflowId === nukeDialog.workflow.id}
              >
                {busyWorkflowId === nukeDialog.workflow.id
                  ? 'Nuking...'
                  : nukeDialog.armedIn > 0
                    ? `Wait ${nukeDialog.armedIn}s`
                    : 'Nuke now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toRelativeAssetUrl(value: string) {
  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value;
  }
}

function buildDisplayUrl(value: string) {
  if (value.startsWith('/') && typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${value}`;
  }

  return value;
}
