'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCall } from '@stream-io/video-react-sdk';
import { useToast } from '@/components/ui/use-toast';
import { DEFAULT_LANGUAGES, type TranslatorLanguage } from '@/lib/translator/languages';

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

export type CaptionItem = {
  segment_id: string;
  speaker_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  is_final: boolean;
};

export type RealtimeTranslatorSettings = {
  sourceLang: TranslatorLanguage['code'];
  targetLang: TranslatorLanguage['code'];
  sttEngine: 'browser' | 'deepgram';
  captionsEnabled: boolean;
  readAloudEnabled: boolean;
  readAloudEngine: 'local_tts' | 'gemini_live';
  outputDeviceId: string; // 'default' or deviceId
  duckingEnabled: boolean;
  duckedCallVolume: number; // 0..1
  broadcastCaptionsEnabled: boolean;
  readAloudVolume: number; // 0..1
};

const SETTINGS_STORAGE_KEY = 'orbit_translator_settings_v1';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const safeJsonParse = <T,>(value: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const getSpeechRecognitionCtor = (): (new () => SpeechRecognition) | null => {
  const anyWindow = window as any;
  return (anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognition)
    | null;
};

const getDefaultSettings = (): RealtimeTranslatorSettings => ({
  sourceLang: 'en-US',
  targetLang: 'en-US',
  sttEngine: 'browser',
  captionsEnabled: true,
  readAloudEnabled: false,
  readAloudEngine: 'local_tts',
  outputDeviceId: 'default',
  duckingEnabled: true,
  duckedCallVolume: 0.35,
  broadcastCaptionsEnabled: false,
  readAloudVolume: 0.9,
});

export const useRealtimeTranslator = () => {
  const call = useCall();
  const { toast } = useToast();

  const [settings, setSettings] = useState<RealtimeTranslatorSettings>(() => {
    if (typeof window === 'undefined') return getDefaultSettings();
    const stored = safeJsonParse<Partial<RealtimeTranslatorSettings>>(
      window.localStorage.getItem(SETTINGS_STORAGE_KEY),
    );
    return {
      ...getDefaultSettings(),
      ...stored,
      readAloudVolume:
        typeof stored?.readAloudVolume === 'number'
          ? clamp01(stored.readAloudVolume)
          : getDefaultSettings().readAloudVolume,
    };
  });

  const [captionsById, setCaptionsById] = useState<Record<string, CaptionItem>>({});
  const sessionStartMsRef = useRef<number>(Date.now());
  const translateCacheRef = useRef<Map<string, string>>(new Map());
  const speakingQueueRef = useRef<string[]>([]);

  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const translatedAudioRef = useRef<HTMLAudioElement | null>(null);
  const callVolumeBeforeDuckRef = useRef<number | null>(null);
  const isDuckedRef = useRef(false);
  const hasShownGeminiFallbackRef = useRef(false);

  const captions = useMemo(() => {
    const items = Object.values(captionsById).sort((a, b) => a.start_ms - b.start_ms);
    return items.slice(-4);
  }, [captionsById]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      } catch {
        // ignore
      }
    };
    void loadDevices();
  }, []);

  useEffect(() => {
    const el = translatedAudioRef.current as any;
    if (!el || typeof el.setSinkId !== 'function') return;
    if (!settings.outputDeviceId) return;
    void el.setSinkId(settings.outputDeviceId).catch(() => {
      // ignore
    });
  }, [settings.outputDeviceId]);

  const applyDucking = useCallback(
    (shouldDuck: boolean) => {
      if (!call?.speaker) return;
      if (!settings.duckingEnabled) return;

      const targetVolume = clamp01(settings.duckedCallVolume);

      if (shouldDuck) {
        if (isDuckedRef.current) return;
        isDuckedRef.current = true;
        if (callVolumeBeforeDuckRef.current == null) {
          callVolumeBeforeDuckRef.current =
            typeof call.speaker.state.volume === 'number' ? call.speaker.state.volume : 1;
        }
        call.speaker.setVolume(targetVolume);
        return;
      }

      if (!isDuckedRef.current) return;
      isDuckedRef.current = false;
      const restore = callVolumeBeforeDuckRef.current ?? 1;
      call.speaker.setVolume(clamp01(restore));
    },
    [call, settings.duckedCallVolume, settings.duckingEnabled],
  );

  useEffect(() => {
    const audio = translatedAudioRef.current;
    if (!audio) return;
    const onPlay = () => applyDucking(true);
    const onEnded = () => applyDucking(false);
    const onPause = () => applyDucking(false);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
    };
  }, [applyDucking]);

  useEffect(() => {
    if (!call) return;
    if (!settings.readAloudEnabled || !settings.duckingEnabled) {
      applyDucking(false);
      return;
    }

    applyDucking(true);
    return () => applyDucking(false);
  }, [applyDucking, call, settings.duckingEnabled, settings.readAloudEnabled]);

  useEffect(() => {
    if (!call) return;

    const unsubscribe = call.on('custom', (event: any) => {
      const payload = event?.custom;
      if (!payload || typeof payload !== 'object') return;
      if (payload.type !== 'stt.segment') return;

      const segment = payload as SttSegment;
      if (!segment.text?.trim()) return;

      if (!settings.captionsEnabled && !settings.readAloudEnabled) return;

      const cacheKey = `${segment.segment_id}:${settings.targetLang}`;

      const applyCaption = (translatedText: string) => {
        setCaptionsById((prev) => ({
          ...prev,
          [segment.segment_id]: {
            segment_id: segment.segment_id,
            speaker_id: segment.speaker_id,
            start_ms: segment.start_ms,
            end_ms: segment.end_ms,
            text: translatedText,
            is_final: segment.is_final,
          },
        }));

        if (settings.readAloudEnabled && settings.readAloudEngine === 'local_tts' && segment.is_final) {
          speakingQueueRef.current.push(translatedText);
          speakNext();
        }
      };

      const cached = translateCacheRef.current.get(cacheKey);
      if (cached) {
        applyCaption(cached);
        return;
      }

      fetch('/api/translator/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: segment.text,
          source_lang: segment.source_lang,
          target_lang: settings.targetLang,
        }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('translate_failed');
          const data = (await res.json()) as { text: string };
          return data.text || segment.text;
        })
        .then((translatedText) => {
          translateCacheRef.current.set(cacheKey, translatedText);
          applyCaption(translatedText);
        })
        .catch(() => {
          applyCaption(segment.text);
        });
    });

    return () => {
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, settings.captionsEnabled, settings.readAloudEnabled, settings.targetLang]);

  const speakNext = () => {
    if (!settings.readAloudEnabled) return;
    if (settings.readAloudEngine !== 'local_tts') return;
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;

    const nextText = speakingQueueRef.current.shift();
    if (!nextText) return;

    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.lang = settings.targetLang;
    utterance.volume = clamp01(settings.readAloudVolume);
    utterance.onstart = () => applyDucking(true);
    utterance.onend = () => speakNext();
    window.speechSynthesis.speak(utterance);
  };

  const stopReadAloud = () => {
    speakingQueueRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    applyDucking(false);
  };

  useEffect(() => {
    if (!settings.readAloudEnabled) stopReadAloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.readAloudEnabled]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeSegmentIdRef = useRef<string | null>(null);
  const lastInterimSentAtRef = useRef<number>(0);
  const activeSegmentStartMsRef = useRef<number>(0);

  useEffect(() => {
    if (!call) return;

    const cleanup = () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      activeSegmentIdRef.current = null;
      if (recognition) {
        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.stop();
        } catch {
          // ignore
        }
      }
    };

    if (settings.sttEngine !== 'browser') {
      cleanup();
      return;
    }

    if (!settings.broadcastCaptionsEnabled) {
      cleanup();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      toast({
        title: 'Realtime captions unavailable',
        description: 'Your browser does not support SpeechRecognition (try Chrome).',
      });
      setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.sourceLang;

    const sendSegment = async (segment: SttSegment) => {
      try {
        await call.sendCustomEvent(segment);
      } catch {
        // ignore
      }
    };

    const persistSegment = async (segment: SttSegment) => {
      try {
        await fetch('/api/transcripts/segment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(segment),
        });
      } catch {
        // ignore
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (!result) return;

      const transcript = String(result[0]?.transcript || '').trim();
      if (!transcript) return;

      const now = Date.now();
      const startMsBase = sessionStartMsRef.current;

      const speakerId = call.state.localParticipant?.userId || 'unknown';

      const isFinal = result.isFinal;
      if (!activeSegmentIdRef.current) {
        activeSegmentIdRef.current = `seg_${speakerId}_${now}`;
        activeSegmentStartMsRef.current = now - startMsBase;
      }

      const segmentId = activeSegmentIdRef.current;
      const startMs = activeSegmentStartMsRef.current || now - startMsBase;
      const endMs = now - startMsBase;

      const segment: SttSegment = {
        type: 'stt.segment',
        room_id: call.id,
        track_id: 'mic',
        speaker_id: speakerId,
        segment_id: segmentId,
        start_ms: startMs,
        end_ms: endMs,
        is_final: isFinal,
        confidence: typeof (result[0] as any)?.confidence === 'number' ? (result[0] as any).confidence : undefined,
        source_lang: settings.sourceLang,
        text: transcript,
      };

      if (!isFinal) {
        const minIntervalMs = 800;
        if (now - lastInterimSentAtRef.current < minIntervalMs) return;
        lastInterimSentAtRef.current = now;
        void sendSegment(segment);
        void persistSegment(segment);
        return;
      }

      lastInterimSentAtRef.current = 0;
      activeSegmentIdRef.current = null;
      activeSegmentStartMsRef.current = 0;
      void sendSegment(segment);
      void persistSegment(segment);
    };

    recognition.onerror = () => {
      toast({
        title: 'Realtime captions stopped',
        description: 'SpeechRecognition encountered an error.',
      });
      setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
    };

    recognition.onend = () => {
      if (!settings.broadcastCaptionsEnabled) return;
      try {
        recognition.start();
      } catch {
        // ignore
      }
    };

    try {
      recognition.start();
    } catch {
      toast({
        title: 'Realtime captions unavailable',
        description: 'Unable to start SpeechRecognition in this browser context.',
      });
      setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
    }

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, settings.broadcastCaptionsEnabled, settings.sourceLang, settings.sttEngine]);

  const deepgramSessionIdRef = useRef<string | null>(null);
  const deepgramEventSourceRef = useRef<EventSource | null>(null);
  const deepgramStreamRef = useRef<MediaStream | null>(null);
  const deepgramAudioContextRef = useRef<AudioContext | null>(null);
  const deepgramProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const deepgramGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!call) return;
    if (settings.sttEngine !== 'deepgram') return;
    if (!settings.broadcastCaptionsEnabled) return;

    let cancelled = false;

    const cleanup = async () => {
      if (deepgramEventSourceRef.current) {
        deepgramEventSourceRef.current.close();
        deepgramEventSourceRef.current = null;
      }

      if (deepgramProcessorRef.current) {
        try {
          deepgramProcessorRef.current.disconnect();
        } catch {
          // ignore
        }
        deepgramProcessorRef.current.onaudioprocess = null;
        deepgramProcessorRef.current = null;
      }

      if (deepgramGainRef.current) {
        try {
          deepgramGainRef.current.disconnect();
        } catch {
          // ignore
        }
        deepgramGainRef.current = null;
      }

      if (deepgramAudioContextRef.current) {
        try {
          await deepgramAudioContextRef.current.close();
        } catch {
          // ignore
        }
        deepgramAudioContextRef.current = null;
      }

      if (deepgramStreamRef.current) {
        for (const track of deepgramStreamRef.current.getTracks()) {
          try {
            track.stop();
          } catch {
            // ignore
          }
        }
        deepgramStreamRef.current = null;
      }

      const sessionId = deepgramSessionIdRef.current;
      deepgramSessionIdRef.current = null;
      if (sessionId) {
        try {
          await fetch('/api/stt/deepgram/close', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch {
          // ignore
        }
      }
    };

    const start = async () => {
      try {
        const createRes = await fetch('/api/stt/deepgram/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ room_id: call.id, source_lang: settings.sourceLang }),
        });

        if (!createRes.ok) throw new Error('deepgram_session_failed');
        const created = (await createRes.json().catch(() => null)) as { session_id?: string } | null;
        const sessionId = created?.session_id;
        if (!sessionId) throw new Error('deepgram_session_failed');
        deepgramSessionIdRef.current = sessionId;

        const eventSource = new EventSource(`/api/stt/deepgram/events?session_id=${encodeURIComponent(sessionId)}`);
        deepgramEventSourceRef.current = eventSource;

        eventSource.onmessage = async (ev) => {
          if (cancelled) return;
          const payload = safeJsonParse<any>(ev.data);
          if (!payload) return;
          if (payload.type === 'deepgram.persist_error') {
            toast({
              title: 'Transcript saving failed',
              description: 'Supabase persistence is not configured correctly (check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).',
            });
            return;
          }
          if (payload.type !== 'stt.segment') return;
          try {
            await call.sendCustomEvent(payload);
          } catch {
            // ignore
          }
        };

        eventSource.onerror = () => {
          toast({
            title: 'Deepgram captions stopped',
            description: 'Connection lost. Try toggling broadcast captions again.',
          });
          setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        deepgramStreamRef.current = stream;

        if (typeof AudioContext === 'undefined') {
          toast({
            title: 'Deepgram captions unavailable',
            description: 'WebAudio is not supported in this browser.',
          });
          setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
          return;
        }

        const targetSampleRate = 16000;
        const audioContext = new AudioContext();
        deepgramAudioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        deepgramGainRef.current = gain;

        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        deepgramProcessorRef.current = processor;

        const downsampleFloat32 = (buffer: Float32Array, inRate: number, outRate: number) => {
          if (outRate === inRate) return buffer;
          const ratio = inRate / outRate;
          const newLength = Math.round(buffer.length / ratio);
          const result = new Float32Array(newLength);
          let offsetResult = 0;
          let offsetBuffer = 0;
          while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
            let sum = 0;
            let count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
              sum += buffer[i];
              count++;
            }
            result[offsetResult] = count > 0 ? sum / count : 0;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
          }
          return result;
        };

        const floatTo16BitPCM = (input: Float32Array) => {
          const output = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          return output;
        };

        const chunkTargetSamples = Math.round(targetSampleRate * 0.25); // ~250ms
        let pending: Int16Array[] = [];
        let pendingSamples = 0;
        let inflight = false;

        const flush = async () => {
          if (cancelled) return;
          if (inflight) return;
          const sessionId = deepgramSessionIdRef.current;
          if (!sessionId) return;
          if (pendingSamples < chunkTargetSamples) return;

          inflight = true;
          const total = pendingSamples;
          const out = new Int16Array(total);
          let offset = 0;
          for (const p of pending) {
            out.set(p, offset);
            offset += p.length;
          }
          pending = [];
          pendingSamples = 0;

          try {
            await fetch(`/api/stt/deepgram/ingest?session_id=${encodeURIComponent(sessionId)}`, {
              method: 'POST',
              headers: { 'content-type': 'application/octet-stream' },
              body: out.buffer,
            });
          } catch {
            // ignore
          } finally {
            inflight = false;
          }
        };

        processor.onaudioprocess = (event) => {
          if (cancelled) return;
          const input = event.inputBuffer.getChannelData(0);
          const downsampled = downsampleFloat32(input, audioContext.sampleRate, targetSampleRate);
          const pcm16 = floatTo16BitPCM(downsampled);
          pending.push(pcm16);
          pendingSamples += pcm16.length;
          void flush();
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(audioContext.destination);
      } catch (e) {
        toast({
          title: 'Deepgram captions unavailable',
          description: e instanceof Error ? e.message : 'Unable to start Deepgram captions.',
        });
        setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: false }));
      }
    };

    void start();

    return () => {
      cancelled = true;
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, settings.broadcastCaptionsEnabled, settings.sourceLang, settings.sttEngine, toast]);

  useEffect(() => {
    if (!call) return;
    if (!settings.readAloudEnabled) return;
    if (settings.readAloudEngine !== 'gemini_live') return;

    let isCancelled = false;
    const cursorStorageKey = `orbit_gemini_live_cursor:${call.id}:${settings.targetLang}`;

    type Cursor = { after_start_ms: number; after_segment_id?: string };
    const loadCursor = (): Cursor => {
      const stored = safeJsonParse<Cursor>(typeof window !== 'undefined' ? window.localStorage.getItem(cursorStorageKey) : null);
      if (stored && typeof stored.after_start_ms === 'number') return stored;
      return { after_start_ms: -1 };
    };

    const saveCursor = (cursor: Cursor) => {
      try {
        window.localStorage.setItem(cursorStorageKey, JSON.stringify(cursor));
      } catch {
        // ignore
      }
    };

    const speakFallback = (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.targetLang;
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.volume = clamp01(settings.readAloudVolume);
      utterance.onstart = () => applyDucking(true);
      utterance.onend = () => applyDucking(false);
      window.speechSynthesis.speak(utterance);
    };

    let cursor = loadCursor();

    const tick = async () => {
      if (isCancelled) return;
      try {
        const url = new URL('/api/transcripts/poll', window.location.origin);
        url.searchParams.set('room_id', call.id);
        url.searchParams.set('after_start_ms', String(cursor.after_start_ms));
        if (cursor.after_segment_id) url.searchParams.set('after_segment_id', cursor.after_segment_id);
        url.searchParams.set('limit', '25');

        const res = await fetch(url.toString());
        if (!res.ok) return;

        const data = (await res.json().catch(() => null)) as { items?: Array<any> } | null;
        const items = Array.isArray(data?.items) ? data!.items! : [];
        if (items.length === 0) return;

        for (const item of items) {
          if (isCancelled) return;
          const segmentId = String(item.segment_id || '');
          const sourceLang = String(item.source_lang || 'auto');
          const text = String(item.text || '').trim();
          if (!segmentId || !text) continue;

          const cacheKey = `${segmentId}:${settings.targetLang}`;
          let translatedText = translateCacheRef.current.get(cacheKey);
          if (!translatedText) {
            translatedText = await fetch('/api/translator/translate', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text, source_lang: sourceLang, target_lang: settings.targetLang }),
            })
              .then(async (r) => (r.ok ? r.json() : null))
              .then((j: any) => String(j?.text || text))
              .catch(() => text);
            translateCacheRef.current.set(cacheKey, translatedText);
          }

          if (settings.captionsEnabled) {
            setCaptionsById((prev) => ({
              ...prev,
              [segmentId]: {
                segment_id: segmentId,
                speaker_id: String(item.speaker_id || 'unknown'),
                start_ms: Number(item.start_ms || 0),
                end_ms: Number(item.end_ms || 0),
                text: translatedText!,
                is_final: true,
              },
            }));
          }

          // Gemini Live audio relay placeholder: until wired, fall back to local TTS.
          if (!hasShownGeminiFallbackRef.current) {
            hasShownGeminiFallbackRef.current = true;
            toast({
              title: 'Gemini Live read-aloud not wired yet',
              description: 'Using local TTS fallback; wire the Gemini Live relay to output audio to the selected device.',
            });
          }
          speakFallback(translatedText);

          cursor = { after_start_ms: Number(item.start_ms || cursor.after_start_ms), after_segment_id: segmentId };
          saveCursor(cursor);
        }
      } catch {
        // ignore
      }
    };

    const intervalId = window.setInterval(() => void tick(), 1200);
    void tick();

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    applyDucking,
    call,
    settings.captionsEnabled,
    settings.readAloudEnabled,
    settings.readAloudEngine,
    settings.readAloudVolume,
    settings.targetLang,
    toast,
  ]);

  const resetCaptions = () => setCaptionsById({});

  const languages = DEFAULT_LANGUAGES;

  return {
    settings,
    setSettings,
    captions,
    resetCaptions,
    languages,
    stopReadAloud,
    audioOutputs,
    translatedAudioRef,
  };
};
