import { NextResponse } from 'next/server';
import { listFinalTranscriptSegments } from '@/lib/supabase/rest';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('room_id') || '';
  const afterStartMsRaw = searchParams.get('after_start_ms');
  const afterSegmentId = searchParams.get('after_segment_id') || undefined;
  const limitRaw = searchParams.get('limit');

  if (!roomId) {
    return NextResponse.json({ error: 'room_id_required' }, { status: 400 });
  }

  const afterStartMs =
    afterStartMsRaw && afterStartMsRaw !== '' ? Number(afterStartMsRaw) : undefined;
  const limit = limitRaw && limitRaw !== '' ? Number(limitRaw) : undefined;

  try {
    const items = await listFinalTranscriptSegments({
      room_id: roomId,
      after_start_ms: typeof afterStartMs === 'number' && Number.isFinite(afterStartMs) ? afterStartMs : undefined,
      after_segment_id: afterSegmentId,
      limit: typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: 'db_error', details: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }
}

