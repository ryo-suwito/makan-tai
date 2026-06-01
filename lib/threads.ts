import type { NextRequest } from 'next/server';
import { getThreadsAuth } from './db';

export const THREADS_STATE_COOKIE = 'threads_oauth_state';
export const THREADS_RETURN_TO_COOKIE = 'threads_oauth_return_to';
export const THREADS_DEFAULT_REDIRECT_PATH = '/api/threads/oauth/callback';
export const THREADS_DEFAULT_SCOPE = 'threads_basic,threads_content_publish';

export interface ThreadsConnectionStatus {
  callbackUrl: string;
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  userId: string | null;
}

export function getThreadsApiBase() {
  return process.env.THREADS_API_BASE?.trim() || 'https://graph.threads.net';
}

export function getThreadsAuthorizeBase() {
  return process.env.THREADS_AUTHORIZE_BASE?.trim() || 'https://threads.net/oauth/authorize';
}

export function getThreadsCredentials() {
  const appId = process.env.THREADS_APP_ID?.trim() || '';
  const appSecret = process.env.THREADS_APP_SECRET?.trim() || '';

  return {
    appId,
    appSecret,
    configured: Boolean(appId && appSecret),
  };
}

export function getRequestOrigin(req: NextRequest) {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host') || 'localhost:3000';
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export function getThreadsRedirectUri(req: NextRequest) {
  const envRedirectUri = process.env.THREADS_REDIRECT_URI?.trim();
  if (envRedirectUri) {
    return envRedirectUri;
  }

  const redirectPath = process.env.THREADS_REDIRECT_PATH?.trim() || THREADS_DEFAULT_REDIRECT_PATH;
  return `${getRequestOrigin(req)}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`;
}

export function buildThreadsAuthorizeUrl(req: NextRequest, state: string) {
  const { appId } = getThreadsCredentials();
  const redirectUri = getThreadsRedirectUri(req);
  const scope = process.env.THREADS_SCOPE?.trim() || THREADS_DEFAULT_SCOPE;

  const query = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
  });

  return `${getThreadsAuthorizeBase()}?${query.toString()}`;
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/')) {
    return '/';
  }

  if (value.startsWith('//')) {
    return '/';
  }

  return value;
}

export function getThreadsConnectionStatus(req: NextRequest): ThreadsConnectionStatus {
  const auth = getThreadsAuth();
  const now = Date.now();
  const expiresAt = auth?.expires_at ?? null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= now : false;
  const { configured } = getThreadsCredentials();

  return {
    configured,
    connected: Boolean(configured && auth?.access_token && !isExpired),
    userId: auth?.user_id ?? null,
    expiresAt,
    callbackUrl: getThreadsRedirectUri(req),
  };
}
