<div align="center">

<img
  src="https://github.com/user-attachments/assets/a87816ee-7cdb-4671-b1b1-30e7560d7a7b"
  alt="SoulCache Logo"
  width="700"
/>

# SoulCache

TypeScript-native data fetching and caching for any application.

[![CI](https://github.com/kasihagustinusT/soulcache/actions/workflows/ci.yml/badge.svg)](https://github.com/kasihagustinusT/soulcache/actions/workflows/ci.yml)
[![Release](https://github.com/kasihagustinusT/soulcache/actions/workflows/release.yml/badge.svg)](https://github.com/kasihagustinusT/soulcache/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/@soulcache/core)](https://www.npmjs.com/package/@soulcache/core)
[![Downloads](https://img.shields.io/npm/dm/@soulcache/core)](https://www.npmjs.com/package/@soulcache/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Documentation](https://img.shields.io/badge/Docs-soulcache.vercel.app-green.svg)](https://soulcache.vercel.app)

[Documentation](https://soulcache.vercel.app) · [npm](https://www.npmjs.com/package/@soulcache/core) · [Examples](./packages/examples) · [Issues](https://github.com/kasihagustinusT/soulcache/issues)

</div>

SoulCache is a framework-agnostic data fetching and caching runtime for TypeScript applications. It handles deduplication, background refetching, retry logic, and cache invalidation with zero runtime dependencies.

Use it when you need predictable caching behavior across client and server without coupling to a specific UI framework. Works with React, Next.js, Vue, Svelte, or vanilla JavaScript.

**Table of Contents**

- [Why SoulCache](#why-soulcache)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [React Example](#react-example)
- [Package Overview](#package-overview)
- [DevTools](#devtools)
- [Performance](#performance)
- [Browser & Runtime Support](#browser--runtime-support)
- [Documentation](#documentation)
- [Examples](#examples)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Why SoulCache

- **Predictable caching.** Stale-while-revalidate, garbage collection, and invalidation follow clear, inspectable rules.
- **Minimal overhead.** Tree-shakeable packages. No runtime dependencies to install or audit.
- **Full type safety.** Strict TypeScript with zero `any` types in source.
- **Framework flexibility.** Core is framework-agnostic. React bindings use `useSyncExternalStore`.
- **Observable state.** Subscribe to any query key and receive structured snapshots.
- **Extensible design.** Plugin system with lifecycle hooks for custom storage, retry, and middleware.

## Features

### Core Runtime

- Zero runtime dependencies
- Full TypeScript with strict mode
- ESM-only with tree-shaking
- Framework-agnostic design

### Caching

- Stale-while-revalidate
- Configurable TTL and garbage collection
- Automatic eviction
- Dependency tracking

### Fetching

- Request deduplication
- Automatic retry with exponential, linear, or constant backoff
- Error classification
- Background refetching

### Mutations

- Optimistic updates with rollback
- Mutation cache with observer support
- Automatic cache invalidation

### SSR & Hydration

- Server-side prefetching
- Dehydrate/hydrate for streaming
- Partial hydration
- Next.js App Router compatible

### Storage

- Pluggable adapters (Memory, IndexedDB, LocalStorage)
- Automatic persistence
- Migration manager

### Plugins

- Lifecycle hooks for query, mutation, and cache events
- Error isolation per hook
- Automatic dependency resolution

### DevTools

- Floating panel with keyboard shortcut (Ctrl/Cmd+Shift+D)
- Query, mutation, and cache inspection
- Timeline recording
- p50, p95, p99 metrics

## Requirements

- **Node.js** 20 or later
- **TypeScript** 5.4 or later
- **React** 18 or later (only if using `@soulcache/react`)

## Installation

```bash
# npm
npm install @soulcache/core

# pnpm
pnpm add @soulcache/core

# yarn
yarn add @soulcache/core

# bun
bun add @soulcache/core
```

For React applications, also install the React adapter:

```bash
npm install @soulcache/react @soulcache/core
```

## Quick Start

```typescript
import { QueryClient } from '@soulcache/core';

const client = new QueryClient();

// Fetch data with automatic caching
const users = await client.fetchQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then((r) => r.json()),
});

// Subscribe to real-time updates
const unsubscribe = client.subscribe(['users'], (snapshot) => {
  console.log(snapshot.data, snapshot.status);
});

// Update cache manually
client.setQueryData(['users'], (prev) => [...prev, newUser]);

// Invalidate and refetch
await client.invalidateQueries(['users']);

// Cleanup
client.destroy();
```

## React Example

```tsx
import { SoulCacheProvider, useQuery } from '@soulcache/react';
import { QueryClient } from '@soulcache/core';

const queryClient = new QueryClient();

function App() {
  return (
    <SoulCacheProvider client={queryClient}>
      <UserList />
    </SoulCacheProvider>
  );
}

function UserList() {
  const { data, status, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
  });

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

## Package Overview

| Package | Description |
|---------|-------------|
| [`@soulcache/core`](./packages/core) | Core runtime with cache, query engine, retry, scheduler, storage, and plugin system |
| [`@soulcache/react`](./packages/react) | React bindings via `useSyncExternalStore` |
| [`@soulcache/devtools-core`](./packages/devtools-core) | Framework-agnostic inspection and diagnostics |
| [`@soulcache/devtools`](./packages/devtools) | React DevTools panel with timeline, metrics, and session recording |

## DevTools

Real-time inspection of cache state, query lifecycle, and performance metrics.

```tsx
import { SoulCacheDevToolsPanel } from '@soulcache/devtools';

function App() {
  return (
    <SoulCacheProvider client={queryClient}>
      <MyApp />
      <SoulCacheDevToolsPanel />
    </SoulCacheProvider>
  );
}
```

Open with `Ctrl/Cmd+Shift+D`. Six tabs: Queries, Mutations, Timeline, Metrics, Health, Settings.

## Performance

- O(1) cache lookups
- Tree-shakeable packages
- Benchmark suite included in `packages/core/src/benchmark/`

## Browser & Runtime Support

| Runtime | Status |
|---------|--------|
| Node.js 20+ | Supported |
| Bun 1.x | Supported |
| Deno 1.x+ | Supported |
| Edge Runtime | Supported |
| Browser (ESM) | Supported |
| React 18 | Supported |
| React 19 | Supported |
| Next.js | Supported |
| Vite | Supported |
| Astro | Supported |
| Remix | Supported |

## Documentation

- [Getting Started](https://soulcache.vercel.app/docs/installation) -- Installation and setup
- [API Reference](https://soulcache.vercel.app/docs/query-client) -- Complete API documentation
- [React Adapter](https://soulcache.vercel.app/docs/react-adapter) -- Hooks and components
- [Migration Guide](https://soulcache.vercel.app/docs/migration-guide) -- Migrate from React Query or SWR
- [Performance](https://soulcache.vercel.app/docs/performance) -- Benchmarks and optimization

## Examples

Example projects are available in [`packages/examples`](./packages/examples).

## Project Status

SoulCache is production-ready and actively maintained. The public API follows Semantic Versioning. Documentation includes installation guides, API reference, migration guides, and release notes at [soulcache.vercel.app](https://soulcache.vercel.app).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code style, and pull request guidelines.

## Support

- [GitHub Issues](https://github.com/kasihagustinusT/soulcache/issues) -- Bug reports and feature requests
- [Security Policy](https://github.com/kasihagustinusT/soulcache/blob/main/SECURITY.md) -- Vulnerability reporting
- [Support](https://github.com/kasihagustinusT/soulcache/blob/main/SUPPORT.md) -- Getting help

## License

[MIT](LICENSE) -- Copyright (c) 2026 Kasih Agustinus
