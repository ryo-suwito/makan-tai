import { useEffect, useState } from 'react';
import type {
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

const AUTO_ADVANCE_DELAY_MS = 10_000;
const NEXT_WORKFLOW_STATUS: Partial<Record<WorkflowSegmentStatus, WorkflowSegmentStatus>> = {
  todo: 'voice',
  voice: 'image',
  image: 'video',
  video: 'done',
};

interface WorkflowBoardSectionProps {
  isLoading: boolean;
  workflows: Workflow[];
  onError: (title: string, err: unknown) => void;
  onGenerateVoice: (segment: WorkflowSegment) => Promise<GeneratedWorkflowVoice>;
  onGenerateImage: (segment: WorkflowSegment) => Promise<string>;
  onGenerateVideo: (segment: WorkflowSegment) => Promise<string>;
  onReload: () => Promise<void>;
}

interface SegmentDraftState {
  image_prompt: string;
  srt: string | null;
  text: string;
  video_no_sound: boolean;
  video_prompt: string;
}

interface GeneratedWorkflowVoice {
  srt: string | null;
  voiceUrl: string;
}

interface NukeDialogState {
  armedIn: number;
  expiresIn: number;
  workflow: Workflow;
}

function getSegmentPreviewText(segment: WorkflowSegment) {
  const text = segment.text || segment.image_prompt || segment.video_prompt || 'No prompt text saved.';
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
}

export function WorkflowBoardSection({
  isLoading,
  workflows,
  onError,
  onGenerateVoice,
  onGenerateImage,
  onGenerateVideo,
  onReload,
}: WorkflowBoardSectionProps) {
  const [busySegmentId, setBusySegmentId] = useState<number | null>(null);
  const [busyWorkflowId, setBusyWorkflowId] = useState<number | null>(null);
  const [autoAdvancingStatus, setAutoAdvancingStatus] = useState<WorkflowSegmentStatus | null>(null);
  const [autoAdvancingSegmentId, setAutoAdvancingSegmentId] = useState<number | null>(null);
  const [editingSegment, setEditingSegment] = useState<WorkflowSegment | null>(null);
  const [draft, setDraft] = useState<SegmentDraftState>({
    text: '',
    image_prompt: '',
    srt: null,
    video_no_sound: false,
    video_prompt: '',
  });
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
      srt: segment.srt,
      video_no_sound: segment.video_no_sound,
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

  const assembleSegment = async (segment: WorkflowSegment) => {
    const response = await fetch('/api/workflows/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segmentId: segment.id,
        videoUrl: segment.video_url,
        videoNoSound: segment.video_no_sound,
        voiceUrl: segment.voice_url,
        srt: segment.srt,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.data?.url !== 'string') {
      throw new Error(typeof data.error === 'string' ? data.error : 'Failed to assemble workflow segment.');
    }

    return toRelativeAssetUrl(data.data.url);
  };

  const pause = (durationMs: number) => new Promise((resolve) => window.setTimeout(resolve, durationMs));

  const replaceSegmentAsset = async (
    segment: WorkflowSegment,
    assetKey: 'image_url',
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

  const replaceSegmentVoice = async (segment: WorkflowSegment) => {
    setBusySegmentId(segment.id);

    try {
      const oldUrl = segment.voice_url;
      const generated = await onGenerateVoice(segment);
      const nextSegment: WorkflowSegment = {
        ...segment,
        voice_url: toRelativeAssetUrl(generated.voiceUrl),
        srt: generated.srt,
        assembled_url: null,
      };
      let assembledUrl: string | null = null;

      if (segment.status === 'done' && nextSegment.video_url && nextSegment.srt) {
        assembledUrl = await assembleSegment(nextSegment);
      }

      const updatedSegment = await updateSegment(segment.id, {
        voice_url: toRelativeAssetUrl(generated.voiceUrl),
        srt: generated.srt,
        assembled_url: assembledUrl,
      });
      setEditingSegment((current) => (current?.id === segment.id ? updatedSegment : current));
      await deleteAsset(oldUrl);
      await onReload();
    } catch (err) {
      onError('Workflow regenerate failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const replaceSegmentVideo = async (segment: WorkflowSegment) => {
    setBusySegmentId(segment.id);

    try {
      const oldUrl = segment.video_url;
      const nextVideoUrl = toRelativeAssetUrl(await onGenerateVideo(segment));
      const nextSegment: WorkflowSegment = {
        ...segment,
        video_url: nextVideoUrl,
        assembled_url: null,
      };
      let assembledUrl: string | null = null;

      if (segment.status === 'done' && nextSegment.voice_url && nextSegment.srt) {
        assembledUrl = await assembleSegment(nextSegment);
      }

      const updatedSegment = await updateSegment(segment.id, {
        video_url: nextVideoUrl,
        assembled_url: assembledUrl,
      });
      setEditingSegment((current) => (current?.id === segment.id ? updatedSegment : current));
      await deleteAsset(oldUrl);
      await onReload();
    } catch (err) {
      onError('Workflow regenerate failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const replaceSegmentAssembled = async (segment: WorkflowSegment) => {
    setBusySegmentId(segment.id);

    try {
      if (!segment.video_url || !segment.voice_url || !segment.srt) {
        throw new Error('Re-assemble requires a video clip, voice clip, and SRT captions.');
      }

      const oldUrl = segment.assembled_url;
      const assembledUrl = await assembleSegment(segment);
      const updatedSegment = await updateSegment(segment.id, {
        assembled_url: assembledUrl,
      });
      setEditingSegment((current) => (current?.id === segment.id ? updatedSegment : current));
      await deleteAsset(oldUrl);
      await onReload();
    } catch (err) {
      onError('Workflow re-assemble failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const moveSegment = async (segment: WorkflowSegment, status: WorkflowSegmentStatus) => {
    setBusySegmentId(segment.id);

    try {
      const updates: Partial<WorkflowSegment> = { status };
      const workingSegment: WorkflowSegment = { ...segment };

      if ((status === 'voice' || status === 'done') && (!workingSegment.voice_url || !workingSegment.srt)) {
        const generated = await onGenerateVoice(workingSegment);
        updates.voice_url = toRelativeAssetUrl(generated.voiceUrl);
        updates.srt = generated.srt;
        updates.assembled_url = null;
        workingSegment.voice_url = toRelativeAssetUrl(generated.voiceUrl);
        workingSegment.srt = generated.srt;
        workingSegment.assembled_url = null;
      }

      if ((status === 'image' || (status === 'done' && !workingSegment.video_url)) && !workingSegment.image_url) {
        updates.image_url = toRelativeAssetUrl(await onGenerateImage(workingSegment));
        workingSegment.image_url = updates.image_url;
      }

      if ((status === 'video' || status === 'done') && !workingSegment.video_url) {
        updates.video_url = toRelativeAssetUrl(await onGenerateVideo(workingSegment));
        updates.assembled_url = null;
        workingSegment.video_url = updates.video_url;
        workingSegment.assembled_url = null;
      }

      if (status === 'done') {
        if (!workingSegment.video_url || !workingSegment.voice_url || !workingSegment.srt) {
          throw new Error('Done assembly requires a video clip, voice clip, and SRT captions.');
        }

        updates.assembled_url = await assembleSegment(workingSegment);
      }

      await updateSegment(segment.id, updates);
      await onReload();
    } catch (err) {
      onError('Workflow move failed', err);
    } finally {
      setBusySegmentId(null);
    }
  };

  const autoAdvanceColumn = async (status: WorkflowSegmentStatus) => {
    const nextStatus = NEXT_WORKFLOW_STATUS[status];
    if (!nextStatus) {
      return;
    }

    const queuedSegments = workflows.flatMap((workflow) => (
      workflow.segments
        .filter((segment) => segment.status === status)
        .map((segment) => segment)
    ));

    if (queuedSegments.length === 0) {
      return;
    }

    setAutoAdvancingStatus(status);

    try {
      for (let index = 0; index < queuedSegments.length; index += 1) {
        const segment = queuedSegments[index];
        setAutoAdvancingSegmentId(segment.id);
        await moveSegment(segment, nextStatus);

        if (index < queuedSegments.length - 1) {
          await pause(AUTO_ADVANCE_DELAY_MS);
        }
      }
    } finally {
      setAutoAdvancingSegmentId(null);
      setAutoAdvancingStatus(null);
    }
  };

  const isBoardBusy = isLoading || autoAdvancingStatus !== null || busySegmentId !== null || busyWorkflowId !== null;

  const saveDraft = async () => {
    if (!editingSegment) {
      return;
    }

    setBusySegmentId(editingSegment.id);
    try {
      const oldAssembledUrl = editingSegment.assembled_url;
      const nextSegment = {
        ...editingSegment,
        ...draft,
      };
      let assembledUrl = editingSegment.assembled_url;

      if (
        editingSegment.status === 'done'
        && editingSegment.video_no_sound !== draft.video_no_sound
        && nextSegment.video_url
        && nextSegment.voice_url
        && nextSegment.srt
      ) {
        assembledUrl = await assembleSegment(nextSegment);
      }

      const updatedSegment = await updateSegment(editingSegment.id, {
        ...draft,
        assembled_url: assembledUrl,
      });
      setEditingSegment((current) => (current?.id === editingSegment.id ? updatedSegment : current));
      if (assembledUrl && oldAssembledUrl && assembledUrl !== oldAssembledUrl) {
        await deleteAsset(oldAssembledUrl);
      }
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

  const finalizeWorkflow = async (workflow: Workflow) => {
    setBusyWorkflowId(workflow.id);

    try {
      const response = await fetch('/api/workflows/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: workflow.id }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to finalize workflow.');
      }

      await onReload();
    } catch (err) {
      onError('Workflow finalize failed', err);
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
              <div className="workflow-control-meta">
                <strong>{workflow.title}</strong>
                <p className="audio-empty-copy">{workflow.segments.length} segment{workflow.segments.length === 1 ? '' : 's'}</p>
                {workflow.finalized_url && (
                  <div className="workflow-link-row">
                    <a className="workflow-link" href={buildDisplayUrl(workflow.finalized_url)} target="_blank" rel="noreferrer">
                      Open final
                    </a>
                    <a className="workflow-link" href={buildDisplayUrl(workflow.finalized_url)} download>
                      Download
                    </a>
                  </div>
                )}
              </div>
              <div className="workflow-control-actions">
                <button
                  type="button"
                  className="gemini-secondary-button"
                  onClick={() => { void finalizeWorkflow(workflow); }}
                  disabled={isBoardBusy || !workflow.segments.some((segment) => Boolean(segment.assembled_url))}
                >
                  {busyWorkflowId === workflow.id ? 'Finalizing...' : 'Finalize'}
                </button>
                <button
                  type="button"
                  className="workflow-nuke-button"
                  onClick={() => openNukeDialog(workflow)}
                  disabled={isBoardBusy}
                >
                  Nuke workflow
                </button>
              </div>
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
                <div className="workflow-column-meta">
                  <strong>{column.label}</strong>
                  <span className="system-prompt-count">{columnSegments.length}</span>
                </div>
                {NEXT_WORKFLOW_STATUS[column.status] && (
                  <button
                    type="button"
                    className="gemini-secondary-button"
                    disabled={isBoardBusy || columnSegments.length === 0}
                    onClick={() => { void autoAdvanceColumn(column.status); }}
                  >
                    {autoAdvancingStatus === column.status
                      ? `Running ${autoAdvancingSegmentId ? `#${autoAdvancingSegmentId}` : '...'}`
                      : `Auto->${NEXT_WORKFLOW_STATUS[column.status]}`}
                  </button>
                )}
              </div>

              <div className="workflow-card-list">
                {columnSegments.length === 0 && (
                  <p className="audio-empty-copy">No cards here.</p>
                )}

                {columnSegments.map(({ workflow, segment }) => {
                  const videoPreviewUrl = segment.assembled_url || segment.video_url;
                  const imagePreviewUrl = videoPreviewUrl ? '' : segment.image_url;

                  return (
                    <article key={segment.id} className="workflow-segment-item">
                      {(videoPreviewUrl || imagePreviewUrl) && (
                        <div className="workflow-segment-preview">
                          {videoPreviewUrl ? (
                            <video controls preload="metadata" playsInline className="workflow-segment-media workflow-segment-video" src={buildDisplayUrl(videoPreviewUrl)} />
                          ) : (
                            <img className="workflow-segment-media workflow-segment-image" src={buildDisplayUrl(imagePreviewUrl)} alt="" />
                          )}
                          <span className="workflow-segment-badge">Segment {segment.order}</span>
                        </div>
                      )}

                      <div className="workflow-segment-body">
                        <button type="button" className="workflow-card-main" onClick={() => openEditor(segment)}>
                          <strong className="workflow-segment-title">{workflow.title}</strong>
                          <span className="workflow-segment-meta">
                            Segment {segment.order} • {segment.status}
                          </span>
                          <span className="workflow-segment-text">{getSegmentPreviewText(segment)}</span>
                        </button>

                        {segment.voice_url && (
                          <audio controls preload="none" className="audio-player" src={buildDisplayUrl(segment.voice_url)} />
                        )}

                        <div className="workflow-segment-actions workflow-card-actions">
                          <button
                            type="button"
                            className="gemini-secondary-button"
                            disabled={busySegmentId === segment.id || isBoardBusy}
                            onClick={() => { void replaceSegmentVoice(segment); }}
                          >
                            Regenerate voice
                          </button>
                          <button
                            type="button"
                            className="gemini-secondary-button"
                            disabled={busySegmentId === segment.id || isBoardBusy}
                            onClick={() => {
                              void replaceSegmentAsset(segment, 'image_url', async () => toRelativeAssetUrl(await onGenerateImage(segment)));
                            }}
                          >
                            Regenerate image
                          </button>
                          <button
                            type="button"
                            className="gemini-secondary-button"
                            disabled={busySegmentId === segment.id || isBoardBusy}
                            onClick={() => { void replaceSegmentVideo(segment); }}
                          >
                            Regenerate video
                          </button>
                          <button
                            type="button"
                            className="gemini-secondary-button"
                            disabled={busySegmentId === segment.id || isBoardBusy || !segment.video_url || !segment.voice_url || !segment.srt}
                            onClick={() => { void replaceSegmentAssembled(segment); }}
                          >
                            Re-assemble
                          </button>
                        </div>

                        <div className="workflow-segment-actions workflow-card-actions">
                          {WORKFLOW_COLUMNS.map((target) => (
                            <button
                              key={target.status}
                              type="button"
                              className={target.status === segment.status ? 'workflow-status-active' : 'gemini-secondary-button'}
                              disabled={busySegmentId === segment.id || target.status === segment.status || isBoardBusy}
                              onClick={() => { void moveSegment(segment, target.status); }}
                            >
                              {target.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
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
            className="system-prompt-detail-card workflow-detail-card"
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

            <label className="video-checkbox-row">
              <input
                type="checkbox"
                checked={draft.video_no_sound}
                onChange={(event) => setDraft((current) => ({ ...current, video_no_sound: event.target.checked }))}
              />
              <span>Mute source video audio in final assembly</span>
            </label>

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
              <div>
                <span className="cockpit-meta-label">Assembled URL</span>
                <p className="cockpit-meta-value">{editingSegment.assembled_url || 'Not assembled'}</p>
              </div>
              <div>
                <span className="cockpit-meta-label">SRT</span>
                <p className="cockpit-meta-value">{editingSegment.srt ? 'Available' : 'Not generated'}</p>
              </div>
              <div>
                <span className="cockpit-meta-label">Video Audio</span>
                <p className="cockpit-meta-value">{draft.video_no_sound ? 'Muted in assembly' : 'Mixed at 40%'}</p>
              </div>
            </div>

            <div className="system-prompt-detail-actions">
              <button type="button" className="gemini-secondary-button" onClick={() => { void replaceSegmentVoice(editingSegment); }} disabled={busySegmentId === editingSegment.id}>
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
              <button type="button" className="gemini-secondary-button" onClick={() => { void replaceSegmentVideo(editingSegment); }} disabled={busySegmentId === editingSegment.id}>
                Regenerate video
              </button>
              <button
                type="button"
                className="gemini-secondary-button"
                onClick={() => { void replaceSegmentAssembled(editingSegment); }}
                disabled={busySegmentId === editingSegment.id || !editingSegment.video_url || !editingSegment.voice_url || !editingSegment.srt}
              >
                Re-assemble
              </button>
              <button type="button" className="gemini-secondary-button" onClick={() => setEditingSegment(null)}>
                Cancel
              </button>
              <button type="button" className="gemini-save-button" onClick={() => { void saveDraft(); }} disabled={busySegmentId === editingSegment.id}>
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
              <button type="button" className="system-prompt-detail-close" onClick={() => setNukeDialog(null)} aria-label="Cancel workflow nuke">
                x
              </button>
            </div>

            <div className="workflow-nuke-summary">
              <strong>{nukeDialog.workflow.title}</strong>
              <p>
                This removes the workflow, all segment cards, and local generated assets attached to those cards.
              </p>
              <span className="workflow-nuke-countdown">
                {nukeDialog.armedIn > 0 ? `Arming in ${nukeDialog.armedIn}s` : `Auto-cancel in ${nukeDialog.expiresIn}s`}
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
