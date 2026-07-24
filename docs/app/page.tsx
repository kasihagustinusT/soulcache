import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

const BASE_URL = 'https://soulcache.vercel.app';
const LOGO_URL = 'https://res.cloudinary.com/vaslp5ww/image/upload/v1784809523/soulcache-logo_isux6t.svg';
const OG_IMAGE_URL = 'https://res.cloudinary.com/vaslp5ww/image/upload/f_auto,q_auto,w_512/v1784806314/soulcache-logo_tjwmu7.png';

export const metadata: Metadata = {
  title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
  description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications. Zero runtime dependencies. Full type safety.',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications.',
    url: BASE_URL,
    siteName: 'SoulCache',
    type: 'website',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 512,
        height: 512,
        alt: 'SoulCache',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SoulCache - TypeScript Data Fetching & Caching Runtime',
    description: 'A lightweight, framework-agnostic data fetching and caching runtime for TypeScript applications.',
    images: [OG_IMAGE_URL],
  },
};

const features = [
  {
    title: 'Smart Caching',
    description: 'Stale-while-revalidate, automatic garbage collection, and intelligent invalidation with configurable TTL.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    href: '/docs/cache-system',
  },
  {
    title: 'Automatic Retry',
    description: 'Exponential, linear, or constant backoff strategies with error classification and configurable retry policies.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
    href: '/docs/retry',
  },
  {
    title: 'Background Refetch',
    description: 'Automatic refetching on focus, reconnect, and interval. Keep data fresh without manual intervention.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
      </svg>
    ),
    href: '/docs/query-system',
  },
  {
    title: 'Infinite Queries',
    description: 'Built-in support for paginated and infinite scrolling data with automatic page management.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    href: '/docs/infinite-query',
  },
  {
    title: 'SSR & Hydration',
    description: 'Server-side prefetching with dehydrate/hydrate for streaming. Compatible with Next.js App Router.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
    href: '/docs/ssr',
  },
  {
    title: 'DevTools',
    description: 'Floating panel with keyboard shortcut. Query, mutation, and cache inspection with timeline and metrics.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    href: '/docs/plugins',
  },
  {
    title: 'Type Safe',
    description: 'Strict TypeScript with zero any types in source. End-to-end type safety across all APIs.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    href: '/docs/architecture',
  },
  {
    title: 'Plugin System',
    description: 'Lifecycle hooks for query, mutation, and cache events. Custom storage, retry, and middleware.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.914-4.5a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    href: '/docs/plugins',
  },
  {
    title: 'Zero Dependencies',
    description: 'No runtime dependencies. Tree-shakeable packages. Minimal bundle size for any application.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    href: '/docs/architecture',
  },
];

const packages = [
  {
    name: '@soulcache/core',
    description: 'Core runtime with cache, query engine, retry, scheduler, storage, and plugin system',
    href: '/docs/query-client',
    npm: 'https://www.npmjs.com/package/@soulcache/core',
    github: 'https://github.com/kasihagustinusT/soulcache/tree/main/packages/core',
  },
  {
    name: '@soulcache/react',
    description: 'React bindings via useSyncExternalStore with hooks and components',
    href: '/docs/react-adapter',
    npm: 'https://www.npmjs.com/package/@soulcache/react',
    github: 'https://github.com/kasihagustinusT/soulcache/tree/main/packages/react',
  },
  {
    name: '@soulcache/devtools',
    description: 'React DevTools panel with timeline, metrics, and session recording',
    href: '/docs/plugins',
    npm: 'https://www.npmjs.com/package/@soulcache/devtools',
    github: 'https://github.com/kasihagustinusT/soulcache/tree/main/packages/devtools',
  },
  {
    name: '@soulcache/devtools-core',
    description: 'Framework-agnostic inspection and diagnostics',
    href: '/docs/plugins',
    npm: 'https://www.npmjs.com/package/@soulcache/devtools-core',
    github: 'https://github.com/kasihagustinusT/soulcache/tree/main/packages/devtools-core',
  },
];

