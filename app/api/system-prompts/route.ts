import { NextRequest, NextResponse } from 'next/server';
import { deleteSystemPrompt, getSystemPrompts, saveSystemPrompt } from '../../../lib/db';

export async function GET() {
  const prompts = getSystemPrompts();
  return NextResponse.json({ data: prompts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!name || !text) {
    return NextResponse.json({ error: 'Invalid system prompt' }, { status: 400 });
  }

  saveSystemPrompt(name, text);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  deleteSystemPrompt(Number(id));
  return NextResponse.json({ success: true });
}
