import { NextRequest, NextResponse } from 'next/server';
import { savePrompt, getPrompts, deletePrompt } from '../../../lib/db';

// GET: return saved prompts
export async function GET() {
  const prompts = getPrompts();
  return NextResponse.json({ data: prompts });
}

// POST: save a new prompt
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text } = body;
  if (!text || typeof text !== 'string') {
    return new NextResponse(JSON.stringify({ error: 'Invalid prompt' }), { status: 400 });
  }
  savePrompt(text);
  return new NextResponse(JSON.stringify({ success: true }));
}

// DELETE: delete a prompt by id
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return new NextResponse(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  }
  deletePrompt(Number(id));
  return new NextResponse(JSON.stringify({ success: true }));
}