import Cartesia from '@cartesia/cartesia-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 });
  }

  try {
    const client = new Cartesia({ apiKey });
    const voices = [];

    for await (const voice of client.voices.list({ is_owner: true, limit: 100 })) {
      voices.push({
        id: voice.id,
        name: voice.name,
        description: voice.description,
        language: voice.language,
        isOwner: voice.is_owner,
        createdAt: voice.created_at,
      });
    }

    voices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ data: voices });
  } catch (err) {
    console.error('Failed to list Cartesia voices', err);
    return NextResponse.json({ error: 'Failed to list Cartesia voices' }, { status: 500 });
  }
}
