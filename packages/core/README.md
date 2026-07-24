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
- Automatic caching with stale-while-revalidate
- Request deduplication
- Retry with backoff strategies
- Plugin system
- Framework agnostic

## Documentation

[https://soulcache.vercel.app](https://soulcache.vercel.app)

## License

MIT
