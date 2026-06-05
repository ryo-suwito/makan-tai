import { NextRequest, NextResponse } from 'next/server';
import {
  createYouTubeConfig,
  deleteYouTubeConfig,
  getWorkflowById,
  getYouTubeConfigs,
  updateYouTubeConfig,
  updateWorkflowYouTubeConfig,
  type YouTubeConfigInput,
} from '@/lib/db';

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function parseConfigPayload(body: Record<string, unknown>): YouTubeConfigInput {
  const youtubeProfileId = body.youtube_profile_id === null || body.youtube_profile_id === ''
    ? null
    : Number(body.youtube_profile_id);

  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    youtube_profile_id: Number.isFinite(youtubeProfileId) && youtubeProfileId > 0 ? youtubeProfileId : null,
    title_template: typeof body.title_template === 'string' ? body.title_template.trim() : '{workflowTitle}',
    default_description: typeof body.default_description === 'string' ? body.default_description.trim() : '',
    default_tags: parseTags(body.default_tags),
    category_id: typeof body.category_id === 'string' ? body.category_id.trim() : '22',
    privacy_status: body.privacy_status === 'public' || body.privacy_status === 'unlisted' ? body.privacy_status : 'private',
    self_declared_made_for_kids: parseBoolean(body.self_declared_made_for_kids, false),
    contains_synthetic_media: parseBoolean(body.contains_synthetic_media, true),
    thumbnail_url: typeof body.thumbnail_url === 'string' ? body.thumbnail_url.trim() : null,
  };
}

export async function GET() {
  return NextResponse.json({ data: getYouTubeConfigs() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const workflowId = Number(body.workflow_id);
    if (Number.isFinite(workflowId) && workflowId > 0 && !getWorkflowById(workflowId)) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }
    const config = createYouTubeConfig(parseConfigPayload(body));
    const workflow = config && Number.isFinite(workflowId) && workflowId > 0
      ? updateWorkflowYouTubeConfig(workflowId, config.id)
      : null;
    if (Number.isFinite(workflowId) && workflowId > 0 && !workflow) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }
    return NextResponse.json({ data: config, workflow }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create YouTube config.' },
      { status: 400 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const id = Number(body.id);
    const workflowId = Number(body.workflow_id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid config id is required.' }, { status: 400 });
    }

    const config = updateYouTubeConfig(id, parseConfigPayload(body));
    if (!config) {
      return NextResponse.json({ error: 'YouTube config not found.' }, { status: 404 });
    }
    const workflow = Number.isFinite(workflowId) && workflowId > 0
      ? updateWorkflowYouTubeConfig(workflowId, config.id)
      : null;
    if (Number.isFinite(workflowId) && workflowId > 0 && !workflow) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }
    return NextResponse.json({ data: config, workflow });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update YouTube config.' },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Valid config id is required.' }, { status: 400 });
  }

  deleteYouTubeConfig(id);
  return NextResponse.json({ success: true });
}
