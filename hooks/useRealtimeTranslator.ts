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

  /* =========================================================
   *  DEEPGRAM REAL-TIME STREAMING INTEGRATION (WEBSOCKETS)
   * ========================================================= */
  
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { useMicrophoneState } = useCallStateHooks();
  const { microphone } = useMicrophoneState(); // Use Stream SDK microphone state

  useEffect(() => {
    if (!call) return;
    if (settings.sttEngine !== 'deepgram') return;
    if (!settings.broadcastCaptionsEnabled) return;

    let isCancelled = false;

    const cleanup = () => {
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;

      if (deepgramWsRef.current) {
        if (deepgramWsRef.current.readyState === WebSocket.OPEN) {
          deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }));
          deepgramWsRef.current.close();
        }
        deepgramWsRef.current = null;
      }
    };

    const startStreaming = async () => {
      try {
        // 1. Get Temporary Token
        const tokenRes = await fetch('/api/stt/deepgram/token');
        if (!tokenRes.ok) throw new Error('Failed to get Deepgram token');
        const { key } = await tokenRes.json();

        // 2. Setup WebSocket
        const protocols = ['token', key];
        const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
        wsUrl.searchParams.append('tier', 'nova');
        wsUrl.searchParams.append('model', 'general'); // or 'nova-2'
        wsUrl.searchParams.append('language', settings.sourceLang.split('-')[0]); // 'en' from 'en-US'
        wsUrl.searchParams.append('smart_format', 'true');
        wsUrl.searchParams.append('interim_results', 'true');
        wsUrl.searchParams.append('endpointing', '300'); // rapid endpointing

        const socket = new WebSocket(wsUrl.toString(), protocols);
        deepgramWsRef.current = socket;

        socket.onopen = async () => {
          if (isCancelled) {
            socket.close();
            return;
          }
          
          // 3. Setup Audio Capture (Source Separation)
          // We use the Stream SDK's microphone or a fresh standard getUserMedia?
          // To ensure "Source vs Output" separation (echo cancellation), we MUST use a fresh stream
          // with strict constraints, OR use the one provided by Stream SDK if accessible.
          // Getting a fresh one is safer for "Source" isolation.
          
          const constraints = {
            audio: {
              deviceId: settings.outputDeviceId === 'default' ? undefined : { exact: undefined }, // Input device! Wait.
              // We need INPUT device ID here. `settings.outputDeviceId` is for OUTPUT.
              // Stream SDK `microphone.selectedDevice` gives us the Input ID.
              // Let's rely on default or Stream's selection if accessible, but for now:
              echoCancellation: true, 
              noiseSuppression: true, 
              autoGainControl: true,
              channelCount: 1, // Mono is fine for speech
            }
          };

          // If we have a selected mic in Stream SDK, try to use it
          // Note: microphone.selectedDevice might be stored in Stream's internal state.
          // Ideally we access the deviceId from `useMicrophoneState().selectedDevice` if available.
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // 4. MediaRecorder for robust encoding (Opus within WebM)
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (socket.readyState === WebSocket.OPEN && event.data.size > 0) {
              socket.send(event.data);
            }
          };

          recorder.start(250); // 250ms chunks
          
          // KeepAlive for Deepgram
          keepAliveIntervalRef.current = setInterval(() => {
             if (socket.readyState === WebSocket.OPEN) {
               socket.send(JSON.stringify({ type: 'KeepAlive' }));
             }
          }, 3000);
        };

        socket.onmessage = (event) => {
          const message = safeJsonParse<any>(event.data);
          if (!message || !message.channel) return;
          
          const alternatives = message.channel.alternatives?.[0];
          const transcript = alternatives?.transcript;
          
          if (transcript && message.is_final) {
               // Send 'Final' segment
               const segment: SttSegment = {
                 type: 'stt.segment',
                 room_id: call.id,
                 track_id: 'mic',
                 speaker_id: call.state.localParticipant?.userId || 'me',
                 segment_id: `dg_${Date.now()}`,
                 start_ms: Date.now() - sessionStartMsRef.current, // Rough absolute time
                 end_ms: Date.now() - sessionStartMsRef.current,
                 is_final: true,
                 text: transcript,
                 source_lang: settings.sourceLang,
               };
               void call.sendCustomEvent(segment);
               // Also persist if needed
          } else if (transcript) {
               // Send 'Interim'
               // ... similar logic
          }
        };

        socket.onclose = () => {
           // Retry logic could go here
        };

      } catch (e) {
        console.error('Deepgram connection failed', e);
        toast({ title: 'Connection Error', description: 'Could not connect to Deepgram.' });
        setSettings(s => ({...s, broadcastCaptionsEnabled: false}));
      }
    };

    startStreaming();

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [call, settings.sttEngine, settings.broadcastCaptionsEnabled, settings.sourceLang]);

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
