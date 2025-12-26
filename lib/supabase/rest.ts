type SupabaseUpsertResult = {
  ok: boolean;
};

type TranscriptSegmentRow = {
  room_id: string;
  track_id: string;
  speaker_id: string;
  segment_id: string;
  start_ms: number;
  end_ms: number;
  is_final: boolean;
  confidence: number | null;
  source_lang: string;
  text: string;
};

const getSupabaseEnv = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error('SUPABASE_URL is missing');
  if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');

  return { supabaseUrl, supabaseServiceRoleKey };
};

export const upsertTranscriptSegment = async (
  row: TranscriptSegmentRow,
): Promise<SupabaseUpsertResult> => {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();

  const url = new URL('/rest/v1/transcript_segments', supabaseUrl);
  url.searchParams.set('on_conflict', 'segment_id');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([row]),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`supabase_upsert_failed:${res.status}:${text}`);
  }

  return { ok: true };
};

export const listFinalTranscriptSegments = async (params: {
  room_id: string;
  after_start_ms?: number;
  after_segment_id?: string;
  limit?: number;
}): Promise<TranscriptSegmentRow[]> => {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseEnv();

  const limit = Math.max(1, Math.min(100, params.limit ?? 20));

  const url = new URL('/rest/v1/transcript_segments', supabaseUrl);
  url.searchParams.set('select', 'room_id,track_id,speaker_id,segment_id,start_ms,end_ms,is_final,confidence,source_lang,text');
  url.searchParams.set('room_id', `eq.${params.room_id}`);
  url.searchParams.set('is_final', 'eq.true');
  url.searchParams.set('order', 'start_ms.asc,segment_id.asc');
  url.searchParams.set('limit', String(limit));

  const afterStartMs = params.after_start_ms;
  const afterSegmentId = params.after_segment_id;
  if (typeof afterStartMs === 'number' && Number.isFinite(afterStartMs)) {
    if (afterSegmentId) {
      url.searchParams.set(
        'or',
        `(start_ms.gt.${afterStartMs},and(start_ms.eq.${afterStartMs},segment_id.gt.${afterSegmentId}))`,
      );
    } else {
      url.searchParams.set('start_ms', `gt.${afterStartMs}`);
    }
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: supabaseServiceRoleKey,
      authorization: `Bearer ${supabaseServiceRoleKey}`,
      'content-type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`supabase_list_failed:${res.status}:${text}`);
  }

  const data = (await res.json().catch(() => null)) as unknown;
  if (!Array.isArray(data)) return [];
  return data as TranscriptSegmentRow[];
};
