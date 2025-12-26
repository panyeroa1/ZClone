import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { upsertTranscriptSegment } from '@/lib/supabase/rest';
import { randomUUID } from 'node:crypto';

type SttSegment = {
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

type SseController = ReadableStreamDefaultController<Uint8Array>;

type DeepgramSession = {
  id: string;
  createdAt: number;
  roomId: string;
  speakerId: string;
  trackId: string;
  sourceLang: string;
  model: string;
  streamUrl?: string;
  streamAbortController?: AbortController;
  connection: any;
  seq: number;
  controllers: Set<SseController>;
  closed: boolean;
  hasPersistErrorNotified: boolean;
};

const encoder = new TextEncoder();
const sessions = new Map<string, DeepgramSession>();

const sendSse = (controller: SseController, data: unknown) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
};

const broadcastSse = (session: DeepgramSession, data: unknown) => {
  for (const controller of session.controllers) {
    try {
      sendSse(controller, data);
    } catch {
      // ignore
    }
  }
};

const getDeepgramKey = () => {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error('DEEPGRAM_API_KEY is missing');
  return key;
};

const normalizeTranscript = (data: any): { transcript: string; words: any[] } | null => {
  const alt = data?.channel?.alternatives?.[0];
  const transcript = typeof alt?.transcript === 'string' ? alt.transcript.trim() : '';
  if (!transcript) return null;
  const words = Array.isArray(alt?.words) ? alt.words : [];
  return { transcript, words };
};

const inferDiarizeSpeaker = (words: any[]): string | undefined => {
  const speakers = new Set<number>();
  for (const w of words) {
    if (typeof w?.speaker === 'number') speakers.add(w.speaker);
  }
  if (speakers.size === 0) return undefined;
  const first = words.find((w) => typeof w?.speaker === 'number')?.speaker;
  if (typeof first !== 'number') return undefined;
  return speakers.size > 1 ? `${first}+` : String(first);
};

export const createDeepgramSession = async (params: {
  roomId: string;
  speakerId: string;
  sourceLang: string;
  trackId?: string;
  model?: string;
  streamUrl?: string;
}) => {
  const deepgram = createClient(getDeepgramKey());
  const id = randomUUID();

  const session: DeepgramSession = {
    id,
    createdAt: Date.now(),
    roomId: params.roomId,
    speakerId: params.speakerId,
    trackId: params.trackId ?? 'mic',
    sourceLang: params.sourceLang || 'multi',
    model: params.model || 'nova-2',
    streamUrl: params.streamUrl,
    streamAbortController: undefined,
    connection: null,
    seq: 0,
    controllers: new Set(),
    closed: false,
    hasPersistErrorNotified: false,
  };

  const connection = deepgram.listen.live({
    model: session.model,
    language: session.sourceLang === 'auto' ? 'multi' : session.sourceLang,
    smart_format: true,
    diarize: true,
    punctuate: true,
    vad_events: true,
  });
  session.connection = connection;
  sessions.set(id, session);

  connection.on(LiveTranscriptionEvents.Open, () => {
    broadcastSse(session, { type: 'deepgram.open', session_id: id });

    if (session.streamUrl) {
      const abortController = new AbortController();
      session.streamAbortController = abortController;

      fetch(session.streamUrl, { redirect: 'follow', signal: abortController.signal })
        .then((res) => {
          const body = res.body;
          if (!body) throw new Error('no_stream_body');
          const reader = body.getReader();

          const pump = async (): Promise<void> => {
            if (session.closed) return;
            const { done, value } = await reader.read();
            if (done) return;
            if (value) session.connection?.send(value);
            return pump();
          };

          return pump();
        })
        .catch((e) => {
          if (session.closed) return;
          broadcastSse(session, {
            type: 'deepgram.stream_error',
            session_id: id,
            message: e instanceof Error ? e.message : 'unknown',
          });
        });
    }
  });

  connection.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
    if (session.closed) return;
    if (data?.type === 'SpeechStarted') return;

    const normalized = normalizeTranscript(data);
    if (!normalized) return;

    const isFinal = Boolean(data?.is_final || data?.speech_final);
    const startSeconds = typeof data?.start === 'number' ? data.start : 0;
    const durationSeconds = typeof data?.duration === 'number' ? data.duration : 0;
    const startMs = Math.max(0, Math.round(startSeconds * 1000));
    const endMs = Math.max(startMs, Math.round((startSeconds + durationSeconds) * 1000));

    const diarizeSpeaker = inferDiarizeSpeaker(normalized.words);

    const segmentId = `seg_dg_${session.id}_${startMs}_${diarizeSpeaker ?? session.speakerId}`;

    const segment: SttSegment = {
      type: 'stt.segment',
      room_id: session.roomId,
      track_id: session.trackId,
      speaker_id: session.speakerId,
      segment_id: segmentId,
      start_ms: startMs,
      end_ms: endMs,
      is_final: isFinal,
      confidence: typeof data?.channel?.alternatives?.[0]?.confidence === 'number' ? data.channel.alternatives[0].confidence : undefined,
      source_lang: session.sourceLang,
      text: normalized.transcript,
    };

    try {
      await upsertTranscriptSegment({
        room_id: segment.room_id,
        track_id: segment.track_id,
        speaker_id: segment.speaker_id,
        segment_id: segment.segment_id,
        start_ms: segment.start_ms,
        end_ms: segment.end_ms,
        is_final: segment.is_final,
        confidence: typeof segment.confidence === 'number' ? segment.confidence : null,
        source_lang: segment.source_lang,
        text: segment.text,
      });
    } catch (e) {
      if (!session.hasPersistErrorNotified) {
        session.hasPersistErrorNotified = true;
        broadcastSse(session, {
          type: 'deepgram.persist_error',
          session_id: session.id,
          message: e instanceof Error ? e.message : 'unknown',
        });
      }
    }

    broadcastSse(session, segment);
  });

  connection.on(LiveTranscriptionEvents.Error, (err: any) => {
    broadcastSse(session, { type: 'deepgram.error', session_id: id, message: String(err?.message || err) });
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    broadcastSse(session, { type: 'deepgram.close', session_id: id });
    closeDeepgramSession(id);
  });

  return { sessionId: id };
};

export const getDeepgramSession = (sessionId: string) => sessions.get(sessionId);

export const addSseController = (sessionId: string, controller: SseController) => {
  const session = sessions.get(sessionId);
  if (!session || session.closed) return null;
  session.controllers.add(controller);
  sendSse(controller, { type: 'deepgram.hello', session_id: sessionId });
  return session;
};

export const removeSseController = (sessionId: string, controller: SseController) => {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.controllers.delete(controller);
};

export const ingestDeepgramAudio = (sessionId: string, chunk: ArrayBuffer | Uint8Array) => {
  const session = sessions.get(sessionId);
  if (!session || session.closed) throw new Error('session_not_found');
  session.connection?.send(chunk as any);
};

export const closeDeepgramSession = (sessionId: string) => {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.closed = true;
  try {
    session.streamAbortController?.abort();
  } catch {
    // ignore
  }
  try {
    session.connection?.disconnect?.();
  } catch {
    // ignore
  }
  sessions.delete(sessionId);
};
