'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { RealtimeTranslatorSettings } from '@/hooks/useRealtimeTranslator';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  translator: {
    settings: RealtimeTranslatorSettings;
    setSettings: React.Dispatch<React.SetStateAction<RealtimeTranslatorSettings>>;
    resetCaptions: () => void;
    stopReadAloud: () => void;
    languages: { code: string; label: string }[];
    audioOutputs: { deviceId: string; label: string }[];
  };
};

const selectClassName =
  'w-full rounded-xl border border-white/10 bg-orbit-2 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-comet-1';

const checkboxClassName =
  'size-4 rounded border-white/20 bg-orbit-2 text-comet-1 focus:ring-2 focus:ring-comet-1';

const TranslatorPanel = ({ isOpen, onClose, translator }: Props) => {
  const { settings, setSettings, languages } = translator;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="orbit-panel w-[min(92vw,560px)] rounded-2xl border-none px-7 py-7 text-white">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-mist-2">Realtime translator</p>
            <h2 className="font-display text-2xl font-semibold">Captions + Read-aloud</h2>
            <p className="text-sm text-mist-2">
              Captions are broadcast as custom room events. Each listener translates per target language.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">STT engine</label>
              <select
                value={settings.sttEngine}
                className={selectClassName}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    sttEngine: e.target.value as RealtimeTranslatorSettings['sttEngine'],
                  }))
                }
              >
                <option value="browser">Browser (SpeechRecognition)</option>
                <option value="deepgram">Deepgram Live</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">Speaker language</label>
              <select
                value={settings.sourceLang}
                className={selectClassName}
                onChange={(e) => setSettings((prev) => ({ ...prev, sourceLang: e.target.value }))}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">My translation</label>
              <select
                value={settings.targetLang}
                className={selectClassName}
                onChange={(e) => setSettings((prev) => ({ ...prev, targetLang: e.target.value }))}
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">Broadcast my captions (SpeechRecognition)</span>
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={settings.broadcastCaptionsEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, broadcastCaptionsEnabled: e.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">Show translated captions</span>
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={settings.captionsEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, captionsEnabled: e.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">Read-aloud translation</span>
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={settings.readAloudEnabled}
                onChange={(e) => {
                  if (!e.target.checked) translator.stopReadAloud();
                  setSettings((prev) => ({ ...prev, readAloudEnabled: e.target.checked }));
                }}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">Read-aloud engine</label>
                <select
                  value={settings.readAloudEngine}
                  className={selectClassName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      readAloudEngine: e.target.value as RealtimeTranslatorSettings['readAloudEngine'],
                    }))
                  }
                >
                  <option value="local_tts">Local TTS (fallback)</option>
                  <option value="gemini_live">Gemini Live (relay)</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">Translated audio output</label>
                <select
                  value={settings.outputDeviceId}
                  className={selectClassName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, outputDeviceId: e.target.value }))}
                >
                  <option value="default">Default</option>
                  {translator.audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || 'Speaker'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white">Auto-duck original call audio</span>
              <input
                type="checkbox"
                className={checkboxClassName}
                checked={settings.duckingEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, duckingEnabled: e.target.checked }))}
              />
            </label>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">Original audio level</span>
              <input
                type="range"
                min={0.15}
                max={0.8}
                step={0.05}
                value={settings.duckedCallVolume}
                onChange={(e) => setSettings((prev) => ({ ...prev, duckedCallVolume: Number(e.target.value) }))}
                className="w-40 accent-[#2F80FF]"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-2">Read-aloud volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.readAloudVolume}
                onChange={(e) => setSettings((prev) => ({ ...prev, readAloudVolume: Number(e.target.value) }))}
                className="w-40 accent-[#2F80FF]"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => translator.resetCaptions()}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white hover:bg-white/10"
              >
                Clear captions
              </button>
              <button
                type="button"
                onClick={() => {
                  translator.stopReadAloud();
                  setSettings((prev) => ({ ...prev, readAloudEnabled: false }));
                }}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white hover:bg-white/10"
              >
                Stop read-aloud
              </button>
            </div>
          </div>

          <p className="text-xs text-mist-2">
            For Gemini Live read-aloud, use a backend relay that streams PCM audio chunks; this UI already supports selecting a separate output device.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TranslatorPanel;
