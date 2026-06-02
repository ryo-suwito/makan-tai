import { NextRequest, NextResponse } from 'next/server';
import { updateWorkflowSegment, type WorkflowSegmentUpdate } from '@/lib/db';

interface UpdateSegmentBody extends WorkflowSegmentUpdate {
  id?: number;
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as UpdateSegmentBody;
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid segment id is required.' }, { status: 400 });
    }

    const segment = updateWorkflowSegment(id, {
      image_prompt: body.image_prompt,
      image_url: body.image_url,
      status: body.status,
      text: body.text,
      video_prompt: body.video_prompt,
      video_url: body.video_url,
      voice_url: body.voice_url,
    });

    if (!segment) {
      return NextResponse.json({ error: 'Workflow segment not found.' }, { status: 404 });
    }

    return NextResponse.json({ data: segment });
  } catch (err) {
    console.error('Failed to update workflow segment', err);
    return NextResponse.json({ error: 'Failed to update workflow segment.' }, { status: 500 });
  }
}
