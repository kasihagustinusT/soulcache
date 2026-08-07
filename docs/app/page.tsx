import type { Metadata } from 'next';
import Link from 'next/link';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { MobileNavProvider, MobileNavButton, MobileNavOverlay } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { BASE_URL, LOGO_URL, OG_IMAGE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
  description: 'A high-performance runtime for data fetching and caching. Zero runtime dependencies. Full type safety. Framework-agnostic.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A high-performance runtime for data fetching and caching.',
    url: BASE_URL,
    siteName: 'SoulCache',
    type: 'website',
    images: [{ url: OG_IMAGE_URL, width: 512, height: 512, alt: 'SoulCache' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A high-performance runtime for data fetching and caching.',
    images: [OG_IMAGE_URL],
  },
};

const quickStartCode = `import { QueryClient } from '@soulcache/core';

const client = new QueryClient();

// Fetch with automatic caching & deduplication
const { data } = await client.fetchQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const res = await fetch('/api/users');
    return res.json();
  },
});

// Subscribe to real-time updates
const unsub = client.subscribe(['users'], (snapshot) => {
  console.log('Updated:', snapshot.data);
});

// Invalidate and refetch
await client.invalidateQueries(['users']);`;

const features = [
  {
    title: 'Smart Cache',
    description: 'TTL caching with automatic garbage collection and LRU eviction.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
  {
    title: 'Request Dedup',
    description: 'Identical in-flight requests are automatically merged into one.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    title: 'Mutations',
    description: 'Optimistic updates with rollback and cache invalidation.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    title: 'Infinite Queries',
    description: 'Cursor-based pagination with automatic page management.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    ),
  },
  {
    title: 'SSR & Hydration',
    description: 'Server-side prefetch with dehydrate/hydrate. Next.js, Remix, and more.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: 'Cache Invalidation',
    description: 'Invalidate and refetch queries with dependency tracking.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Persistence',
    description: 'Pluggable storage adapters with automatic persistence.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    title: 'DevTools',
    description: 'Real-time inspection panel with query timeline and cache state.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: 'Type Safe',
    description: 'Full TypeScript strict mode. Inferred types. Zero `any`.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'Framework Agnostic',
    description: 'React, Vue, Svelte, Solid, or plain JavaScript. No lock-in.',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
];

const stats = [
  { value: 'O(1)', label: 'Cache Hit' },
  { value: '0', label: 'Dependencies' },
  { value: '100%', label: 'TypeScript' },
  { value: '~16KB', label: 'Core gzip bundle' },
];

const packages = [
  { name: '@soulcache/core', desc: 'Core runtime with QueryClient, CacheEngine, and Scheduler', href: '/docs/query-client' },
  { name: '@soulcache/react', desc: 'React hooks: useQuery, useMutation, useInfiniteQuery', href: '/docs/react-adapter' },
  { name: '@soulcache/devtools', desc: 'Visual debugging panel with real-time inspection', href: '/docs/devtools' },
];

const steps = [
  { step: '01', title: 'Install', code: 'npm install @soulcache/core' },
  { step: '02', title: 'Configure', code: 'const client = new QueryClient()' },
  { step: '03', title: 'Fetch', code: 'await client.fetchQuery({ queryKey, queryFn })' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileNavProvider>
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src={LOGO_URL}
              alt="SoulCache"
              className="h-7 w-7 transition-transform group-hover:scale-105 dark:brightness-0 dark:invert"
            />
            <span className="text-sm font-semibold tracking-tight">SoulCache</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link href="/docs/installation" className="nav-link">Docs</Link>
            <Link href="/docs/quick-start" className="nav-link">Quick Start</Link>
            <Link href="/docs/query-client" className="nav-link">API</Link>
            <div className="ml-3 h-4 w-px bg-border" />
            <ThemeToggle />
            <a
              href="https://www.npmjs.com/package/@soulcache/core"
              className="ml-3 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm
            </a>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <MobileNavButton />
          </div>
        </div>
      </nav>
      <MobileNavOverlay />

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-12 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 hero-radial" />
        <div className="absolute inset-0 bg-dots opacity-40" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            {/* Logo with glow */}
            <div className="mb-8 sm:mb-10 inline-flex animate-fade-in">
              <div className="relative">
                {/* Glow rings */}
                <div className="absolute inset-0 -m-8 sm:-m-12">
                  <div className="hero-glow-ring hero-glow-ring-1" />
                  <div className="hero-glow-ring hero-glow-ring-2" />
                  <div className="hero-glow-ring hero-glow-ring-3" />
                  <div className="hero-glow-ring hero-glow-ring-4" />
                  <div className="hero-glow-ring hero-glow-ring-5" />
                </div>
                {/* Logo */}
                <img
                  src={LOGO_URL}
                  alt="SoulCache"
                  className="relative h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44 lg:h-52 lg:w-52 xl:h-56 xl:w-56 dark:brightness-0 dark:invert"
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in animate-delay-1">
              SoulCache
            </h1>

            {/* Version badge */}
            <div className="mt-3 animate-fade-in animate-delay-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
                v1.1.1
              </span>
            </div>

            {/* Subtitle */}
            <p className="mt-5 text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in animate-delay-2">
              High-performance data fetching and caching runtime for TypeScript. Zero dependencies. Full type safety.
            </p>

            {/* CTAs */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 animate-fade-in animate-delay-3">
              <Link
                href="/docs/installation"
                className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Documentation
              </Link>
            </div>

            {/* Install */}
            <div className="mt-8 sm:mt-10 animate-fade-in animate-delay-4">
              <div className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
                <span className="text-muted-foreground text-xs">$</span>
                <code className="text-sm font-mono">npm install @soulcache/core</code>
                <span className="inline-block h-4 w-px bg-foreground animate-blink" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-border/40 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 py-4 sm:py-5">
            {stats.map((stat, i) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-bold font-mono tracking-tight">{stat.value}</span>
                <span className="text-xs sm:text-sm text-muted-foreground">{stat.label}</span>
                {i < stats.length - 1 && (
                  <span className="hidden sm:inline text-border ml-4 font-mono text-xs">//</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Everything you need
            </h2>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground">
              A complete toolkit for efficient data management.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50 rounded-xl overflow-hidden">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-background p-6 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code Example ── */}
      <section className="border-y border-border/40 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                Simple API, powerful features
              </h2>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Start fetching data in seconds. SoulCache handles caching, deduplication, and cache invalidation automatically.
              </p>

              <div className="mt-8 sm:mt-10 space-y-5">
                {steps.map((s) => (
                  <div key={s.step} className="flex items-start gap-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground text-xs font-mono font-medium">
                      {s.step}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{s.title}</div>
                      <code className="mt-1 block text-xs text-muted-foreground font-mono">{s.code}</code>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/docs/quick-start"
                className="mt-8 sm:mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Read the quick start guide
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>

            <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground/30" />
                </div>
                <span className="ml-2 text-xs text-muted-foreground font-mono">example.ts</span>
              </div>
              <div className="p-4">
                <DynamicCodeBlock lang="ts" code={quickStartCode} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Packages ── */}
      <section className="py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Official packages
            </h2>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground">
              Install what you need. Each package is tree-shakeable.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <Link
                key={pkg.name}
                href={pkg.href}
                className="group rounded-xl border border-border/50 bg-card/30 p-6 transition-all duration-200 hover:border-border hover:bg-card/60 hover:shadow-sm"
              >
                <div className="font-mono text-sm font-semibold mb-2 text-foreground">{pkg.name}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{pkg.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                  Learn more
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-border/40 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              Start building with SoulCache
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Open source. MIT licensed. Built for production.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/docs/installation"
                className="rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
              <a
                href="https://github.com/kasihagustinusT/soulcache"
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted flex items-center gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <img
                src={LOGO_URL}
                alt="SoulCache"
                className="h-5 w-5 dark:brightness-0 dark:invert"
              />
              <span className="text-sm font-medium font-mono">SoulCache</span>
            </div>
            <div className="flex items-center gap-5 sm:gap-6">
              <Link href="/docs/installation" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
              <a href="https://github.com/kasihagustinusT/soulcache" className="text-xs text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://www.npmjs.com/package/@soulcache/core" className="text-xs text-muted-foreground hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">npm</a>
              <Link href="/docs/contributing" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contributing</Link>
            </div>
            <p className="text-xs text-muted-foreground font-mono">&copy; 2026</p>
          </div>
        </div>
      </footer>
      </MobileNavProvider>
    </div>
  );
}
