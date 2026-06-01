import { NextRequest, NextResponse } from 'next/server';
import { saveThreadsAuth } from '../../../../../lib/db';
import {
  THREADS_RETURN_TO_COOKIE,
  THREADS_STATE_COOKIE,
  getThreadsApiBase,
  getThreadsCredentials,
  getRequestOrigin,
  getThreadsRedirectUri,
  sanitizeReturnTo,
} from '../../../../../lib/threads';

export const runtime = 'nodejs';

interface ThreadsShortLivedTokenResponse {
  access_token?: string;
  error?: {
    message?: string;
  };
  user_id?: string;
}

interface ThreadsLongLivedTokenResponse {
  access_token?: string;
  error?: {
    message?: string;
  };
  expires_in?: number;
  token_type?: string;
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

function buildReturnUrl(req: NextRequest, returnTo: string, status: 'connected' | 'error', message?: string) {
  const url = new URL(returnTo, getRequestOrigin(req));
  url.searchParams.set('threads', status);
  if (message) {
    url.searchParams.set('threads_message', message);
  }
  return url;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state');
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const errorDescription = req.nextUrl.searchParams.get('error_description');
  const cookieState = req.cookies.get(THREADS_STATE_COOKIE)?.value ?? '';
  const returnTo = sanitizeReturnTo(req.cookies.get(THREADS_RETURN_TO_COOKIE)?.value);
  const redirectUri = getThreadsRedirectUri(req);
  const { appId, appSecret, configured } = getThreadsCredentials();

  const clearCookies = (response: NextResponse) => {
    response.cookies.set(THREADS_STATE_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(THREADS_RETURN_TO_COOKIE, '', { maxAge: 0, path: '/' });
    return response;
  };

  if (!configured) {
    return clearCookies(
      NextResponse.redirect(buildReturnUrl(req, returnTo, 'error', 'Missing THREADS_APP_ID or THREADS_APP_SECRET')),
    );
  }

  if (error) {
    return clearCookies(
      NextResponse.redirect(buildReturnUrl(req, returnTo, 'error', errorDescription || error)),
    );
  }

  if (!state || state !== cookieState) {
    return clearCookies(
      NextResponse.redirect(buildReturnUrl(req, returnTo, 'error', 'Threads OAuth state mismatch')),
    );
  }

  if (!code) {
    return clearCookies(
      NextResponse.redirect(buildReturnUrl(req, returnTo, 'error', 'Threads OAuth code was missing')),
    );
  }

  try {
    const apiBase = getThreadsApiBase();
    const shortLivedResponse = await fetch(
      `${apiBase}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString()}`,
      {
        method: 'POST',
      },
    );
    const shortLivedData = await parseJson<ThreadsShortLivedTokenResponse>(shortLivedResponse);

    if (!shortLivedResponse.ok || !shortLivedData.access_token) {
      throw new Error(shortLivedData.error?.message || 'Failed to exchange the Threads authorization code.');
    }

    const longLivedResponse = await fetch(
      `${apiBase}/access_token?${new URLSearchParams({
        access_token: shortLivedData.access_token,
        grant_type: 'th_exchange_token',
        client_secret: appSecret,
      }).toString()}`,
      {
        method: 'GET',
      },
    );
    const longLivedData = await parseJson<ThreadsLongLivedTokenResponse>(longLivedResponse);

    if (!longLivedResponse.ok || !longLivedData.access_token) {
      throw new Error(longLivedData.error?.message || 'Failed to exchange for a long-lived Threads token.');
    }

    const expiresAt = typeof longLivedData.expires_in === 'number'
      ? new Date(Date.now() + longLivedData.expires_in * 1000).toISOString()
      : null;

    saveThreadsAuth({
      accessToken: longLivedData.access_token,
      expiresAt,
      userId: shortLivedData.user_id ?? null,
    });

    return clearCookies(
      NextResponse.redirect(buildReturnUrl(req, returnTo, 'connected')),
    );
  } catch (err) {
    console.error('Threads OAuth callback failed', err);
    return clearCookies(
      NextResponse.redirect(
        buildReturnUrl(
          req,
          returnTo,
          'error',
          err instanceof Error ? err.message : 'Failed to connect Threads',
        ),
      ),
    );
  }
}
