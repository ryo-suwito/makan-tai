import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeProfileById, saveYouTubeProfileTokens, updateYouTubeProfile } from '@/lib/db';
import { sanitizeReturnTo } from '@/lib/threads';
import {
  YOUTUBE_PROFILE_COOKIE,
  YOUTUBE_RETURN_TO_COOKIE,
  YOUTUBE_STATE_COOKIE,
  buildYouTubeReturnUrl,
  getYouTubeCredentials,
  getYouTubeRedirectUri,
} from '@/lib/youtube';

export const runtime = 'nodejs';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface YouTubeChannelsResponse {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
    };
  }>;
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const errorDescription = req.nextUrl.searchParams.get('error_description');
  const cookieState = req.cookies.get(YOUTUBE_STATE_COOKIE)?.value ?? '';
  const profileId = Number(req.cookies.get(YOUTUBE_PROFILE_COOKIE)?.value);
  const returnTo = sanitizeReturnTo(req.cookies.get(YOUTUBE_RETURN_TO_COOKIE)?.value);
  const { clientId, clientSecret, configured } = getYouTubeCredentials();

  const clearCookies = (response: NextResponse) => {
    response.cookies.set(YOUTUBE_STATE_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(YOUTUBE_PROFILE_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(YOUTUBE_RETURN_TO_COOKIE, '', { maxAge: 0, path: '/' });
    return response;
  };

  if (!configured) {
    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET')));
  }

  if (error) {
    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', errorDescription || error)));
  }

  if (!state || state !== cookieState) {
    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'YouTube OAuth state mismatch')));
  }

  if (!code) {
    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'YouTube OAuth code was missing')));
  }

  const profile = Number.isFinite(profileId) && profileId > 0 ? getYouTubeProfileById(profileId) : null;
  if (!profile) {
    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'error', 'YouTube profile not found')));
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getYouTubeRedirectUri(req),
      }),
    });
    const tokenData = await parseJson<GoogleTokenResponse>(tokenResponse);

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange YouTube authorization code.');
    }

    if (!tokenData.refresh_token) {
      throw new Error('Google did not return a refresh token. Reconnect with prompt=consent and access_type=offline.');
    }

    const expiresAt = typeof tokenData.expires_in === 'number'
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    saveYouTubeProfileTokens(profile.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope ?? null,
      token_expires_at: expiresAt,
      token_type: tokenData.token_type ?? 'Bearer',
    });

    const channel = await fetchYouTubeChannel(tokenData.access_token);
    if (channel) {
      updateYouTubeProfile(profile.id, {
        name: profile.name,
        channel_id: channel.id ?? profile.channel_id,
        channel_title: channel.snippet?.title ?? profile.channel_title,
        google_account_email: profile.google_account_email,
        google_account_id: profile.google_account_id,
      });
    }

    return clearCookies(NextResponse.redirect(buildYouTubeReturnUrl(req, returnTo, 'connected')));
  } catch (err) {
    console.error('YouTube OAuth callback failed', err);
    return clearCookies(
      NextResponse.redirect(
        buildYouTubeReturnUrl(req, returnTo, 'error', err instanceof Error ? err.message : 'Failed to connect YouTube'),
      ),
    );
  }
}

async function fetchYouTubeChannel(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await parseJson<YouTubeChannelsResponse>(response);
  if (!response.ok) {
    return null;
  }
  return data.items?.[0] ?? null;
}
