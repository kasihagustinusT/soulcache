# @soulcache/devtools-core

Framework-agnostic inspection and diagnostics layer for SoulCache DevTools.

## Installation

```bash
npm install @soulcache/devtools-core @soulcache/core
# or
pnpm add @soulcache/devtools-core @soulcache/core
```

## Quick Start

```typescript
import { createInspector, createSerializer, createTimeline } from '@soulcache/devtools-core';

const inspector = createInspector();
const serializer = createSerializer();
const timeline = createTimeline();
```

## Features

- Inspector for query and cache state
- Serializer for complex types (Map, Set, Error, circular)
- Timeline for event recording and filtering
- Metrics collector for p50/p95/p99 latencies
- Diagnostics engine for health monitoring
- Session recording and replay

## Documentation

[https://soulcache.vercel.app](https://soulcache.vercel.app)

## License

MIT
