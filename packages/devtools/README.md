# @soulcache/devtools

React DevTools panel for inspecting and debugging SoulCache runtime state.

## Installation

```bash
npm install @soulcache/devtools @soulcache/core @soulcache/devtools-core react
# or
pnpm add @soulcache/devtools @soulcache/core @soulcache/devtools-core react
```

## Quick Start

```tsx
import { SoulCacheDevToolsPanel } from '@soulcache/devtools';

function App() {
  return (
    <SoulCacheProvider client={client}>
      <MyApp />
      <SoulCacheDevToolsPanel />
    </SoulCacheProvider>
  );
}
```

## Features

- Floating panel with keyboard shortcut (Ctrl/Cmd+Shift+D)
- Query, Mutation, and Cache inspection
- Timeline recording with event filtering
- Metrics with p50/p95/p99 latencies
- Diagnostics health monitoring
- Session recording and replay

## Documentation

[https://soulcache.vercel.app](https://soulcache.vercel.app)

## License

MIT
