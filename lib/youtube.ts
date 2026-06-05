import type { NextRequest } from 'next/server';
import {
  getYouTubeProfileById,
  getYouTubeProfileTokens,
  saveYouTubeProfileTokens,
  type StoredYouTubeProfileTokens,
} from './db';
import { getRequestOrigin, sanitizeReturnTo } from './threads';

export const YOUTUBE_STATE_COOKIE = 'youtube_oauth_state';
export const YOUTUBE_PROFILE_COOKIE = 'youtube_oauth_profile_id';
export const YOUTUBE_RETURN_TO_COOKIE = 'youtube_oauth_return_to';
export const YOUTUBE_DEFAULT_REDIRECT_PATH = '/api/youtube/oauth/callback';
export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
export const YOUTUBE_FORCE_SSL_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
export const YOUTUBE_DEFAULT_SCOPE = [
  YOUTUBE_UPLOAD_SCOPE,
  YOUTUBE_FORCE_SSL_SCOPE,
].join(' ');
export const YOUTUBE_TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

interface GoogleRefreshTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface ReadyYouTubeAccessToken {
  accessToken: string;
  expiresAt: string | null;
  profileId: number;
  scope: string | null;
  tokenType: string;
}

export function getYouTubeCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim() || '';

  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

export function getYouTubeRedirectUri(req: NextRequest) {
  const envRedirectUri = process.env.YOUTUBE_REDIRECT_URI?.trim();
  if (envRedirectUri) {
    return envRedirectUri;
  }

  const redirectPath = process.env.YOUTUBE_REDIRECT_PATH?.trim() || YOUTUBE_DEFAULT_REDIRECT_PATH;
  return `${getRequestOrigin(req)}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`;
}

export function buildYouTubeAuthorizeUrl(req: NextRequest, state: string) {
  const { clientId } = getYouTubeCredentials();
  const scope = process.env.YOUTUBE_SCOPE?.trim() || YOUTUBE_DEFAULT_SCOPE;

  const query = new URLSearchParams({
    access_type: 'offline',
    client_id: clientId,
    include_granted_scopes: 'true',
    prompt: 'consent',
    redirect_uri: getYouTubeRedirectUri(req),
    response_type: 'code',
    scope,
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export function buildYouTubeReturnUrl(req: NextRequest, returnTo: string, status: 'connected' | 'error', message?: string) {
  const url = new URL(sanitizeReturnTo(returnTo), getRequestOrigin(req));
  url.searchParams.set('youtube', status);
  if (message) {
    url.searchParams.set('youtube_message', message);
  }
  return url;
}

export function parseYouTubeScopes(scope: string | null | undefined) {
  return new Set((scope ?? '').split(/\s+/).map((item) => item.trim()).filter(Boolean));
}

export function hasRequiredYouTubeScopes(scope: string | null | undefined, requiredScopes = [YOUTUBE_UPLOAD_SCOPE]) {
  const grantedScopes = parseYouTubeScopes(scope);
  return requiredScopes.every((requiredScope) => grantedScopes.has(requiredScope));
}

export function isYouTubeAccessTokenExpiring(expiresAt: string | null | undefined, skewMs = YOUTUBE_TOKEN_REFRESH_SKEW_MS) {
  if (!expiresAt) {
    return true;
  }

  const expiryTime = new Date(expiresAt).getTime();
  return !Number.isFinite(expiryTime) || expiryTime - Date.now() <= skewMs;
}

export async function getReadyYouTubeAccessToken(profileId: number, requiredScopes = [YOUTUBE_UPLOAD_SCOPE]): Promise<ReadyYouTubeAccessToken> {
  const profile = getYouTubeProfileById(profileId);
  if (!profile) {
    throw new Error('YouTube profile not found.');
  }

  const tokens = getYouTubeProfileTokens(profileId);
  if (!tokens?.refresh_token) {
    throw new Error('YouTube profile is missing a refresh token.');
  }

  const readyTokens = !tokens.access_token || isYouTubeAccessTokenExpiring(tokens.token_expires_at)
    ? await refreshYouTubeAccessToken(profileId, tokens)
    : tokens;

  if (!readyTokens.access_token) {
    throw new Error('YouTube profile is missing an access token after refresh.');
  }

  if (!hasRequiredYouTubeScopes(readyTokens.scope, requiredScopes)) {
    throw new Error(`YouTube profile is missing required scope: ${requiredScopes.join(', ')}`);
  }

  return {
    profileId,
    accessToken: readyTokens.access_token,
    tokenType: readyTokens.token_type || 'Bearer',
    scope: readyTokens.scope,
    expiresAt: readyTokens.token_expires_at,
  };
}

async function refreshYouTubeAccessToken(profileId: number, tokens: StoredYouTubeProfileTokens): Promise<StoredYouTubeProfileTokens> {
  const { clientId, clientSecret, configured } = getYouTubeCredentials();
  if (!configured) {
    throw new Error('Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET.');
  }

  if (!tokens.refresh_token) {
    throw new Error('YouTube refresh token is required to refresh access.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as GoogleRefreshTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh YouTube access token.');
  }

  const expiresAt = typeof data.expires_in === 'number'
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;
  const nextScope = data.scope?.trim() || tokens.scope;
  const nextTokenType = data.token_type?.trim() || tokens.token_type || 'Bearer';

  saveYouTubeProfileTokens(profileId, {
    access_token: data.access_token,
    scope: nextScope,
    token_expires_at: expiresAt,
    token_type: nextTokenType,
  });

  return {
    access_token: data.access_token,
    refresh_token: tokens.refresh_token,
    scope: nextScope,
    token_expires_at: expiresAt,
    token_type: nextTokenType,
  };
}
