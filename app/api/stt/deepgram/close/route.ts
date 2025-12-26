import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { closeDeepgramSession } from '@/lib/stt/deepgramSessionStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { session_id?: string } | null;
  const sessionId = body?.session_id?.trim();
  if (!sessionId) return NextResponse.json({ error: 'session_id_required' }, { status: 400 });

  closeDeepgramSession(sessionId);
  return NextResponse.json({ ok: true });
}

