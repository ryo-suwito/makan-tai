import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { request } from 'https';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  getWorkflowById,
  getYouTubeConfigById,
  updateWorkflowYouTubePublishResult,
} from '@/lib/db';
import { getReadyYouTubeAccessToken } from '@/lib/youtube';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface PublishWorkflowBody {
  workflowId?: number;
}

interface YouTubeVideoInsertResponse {
  id?: string;
}

function localPublicPathFromUrl(value: string | null | undefined, allowedPrefixes: string[]) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let pathname = trimmed;
  if (!pathname.startsWith('/')) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }

  if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return join(process.cwd(), 'public', pathname.replace(/^\//, ''));
}

function buildResolvedTitle(template: string, workflowTitle: string) {
  return (template || workflowTitle).replaceAll('{workflowTitle}', workflowTitle).trim() || workflowTitle;
}

async function createYouTubeResumableSession(input: {
  accessToken: string;
  categoryId: string;
  containsSyntheticMedia: boolean;
  description: string;
  fileSize: number;
  madeForKids: boolean;
  privacyStatus: string;
  tags: string[];
  title: string;
}) {
  const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(input.fileSize),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId || '22',
        ...(input.tags.length > 0 ? { tags: input.tags } : {}),
      },
      status: {
        privacyStatus: input.privacyStatus,
        selfDeclaredMadeForKids: input.madeForKids,
        containsSyntheticMedia: input.containsSyntheticMedia,
      },
    }),
  });

  const location = response.headers.get('Location');
  if (!response.ok || !location) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message || 'Failed to create YouTube resumable upload session.');
  }

  return location;
}

async function uploadVideoFile(uploadUrl: string, filePath: string, fileSize: number, accessToken: string) {
  return new Promise<YouTubeVideoInsertResponse>((resolve, reject) => {
    const parsedUrl = new URL(uploadUrl);
    const req = request({
      method: 'PUT',
      hostname: parsedUrl.hostname,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      protocol: parsedUrl.protocol,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Length': String(fileSize),
        'Content-Type': 'video/mp4',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const statusCode = res.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          try {
            const data = JSON.parse(body) as { error?: { message?: string } };
            reject(new Error(data.error?.message || `YouTube upload failed with HTTP ${statusCode}.`));
          } catch {
            reject(new Error(body || `YouTube upload failed with HTTP ${statusCode}.`));
          }
          return;
        }

        try {
          resolve(JSON.parse(body) as YouTubeVideoInsertResponse);
        } catch {
          reject(new Error('YouTube upload finished but returned invalid JSON.'));
        }
      });
    });

    req.on('error', reject);
    createReadStream(filePath).on('error', reject).pipe(req);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as PublishWorkflowBody;
    const workflowId = Number(body.workflowId);
    if (!Number.isFinite(workflowId) || workflowId <= 0) {
      return NextResponse.json({ error: 'Valid workflow id is required.' }, { status: 400 });
    }

    const workflow = getWorkflowById(workflowId);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 });
    }
    if (!workflow.finalized_url) {
      return NextResponse.json({ error: 'Finalize this workflow before publishing to YouTube.' }, { status: 400 });
    }
    if (!workflow.youtube_config_id) {
      return NextResponse.json({ error: 'Save YouTube publish config before uploading.' }, { status: 400 });
    }

    const config = getYouTubeConfigById(workflow.youtube_config_id);
    if (!config) {
      return NextResponse.json({ error: 'YouTube publish config not found.' }, { status: 404 });
    }
    if (!config.youtube_profile_id) {
      return NextResponse.json({ error: 'Select a YouTube profile before uploading.' }, { status: 400 });
    }

    const filePath = localPublicPathFromUrl(workflow.finalized_url, ['/generated-video-finalized/']);
    if (!filePath) {
      return NextResponse.json({ error: 'Finalized video must be a local generated MP4.' }, { status: 400 });
    }

    const fileStat = await stat(filePath);
    const readyToken = await getReadyYouTubeAccessToken(config.youtube_profile_id);
    const title = buildResolvedTitle(config.title_template, workflow.title);
    const uploadUrl = await createYouTubeResumableSession({
      accessToken: readyToken.accessToken,
      categoryId: config.category_id || '22',
      containsSyntheticMedia: config.contains_synthetic_media,
      description: config.default_description,
      fileSize: fileStat.size,
      madeForKids: config.self_declared_made_for_kids,
      privacyStatus: config.privacy_status,
      tags: config.default_tags,
      title,
    });
    const uploadResult = await uploadVideoFile(uploadUrl, filePath, fileStat.size, readyToken.accessToken);

    if (!uploadResult.id) {
      throw new Error('YouTube upload response did not include a video id.');
    }

    const publishUrl = `https://www.youtube.com/watch?v=${uploadResult.id}`;
    const updatedWorkflow = updateWorkflowYouTubePublishResult(workflow.id, uploadResult.id, publishUrl);

    return NextResponse.json({
      data: {
        publishUrl,
        videoId: uploadResult.id,
        workflow: updatedWorkflow,
      },
    });
  } catch (err) {
    console.error('YouTube workflow publish failed', err);
    return NextResponse.json(
      { error: 'Failed to publish workflow to YouTube.', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
