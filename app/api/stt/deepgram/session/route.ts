import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createDeepgramSession } from '@/lib/stt/deepgramSessionStore';

export const runtime = 'nodejs';

type Body = {
  room_id: string;
  source_lang?: string;
  stream_url?: string;
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const roomId = body?.room_id?.trim();
  if (!roomId) return NextResponse.json({ error: 'room_id_required' }, { status: 400 });

  const sourceLang = body?.source_lang?.trim() || 'multi';
  const streamUrl = body?.stream_url?.trim();

  try {
    const { sessionId } = await createDeepgramSession({
      roomId,
      speakerId: userId,
      sourceLang,
      trackId: 'mic',
      streamUrl,
    });
    return NextResponse.json({ session_id: sessionId });
  } catch (e) {
    return NextResponse.json(
      { error: 'deepgram_session_failed', details: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}
