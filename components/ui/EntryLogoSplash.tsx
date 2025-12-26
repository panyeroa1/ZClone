'use client';

import Image from 'next/image';
import React, { useEffect, useState } from 'react';

const SPLASH_DURATION_MS = 1100;
const STORAGE_KEY = 'orbit_entry_splash_seen';

const EntryLogoSplash = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;

    const showSplash = () => {
      setIsVisible(true);
      timeoutId = window.setTimeout(() => setIsVisible(false), SPLASH_DURATION_MS);
    };

    try {
      const seen = window.sessionStorage.getItem(STORAGE_KEY);
      if (!seen) {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
        showSplash();
      }
    } catch {
      showSplash();
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="orbit-splash" aria-hidden="true">
      <div className="orbit-splash__content">
        <div className="orbit-splash__ring" />
        <Image
          src="/images/watermark.svg"
          alt=""
          width={200}
          height={60}
          priority
          className="orbit-splash__logo"
        />
        <div className="orbit-splash__glow" />
      </div>
    </div>
  );
};

export default EntryLogoSplash;

