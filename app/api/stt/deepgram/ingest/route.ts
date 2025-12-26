import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ingestDeepgramAudio } from '@/lib/stt/deepgramSessionStore';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') || '';
  if (!sessionId) return NextResponse.json({ error: 'session_id_required' }, { status: 400 });

  const buffer = await req.arrayBuffer().catch(() => null);
  if (!buffer || buffer.byteLength === 0) return NextResponse.json({ error: 'empty_audio' }, { status: 400 });

  try {
    ingestDeepgramAudio(sessionId, buffer);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: 'ingest_failed', details: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}

