import Cartesia from '@cartesia/cartesia-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const apiKey = process.env.CARTESIA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 });
  }

  try {
    const client = new Cartesia({ apiKey });
    const { token } = await client.accessToken.create({
      grants: { tts: true },
      expires_in: 300,
    });

    return NextResponse.json({ token });
  } catch (err) {
    console.error('Failed to create Cartesia access token', err);
    return NextResponse.json({ error: 'Failed to create Cartesia access token' }, { status: 500 });
  }
}
