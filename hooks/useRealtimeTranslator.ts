'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  captionsEnabled: boolean;
  readAloudEnabled: boolean;
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
  captionsEnabled: true,
  readAloudEnabled: false,
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

        if (settings.readAloudEnabled && segment.is_final) {
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
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;

    const nextText = speakingQueueRef.current.shift();
    if (!nextText) return;

    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.lang = settings.targetLang;
    utterance.volume = clamp01(settings.readAloudVolume);
    utterance.onend = () => speakNext();
    window.speechSynthesis.speak(utterance);
  };

  const stopReadAloud = () => {
    speakingQueueRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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
        return;
      }

      lastInterimSentAtRef.current = 0;
      activeSegmentIdRef.current = null;
      activeSegmentStartMsRef.current = 0;
      void sendSegment(segment);
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
  }, [call, settings.broadcastCaptionsEnabled, settings.sourceLang]);

  const resetCaptions = () => setCaptionsById({});

  const languages = DEFAULT_LANGUAGES;

  return {
    settings,
    setSettings,
    captions,
    resetCaptions,
    languages,
    stopReadAloud,
  };
};

