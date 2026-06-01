import { NextRequest, NextResponse } from 'next/server';
import { getThreadsAuth } from '../../../../lib/db';
import { getThreadsConnectionStatus, getThreadsApiBase } from '../../../../lib/threads';

export const runtime = 'nodejs';

interface ThreadsPublishBody {
  text?: string;
}

interface ThreadsApiResponse {
  error?: {
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    message?: string;
    type?: string;
  };
  id?: string;
  permalink?: string;
}

function getThreadsErrorMessage(payload: ThreadsApiResponse, fallback: string) {
  return payload.error?.message?.trim() || fallback;
}

async function parseThreadsResponse(response: Response) {
  return (await response.json().catch(() => ({}))) as ThreadsApiResponse;
}

export async function POST(req: NextRequest) {
  const status = getThreadsConnectionStatus(req);
  const auth = getThreadsAuth();

  if (!status.configured) {
    return NextResponse.json({ error: 'Missing THREADS_APP_ID or THREADS_APP_SECRET' }, { status: 500 });
  }

  if (!auth?.access_token || !status.connected) {
    return NextResponse.json({ error: 'Connect Threads first before publishing.' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ThreadsPublishBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const apiBase = getThreadsApiBase();

    const createContainerResponse = await fetch(`${apiBase}/me/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        access_token: auth.access_token,
        media_type: 'TEXT',
        text,
      }).toString(),
    });

    const createContainerData = await parseThreadsResponse(createContainerResponse);
    if (!createContainerResponse.ok || !createContainerData.id) {
      return NextResponse.json(
        { error: getThreadsErrorMessage(createContainerData, 'Failed to create Threads post container.') },
        { status: createContainerResponse.status || 502 },
      );
    }

    const publishResponse = await fetch(`${apiBase}/me/threads_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        access_token: auth.access_token,
        creation_id: createContainerData.id,
      }).toString(),
    });

    const publishData = await parseThreadsResponse(publishResponse);
    if (!publishResponse.ok || !publishData.id) {
      return NextResponse.json(
        { error: getThreadsErrorMessage(publishData, 'Failed to publish the Threads post.') },
        { status: publishResponse.status || 502 },
      );
    }

    let permalink: string | null = null;
    const detailsResponse = await fetch(
      `${apiBase}/${encodeURIComponent(publishData.id)}?${new URLSearchParams({
        access_token: auth.access_token,
        fields: 'id,permalink',
      }).toString()}`,
      { method: 'GET' },
    );
    const detailsData = await parseThreadsResponse(detailsResponse);
    if (detailsResponse.ok && typeof detailsData.permalink === 'string' && detailsData.permalink.trim()) {
      permalink = detailsData.permalink.trim();
    }

    return NextResponse.json({
      data: {
        id: publishData.id,
        permalink,
      },
    });
  } catch (err) {
    console.error('Threads publish failed', err);
    return NextResponse.json(
      {
        error: 'Failed to publish to Threads',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
