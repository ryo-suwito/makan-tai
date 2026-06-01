import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  THREADS_RETURN_TO_COOKIE,
  THREADS_STATE_COOKIE,
  buildThreadsAuthorizeUrl,
  getThreadsCredentials,
  getThreadsRedirectUri,
  sanitizeReturnTo,
} from '../../../../../lib/threads';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { configured } = getThreadsCredentials();
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get('returnTo'));

  if (!configured) {
    return NextResponse.redirect(new URL(`${returnTo}?threads=error&threads_message=Missing%20THREADS_APP_ID%20or%20THREADS_APP_SECRET`, getThreadsRedirectUri(req)));
  }

  const state = randomUUID();
  const authorizeUrl = buildThreadsAuthorizeUrl(req, state);
  const response = NextResponse.redirect(authorizeUrl);
  const secure = getThreadsRedirectUri(req).startsWith('https://');

  response.cookies.set(THREADS_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure,
  });
  response.cookies.set(THREADS_RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: '/',
    sameSite: 'lax',
    secure,
  });

  return response;
}