const performanceStats = [
  { label: 'Cache Operations', value: 'O(1)', detail: 'HashMap-based lookups' },
  { label: 'Runtime Dependencies', value: '0', detail: 'Zero external packages' },
  { label: 'TypeScript Coverage', value: '100%', detail: 'Zero any types' },
  { label: 'Test Coverage', value: '756', detail: 'Tests passing' },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#030712]/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src={LOGO_URL}
              alt="SoulCache Logo"
              className="soulcache-logo h-8 w-8 transition-transform group-hover:scale-110"
              width={32}
              height={32}
              loading="eager"
              decoding="async"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white">SoulCache</span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link href="/docs/installation" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors">
              Docs
            </Link>
            <Link href="/docs/quick-start" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors">
              Quick Start
            </Link>
            <Link href="/docs/query-client" className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors">
              API
            </Link>
            <a
              href="https://github.com/kasihagustinusT/soulcache"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <div className="ml-2 h-5 w-px bg-gray-200 dark:bg-gray-800" />
            <a
              href="https://www.npmjs.com/package/@soulcache/core"
              className="ml-2 rounded-lg bg-primary-600 dark:bg-primary-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-primary-600/25 dark:shadow-primary-500/30 hover:bg-primary-500 dark:hover:bg-primary-400 transition-all hover:shadow-md"
              target="_blank"
              rel="noopener noreferrer"
            >
              npm
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/80 to-white dark:from-primary-950/30 dark:via-[#0a0f1e] dark:to-[#030712]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:px-8 lg:pt-32 lg:pb-36">
          <div className="mx-auto max-w-4xl text-center">
            {/* Hero Logo — dominant visual element */}
            <div className="mb-8 sm:mb-10 flex justify-center">
              <Image
                src="/img/soulcache.png"
                alt="SoulCache — TypeScript Data Fetching and Caching Runtime"
                width={520}
                height={520}
                priority
                quality={100}
                sizes="(max-width: 640px) 208px, (max-width: 768px) 256px, (max-width: 1024px) 320px, (max-width: 1280px) 384px, 448px"
                className="w-52 sm:w-64 md:w-80 lg:w-96 xl:w-[28rem] h-auto drop-shadow-2xl dark:drop-shadow-[0_0_40px_rgba(56,189,248,0.15)]"
              />
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
              SoulCache
            </h1>

            {/* Tagline */}
            <p className="mt-4 text-lg font-medium text-primary-600 dark:text-primary-400 sm:text-xl">
              Universal TypeScript Data Fetching &amp; Intelligent Cache Runtime
            </p>

            {/* Description */}
            <p className="mt-5 text-base leading-relaxed text-gray-600 dark:text-gray-400 max-w-2xl mx-auto sm:text-lg">
              A lightweight, framework-agnostic data fetching and caching runtime. Zero runtime dependencies. Full type safety. Production-ready.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex items-center justify-center gap-x-4 flex-wrap">
              <a
                href="/docs/installation"
                className="rounded-lg bg-primary-600 dark:bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 dark:shadow-primary-500/30 hover:bg-primary-500 dark:hover:bg-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all hover:shadow-xl"
              >
                Get Started
              </a>
              <a
                href="https://github.com/kasihagustinusT/soulcache"
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>

            {/* Install command */}
            <div className="mt-8 flex justify-center">
              <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 px-5 py-3 shadow-sm">
                <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  npm install @soulcache/core
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance Stats */}
      <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {performanceStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {stat.label}
                </div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {stat.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Built for Production
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Everything you need for efficient data fetching, caching, and state management.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl sm:mt-20 lg:mt-24">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <a
                  key={feature.title}
                  href={feature.href}
                  className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 transition-all hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-600/5 dark:hover:shadow-primary-500/5"
                >
                  <div className="mb-3 text-primary-600 dark:text-primary-400">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Simple and Powerful
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Get started with just a few lines of code.
            </p>
            <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg dark:shadow-2xl dark:shadow-black/20">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400" />
                    <span className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    quick-start.ts
                  </span>
                </div>
              </div>
              <pre className="overflow-x-auto bg-gray-950 dark:bg-[#020617] p-6 text-sm leading-relaxed text-gray-100 dark:text-gray-200">
{`import { QueryClient } from '@soulcache/core';

const client = new QueryClient();

// Fetch data with automatic caching
const users = await client.fetchQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
});

// Subscribe to real-time updates
client.subscribe(['users'], (snapshot) => {
  console.log(snapshot.data);
});

// Update cache manually
client.setQueryData(['users'], (prev) => [...prev, newUser]);

// Invalidate and refetch
await client.invalidateQueries(['users']);`}
              </pre>
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/docs/quick-start"
                className="text-sm font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
              >
                View full quick start guide &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Official Packages
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Install only what you need. Each package is tree-shakeable and has zero runtime dependencies.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 p-6 transition-all hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg hover:shadow-primary-600/5 dark:hover:shadow-primary-500/5"
              >
                <div className="mb-2 font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {pkg.name}
                </div>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {pkg.description}
                </p>
                <div className="mt-4 flex gap-4">
                  <a
                    href={pkg.npm}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    npm
                  </a>
                  <a
                    href={pkg.github}
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                  <a
                    href={pkg.href}
                    className="text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
                  >
                    Docs
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ready to get started?
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Read the documentation and start building with SoulCache.
          </p>
          <div className="mt-8 flex items-center justify-center gap-x-4">
            <a
              href="/docs/installation"
              className="rounded-lg bg-primary-600 dark:bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-600/25 dark:shadow-primary-500/30 hover:bg-primary-500 dark:hover:bg-primary-400 transition-all hover:shadow-md"
            >
              Read the Docs
            </a>
            <a
              href="https://github.com/kasihagustinusT/soulcache"
              className="rounded-lg border border-gray-300 dark:border-gray-700 px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#030712]">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_URL}
                alt="SoulCache Logo"
                className="soulcache-logo h-6 w-6"
                width={24}
                height={24}
                loading="eager"
                decoding="async"
              />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">SoulCache</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/docs/installation" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                Documentation
              </Link>
              <a href="https://github.com/kasihagustinusT/soulcache" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://www.npmjs.com/package/@soulcache/core" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" target="_blank" rel="noopener noreferrer">
                npm
              </a>
              <Link href="/docs/contributing" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                Contributing
              </Link>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              &copy; 2026 SoulCache. MIT License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
