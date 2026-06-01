import { NextRequest, NextResponse } from 'next/server';
import {
  deleteStyleDnaProfile,
  getStyleDnaProfiles,
  saveStyleDnaProfile,
} from '../../../lib/db';
import { normalizeStyleDnaProfile } from '../../../lib/style-dna';

export async function GET() {
  const profiles = getStyleDnaProfiles();
  return NextResponse.json({ data: profiles });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const rawProfile = body.profile;

  if (!name || !rawProfile || typeof rawProfile !== 'object') {
    return NextResponse.json({ error: 'Invalid style DNA payload' }, { status: 400 });
  }

  const saved = saveStyleDnaProfile(name, normalizeStyleDnaProfile(rawProfile));
  return NextResponse.json({ data: saved }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  deleteStyleDnaProfile(id);
  return NextResponse.json({ success: true });
}
