'use client';

import React from 'react';
import type { CaptionItem } from '@/hooks/useRealtimeTranslator';

const CaptionsOverlay = ({ enabled, items }: { enabled: boolean; items: CaptionItem[] }) => {
  if (!enabled) return null;
  const latest = items[items.length - 1];
  if (!latest?.text) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-[min(92vw,900px)] -translate-x-1/2">
      <div className="orbit-panel rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-mist-2">Captions</p>
          {!latest.is_final && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-mist-2">
              live
            </span>
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-white sm:text-base">{latest.text}</p>
      </div>
    </div>
  );
};

export default CaptionsOverlay;

