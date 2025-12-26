# Gemini Live Relay (Read‑Aloud)

Orbit Conference is set up to support a per‑listener “translated read‑aloud” audio stream routed to a separate output device.

## What exists in the app today

- Speaker-side STT segments are broadcast to the room as Stream custom events and persisted immediately:
  - Persist: `POST /api/transcripts/segment`
  - Poll (final segments, ordered): `GET /api/transcripts/poll?room_id=...&after_start_ms=...&after_segment_id=...`
- Listener-side translation uses:
  - `POST /api/translator/translate`
- Listener UI includes:
  - Translator panel with target language + output device selection
  - Audio ducking (original call audio reduced during read‑aloud)

## Required to wire Gemini Live audio

Implement a backend “Gemini Live relay” that:
1) Reads the next **final** transcript segments from Supabase (`/api/transcripts/poll`) without skipping.
2) Translates per listener target language.
3) Sends the translated text to a **Gemini Live** session configured for read‑aloud prosody.
4) Streams Gemini’s audio chunks back to the client (SSE or WebSocket).

Client already reserves an `<audio>` element in `components/ui/MeetingRoom.tsx` and supports selecting a separate output via `setSinkId`.

## Cursor / no skipping

Use a cursor of:
- `after_start_ms`
- `after_segment_id` (tie‑breaker)

Always request `is_final=true`, ordered by `start_ms asc, segment_id asc`.

Only advance the cursor once you have enqueued the segment into Gemini Live successfully.

## Style (read‑aloud policy)

Use a session-level instruction like:
- “Speak the translation naturally, matching the speaker’s pacing and intensity, without adding content.”
- Emphasize native fluency, breath control, and natural pauses.

Keep translation deterministic (low temperature) and keep read‑aloud expressive (voice/prosody settings).

