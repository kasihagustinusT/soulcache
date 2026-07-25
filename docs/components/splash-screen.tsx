'use client';

import { useState, useEffect } from 'react';

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const alreadyLoaded = sessionStorage.getItem('soulcache-loaded');
    if (alreadyLoaded) return;

    setVisible(true);

    const timer = setTimeout(() => {
      sessionStorage.setItem('soulcache-loaded', '1');
      setFading(true);
      setTimeout(() => setVisible(false), 500);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      aria-live="polite"
    >
      <span className="sr-only">Loading documentation...</span>
      <div className="relative mb-8">
        <img
          src="https://res.cloudinary.com/vaslp5ww/image/upload/v1784809523/soulcache-logo_isux6t.svg"
          alt="SoulCache"
          className="h-16 w-16 animate-spin-slow dark:brightness-0 dark:invert pointer-events-none select-none"
          aria-hidden="true"
          draggable={false}
        />
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
      </div>
      <p className="text-sm text-muted-foreground font-mono tracking-wide mb-6">
        Loading documentation...
      </p>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      </div>
    </div>
  );
}
