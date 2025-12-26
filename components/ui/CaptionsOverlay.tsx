'use client';

import React, { useMemo } from 'react';
import type { CaptionItem } from '@/hooks/useRealtimeTranslator';

const MAX_CHARS = 140;

const tailText = (text: string, maxChars: number) => {
  if (text.length <= maxChars) return text;
  const sliced = text.slice(text.length - maxChars);
  const firstSpace = sliced.indexOf(' ');
  return firstSpace === -1 ? sliced : sliced.slice(firstSpace + 1);
};

const CaptionsOverlay = ({ enabled, items }: { enabled: boolean; items: CaptionItem[] }) => {
  const latest = items[items.length - 1];

  const displayText = useMemo(() => {
    if (!enabled) return '';
    const usable = items.filter((i) => i.text?.trim());
    if (usable.length === 0) return '';

    const finals = usable.filter((i) => i.is_final);
    const interim = usable.slice().reverse().find((i) => !i.is_final);

    const finalTail = finals
      .slice(-6)
      .map((i) => i.text.trim())
      .join(' ');

    const combined = `${finalTail}${interim ? ` ${interim.text.trim()}` : ''}`.trim();
    return tailText(combined, MAX_CHARS);
  }, [enabled, items]);

  if (!enabled) return null;
  if (!displayText) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 w-[min(94vw,980px)] -translate-x-1/2 px-3">
      <div className="orbit-captions">
        <p className="orbit-captions__text" data-final={latest?.is_final ? 'true' : 'false'}>
          {displayText}
        </p>
      </div>
    </div>
  );
};

export default CaptionsOverlay;
