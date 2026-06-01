import { NextRequest, NextResponse } from 'next/server';
import { getThreadsConnectionStatus } from '../../../../lib/threads';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return NextResponse.json({ data: getThreadsConnectionStatus(req) });
}
