# @soulcache/react

React bindings for SoulCache - Thin adapter layer that bridges SoulCache Core Runtime to React via `useSyncExternalStore`.

## Installation

```bash
npm install @soulcache/react @soulcache/core
# or
pnpm add @soulcache/react @soulcache/core
```

## Quick Start

```tsx
import { SoulCacheProvider, useQuery, useMutation } from '@soulcache/react';

function App() {
  return (
    <SoulCacheProvider>
      <Todos />
    </SoulCacheProvider>
  );
}

function Todos() {
  const { data, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: () => fetch('/api/todos').then(r => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (newTodo: string) =>
      fetch('/api/todos', { method: 'POST', body: JSON.stringify({ title: newTodo }) }),
    onSuccess: () => { /* invalidate query */ },
  });

  if (isLoading) return <div>Loading...</div>;
  return <ul>{data?.map((t: any) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

## License

MIT
