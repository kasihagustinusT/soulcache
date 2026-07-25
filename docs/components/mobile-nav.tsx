'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileNavCtx {
  open: boolean;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavCtx>({ open: false, toggle: () => {} });

const navLinks = [
  { href: '/docs/installation', label: 'Docs' },
  { href: '/docs/quick-start', label: 'Quick Start' },
  { href: '/docs/query-client', label: 'API' },
];

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function MobileNavButton() {
  const { open, toggle } = useContext(MobileNavContext);

  return (
    <button
      type="button"
      onClick={toggle}
      className="md:hidden relative z-[60] flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={open ? 'Close menu' : 'Open menu'}
    >
      {open ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      )}
    </button>
  );
}

export function MobileNavOverlay() {
  const { open } = useContext(MobileNavContext);
  const pathname = usePathname();

  return (
    <div
      className={`md:hidden fixed inset-0 top-16 z-50 bg-background transition-opacity duration-200 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <nav className="px-4 pt-4 pb-8">
        <div className="flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                pathname === link.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 h-px bg-border" />
          <a
            href="https://www.npmjs.com/package/@soulcache/core"
            className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on npm
          </a>
        </div>
      </nav>
    </div>
  );
}
