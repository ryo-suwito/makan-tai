import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeCredentials, getYouTubeRedirectUri } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const credentials = getYouTubeCredentials();
  const callbackUrl = getYouTubeRedirectUri(req);

  return NextResponse.json({
    data: {
      callbackUrl,
      configured: credentials.configured,
      hasExplicitRedirectUri: Boolean(process.env.YOUTUBE_REDIRECT_URI?.trim()),
    },
  });
}
