-- Transcript segments storage for Orbit Conference
-- Table name: transcript_segments
--
-- Notes:
-- - Uses `segment_id` as the idempotency key (upsert target).
-- - Service-role key is required by this repo's current server routes (no user JWT yet).
-- - Consider enabling RLS + using JWT auth for production reads.

create table if not exists public.transcript_segments (
  id bigserial primary key,
  created_at timestamptz not null default now(),

  room_id text not null,
  track_id text not null,
  speaker_id text not null,
  segment_id text not null unique,

  start_ms integer not null,
  end_ms integer not null,
  is_final boolean not null default false,

  confidence real,
  source_lang text not null,
  text text not null
);

create index if not exists transcript_segments_room_time_idx
  on public.transcript_segments (room_id, start_ms, segment_id);

