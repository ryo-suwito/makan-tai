import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join, normalize } from 'path';
import { createWorkflow, deleteWorkflow, getWorkflows, type WorkflowSegmentInput } from '@/lib/db';

interface CreateWorkflowBody {
  segments?: WorkflowSegmentInput[];
  title?: string;
}

export async function GET() {
  return NextResponse.json({ data: getWorkflows() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateWorkflowBody;
    const title = body.title?.trim();
    const segments = Array.isArray(body.segments) ? body.segments : [];

    if (!title) {
      return NextResponse.json({ error: 'Workflow title is required.' }, { status: 400 });
    }

    if (segments.length === 0) {
      return NextResponse.json({ error: 'At least one segment is required.' }, { status: 400 });
    }

    const workflow = createWorkflow(title, segments);
    return NextResponse.json({ data: workflow });
  } catch (err) {
    console.error('Failed to create workflow', err);
    return NextResponse.json({ error: 'Failed to create workflow.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid workflow id is required.' }, { status: 400 });
    }

    const workflow = deleteWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }

    const urls = workflow.segments.flatMap((segment) => [
      segment.image_url,
      segment.video_url,
      segment.voice_url,
    ]);
    await Promise.all(urls.map((url) => deleteLocalGeneratedAsset(url)));

    return NextResponse.json({ success: true, data: workflow });
  } catch (err) {
    console.error('Failed to delete workflow', err);
    return NextResponse.json({ error: 'Failed to delete workflow.' }, { status: 500 });
  }
}

async function deleteLocalGeneratedAsset(value: string | null) {
  const pathname = extractPathname(value);
  if (!pathname || (!pathname.startsWith('/generated/') && !pathname.startsWith('/generated-audio/'))) {
    return;
  }

  const publicDir = join(process.cwd(), 'public');
  const filePath = normalize(join(publicDir, pathname.replace(/^\//, '')));
  if (!filePath.startsWith(publicDir)) {
    return;
  }

  await unlink(filePath).catch(() => undefined);

  if (pathname.startsWith('/generated-audio/') && pathname.toLowerCase().endsWith('.wav')) {
    await unlink(filePath.replace(/\.wav$/i, '.json')).catch(() => undefined);
  }
}

function extractPathname(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    return new URL(trimmed).pathname;
  } catch {
    return null;
  }
}
