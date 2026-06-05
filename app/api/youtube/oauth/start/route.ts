import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeProfileById } from '@/lib/db';
import {
  YOUTUBE_PROFILE_COOKIE,
  YOUTUBE_RETURN_TO_COOKIE,
  YOUTUBE_STATE_COOKIE,
  buildYouTubeAuthorizeUrl,
  buildYouTubeReturnUrl,
  getYouTubeCredentials,
  getYouTubeRedirectUri,
} from '@/lib/youtube';
import { sanitizeReturnTo } from '@/lib/threads';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { configured } = getYouTubeCredentials();
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'));
  const profileId = Number(req.nextUrl.searchParams.get('profileId'));

  if (!configured) {
    return NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET'));
  }

  if (!Number.isFinite(profileId) || profileId <= 0 || !getYouTubeProfileById(profileId)) {
    return NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'Create a YouTube profile before connecting OAuth'));
  }

  const state = randomUUID();
  const response = NextResponse.redirect(buildYouTubeAuthorizeUrl(req, state));
  const secure = getYouTubeRedirectUri(req).startsWith('https://');

  response.cookies.set(YOUTUBE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure,
  });
  response.cookies.set(YOUTUBE_PROFILE_COOKIE, String(profileId), {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure,
  });
  response.cookies.set(YOUTUBE_RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure,
  });

  return response;
}
