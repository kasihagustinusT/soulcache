<div align="center">

<img
  src="https://github.com/user-attachments/assets/a87816ee-7cdb-4671-b1b1-30e7560d7a7b"
  alt="SoulCache"
  width="700"
/>

# SoulCache

A high-performance runtime for data fetching and caching

[![CI](https://github.com/kasihagustinusT/soulcache/actions/workflows/ci.yml/badge.svg)](https://github.com/kasihagustinusT/soulcache/actions/workflows/ci.yml)
[![Release](https://github.com/kasihagustinusT/soulcache/actions/workflows/release.yml/badge.svg)](https://github.com/kasihagustinusT/soulcache/actions/workflows/release.yml)
[![SoulCache Quality Gates](https://github.com/kasihagustinusT/soulcache/actions/workflows/soulcache-quality-gates.yml/badge.svg)](https://github.com/kasihagustinusT/soulcache/actions/workflows/soulcache-quality-gates.yml)
[![npm](https://img.shields.io/npm/v/@soulcache/core)](https://www.npmjs.com/package/@soulcache/core)
[![GitHub release](https://img.shields.io/github/v/release/kasihagustinusT/soulcache)](https://github.com/kasihagustinusT/soulcache/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)
[![Documentation](https://img.shields.io/badge/Docs-soulcache.vercel.app-green.svg)](https://soulcache.vercel.app)

[Documentation](https://soulcache.vercel.app) | [npm](https://www.npmjs.com/package/@soulcache/core) | [Issues](https://github.com/kasihagustinusT/soulcache/issues)

</div>

SoulCache is a framework-agnostic TypeScript runtime for data fetching and caching. It provides request deduplication, cache invalidation, mutations, infinite queries, and SSR hydration with zero runtime dependencies. Retry and background refetching are internal modules targeted for integration in future milestones.

## Why SoulCache

SoulCache is built for applications that fetch data from multiple sources and need a unified caching layer without coupling to a specific UI framework.

- You are using React, Next.js, Vue, Svelte, or vanilla JavaScript
- You need shared caching logic across client and server
- You want predictable cache invalidation without boilerplate
- You need DevTools for debugging cache behavior in development

## Key Features

| Feature | Description |
|---------|-------------|
| **Framework-agnostic runtime** | Works with any UI framework or vanilla JavaScript |
| **Zero runtime dependencies** | Tree-shakeable packages with no external dependencies |
| **TypeScript-first API** | Strict mode with full type inference |
| **Query caching** | Configurable TTL, automatic eviction, request deduplication |
| **Request deduplication** | Concurrent requests for the same key share a single network call |
| **Mutations** | Optimistic updates with rollback; invalidate dependent queries from callbacks |
| **Infinite queries** | Cursor- or offset-based pagination with a bounded page window |
| **SSR & hydration** | Server-side prefetching with dehydrate/hydrate support |
| **Storage persistence** | Pluggable persistence with MemoryAdapter and migration support |
| **Plugin system** | Lifecycle hooks for query, mutation, and cache events *(internal — roadmap)* |
| **React bindings** | Hooks built on `useSyncExternalStore` for React 18+ |
| **DevTools** | Real-time inspection panel with timeline and performance metrics |

## Architecture

```mermaid
flowchart TB
    subgraph APP["Application Layer"]
        direction LR
        UI["UI Components"]
        SSR["SSR / Server Components"]
    end

    subgraph AD["Adapter · @soulcache/react"]
        direction LR
        PROV["SoulCacheProvider"]
        HOOKS["useQuery · useMutation · useInfiniteQuery · usePrefetchQuery"]
        HYD["HydrationBoundary"]
    end

    subgraph CORE["Core Runtime · @soulcache/core"]
        direction LR
        QC["QueryClient"]
        CE["CacheEngine"]
        QSM["QueryStateMachine"]
        MC["MutationCache"]
        SC["Scheduler"]
        EB["EventBus"]
    end

    subgraph PERS["Persistence · @soulcache/core"]
        direction LR
        SM["StorageManager"]
        PC["PersistenceCoordinator"]
        MM["MigrationManager"]
    end

    subgraph DEV["Developer Tooling"]
        direction LR
        DTC["@soulcache/devtools-core"]
        DT["@soulcache/devtools"]
    end

    UI --> PROV
    SSR --> HYD
    PROV --> HOOKS
    HYD --> QC
    HOOKS --> QC

    QC --> CE
    QC --> QSM
    QC --> MC
    QC --> SC
    QC --> EB

    CE --> SM
    SM --> PC
    PC --> MM

    QC --> DTC
    DTC --> DT
    UI --> DT

    classDef app fill:#3a3a3a,stroke:#f2f2f2,color:#ffffff,stroke-width:2px
    classDef adapter fill:#333333,stroke:#e8e8e8,color:#f5f5f5,stroke-width:2px
    classDef core fill:#2c2c2c,stroke:#dcdcdc,color:#f5f5f5,stroke-width:2px
    classDef persist fill:#252525,stroke:#c8c8c8,color:#e8e8e8,stroke-width:2px
    classDef dev fill:#1e1e1e,stroke:#b0b0b0,color:#dcdcdc,stroke-width:2px

    class UI,SSR app
    class PROV,HOOKS,HYD adapter
    class QC,CE,QSM,MC,SC,EB core
    class SM,PC,MM persist
    class DTC,DT dev

    style APP fill:none,stroke:#6e7681,stroke-dasharray:4 3,stroke-width:1px
    style AD fill:none,stroke:#6e7681,stroke-dasharray:4 3,stroke-width:1px
    style CORE fill:none,stroke:#6e7681,stroke-dasharray:4 3,stroke-width:1px
    style PERS fill:none,stroke:#6e7681,stroke-dasharray:4 3,stroke-width:1px
    style DEV fill:none,stroke:#6e7681,stroke-dasharray:4 3,stroke-width:1px
```

## Installation

```bash
npm install @soulcache/core
```

```bash
pnpm add @soulcache/core
```

```bash
yarn add @soulcache/core
```

```bash
bun add @soulcache/core
```

For React applications:

```bash
npm install @soulcache/react @soulcache/core
```

## Quick Start

```typescript
import { QueryClient } from '@soulcache/core';

const client = new QueryClient();

// Fetch data
const users = await client.fetchQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then((r) => r.json()),
});

// Subscribe to updates
const unsubscribe = client.subscribe(['users'], (snapshot) => {
  console.log(snapshot.data, snapshot.status);
});

// Update cache
client.setQueryData(['users'], (prev) => [...prev, newUser]);

// Invalidate cache entries (mark stale; call fetchQuery to refetch)
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

| Package | Purpose | Status |
|---------|---------|--------|
| [`@soulcache/core`](./packages/core) | Core runtime with cache, state machine, scheduler, storage, and event bus | Stable |
| [`@soulcache/react`](./packages/react) | React bindings via `useSyncExternalStore` | Stable |
| [`@soulcache/devtools-core`](./packages/devtools-core) | Framework-agnostic inspection and diagnostics | Stable |
| [`@soulcache/devtools`](./packages/devtools) | React DevTools panel with timeline, metrics, and session recording | Stable |

## Documentation

| Topic | Description |
|-------|-------------|
| [Installation](https://soulcache.vercel.app/docs/installation) | Setup and configuration guide |
| [Quick Start](https://soulcache.vercel.app/docs/quick-start) | Getting started in 5 minutes |
| [API Reference](https://soulcache.vercel.app/docs/query-client) | Complete API documentation |
| [React Adapter](https://soulcache.vercel.app/docs/react-adapter) | React hooks and components |
| [Storage](https://soulcache.vercel.app/docs/storage) | Persistence adapters and configuration |
| [Plugins](https://soulcache.vercel.app/docs/plugins) | Lifecycle hooks and custom extensions |
| [Hydration](https://soulcache.vercel.app/docs/hydration) | SSR and streaming support |
| [Migration Guide](https://soulcache.vercel.app/docs/migration-guide) | Upgrading between versions |
| [Performance](https://soulcache.vercel.app/docs/performance) | Benchmarks and optimization |
| [Troubleshooting](https://soulcache.vercel.app/docs/troubleshooting) | Common issues and solutions |

- Production-ready
- MIT License
- Semantic Versioning
- GitHub Actions CI/CD
- TypeScript strict mode
- Framework-agnostic runtime
- Actively maintained

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, code style, and pull request guidelines.

## Support

- [GitHub Issues](https://github.com/kasihagustinusT/soulcache/issues) — Bug reports and feature requests
- [Security Policy](https://github.com/kasihagustinusT/soulcache/blob/main/SECURITY.md) — Vulnerability reporting
- [Documentation](https://soulcache.vercel.app) — Complete documentation

## License

[MIT](LICENSE) — Copyright (c) 2026 Kasih Agustinus
