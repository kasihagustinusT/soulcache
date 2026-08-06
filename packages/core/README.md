# @soulcache/core

SoulCache Core Runtime — Deterministic data fetching and caching runtime for modern JavaScript applications.

## Installation

```bash
npm install @soulcache/core
# or
pnpm add @soulcache/core
```

## Quick Start

```typescript
import { QueryClient } from '@soulcache/core';

const client = new QueryClient();

const data = await client.fetchQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
});

client.destroy();
```

## Features

- Zero runtime dependencies
- Full TypeScript with strict mode
- Automatic caching with configurable TTL
- Request deduplication
- Cache invalidation
- Mutations and infinite queries
- Framework agnostic

> Note: retry, stale-time revalidation, and the plugin system exist as internal
> modules and are targeted for integration in future milestones.

## Documentation

[https://soulcache.vercel.app](https://soulcache.vercel.app)

## License

MIT
