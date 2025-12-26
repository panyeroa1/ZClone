import { NextResponse } from 'next/server';
import { upsertTranscriptSegment } from '@/lib/supabase/rest';

export const runtime = 'nodejs';

type TranscriptSegment = {
  type: 'stt.segment';
  room_id: string;
  track_id: string;
  speaker_id: string;
  segment_id: string;
  start_ms: number;
  end_ms: number;
  is_final: boolean;
  confidence?: number;
  source_lang: string;
  text: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TranscriptSegment | null;

  if (
    !body ||
    body.type !== 'stt.segment' ||
    !isNonEmptyString(body.room_id) ||
    !isNonEmptyString(body.track_id) ||
    !isNonEmptyString(body.speaker_id) ||
    !isNonEmptyString(body.segment_id) ||
    !isFiniteNumber(body.start_ms) ||
    !isFiniteNumber(body.end_ms) ||
    typeof body.is_final !== 'boolean' ||
    !isNonEmptyString(body.source_lang) ||
    !isNonEmptyString(body.text)
  ) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    await upsertTranscriptSegment({
      room_id: body.room_id,
      track_id: body.track_id,
      speaker_id: body.speaker_id,
      segment_id: body.segment_id,
      start_ms: body.start_ms,
      end_ms: body.end_ms,
      is_final: body.is_final,
      confidence: typeof body.confidence === 'number' ? body.confidence : null,
      source_lang: body.source_lang,
      text: body.text,
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'db_error', details: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
