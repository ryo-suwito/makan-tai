import { NextRequest, NextResponse } from 'next/server';
import {
  createYouTubeProfile,
  deleteYouTubeProfile,
  getYouTubeProfiles,
  saveYouTubeProfileTokens,
  updateYouTubeProfile,
  type YouTubeProfileInput,
  type YouTubeProfileTokenInput,
} from '@/lib/db';

function parseProfilePayload(body: Record<string, unknown>): YouTubeProfileInput {
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    channel_id: typeof body.channel_id === 'string' ? body.channel_id.trim() : null,
    channel_title: typeof body.channel_title === 'string' ? body.channel_title.trim() : null,
    google_account_id: typeof body.google_account_id === 'string' ? body.google_account_id.trim() : null,
    google_account_email: typeof body.google_account_email === 'string' ? body.google_account_email.trim() : null,
  };
}

function parseTokenPayload(body: Record<string, unknown>): YouTubeProfileTokenInput | null {
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token.trim() : '';
  if (!refreshToken) {
    return null;
  }

  return {
    refresh_token: refreshToken,
    scope: typeof body.scope === 'string' ? body.scope.trim() : 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl',
    token_type: 'Bearer',
  };
}

export async function GET() {
  return NextResponse.json({ data: getYouTubeProfiles() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const profile = createYouTubeProfile(parseProfilePayload(body));
    const tokenPayload = profile ? parseTokenPayload(body) : null;
    if (profile && tokenPayload) {
      saveYouTubeProfileTokens(profile.id, tokenPayload);
    }
    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create YouTube profile.' },
      { status: 400 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid profile id is required.' }, { status: 400 });
    }

    const profile = updateYouTubeProfile(id, parseProfilePayload(body));
    if (!profile) {
      return NextResponse.json({ error: 'YouTube profile not found.' }, { status: 404 });
    }
    const tokenPayload = parseTokenPayload(body);
    const updatedProfile = tokenPayload ? saveYouTubeProfileTokens(id, tokenPayload) : profile;
    return NextResponse.json({ data: updatedProfile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update YouTube profile.' },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Valid profile id is required.' }, { status: 400 });
  }

  deleteYouTubeProfile(id);
  return NextResponse.json({ success: true });
}
