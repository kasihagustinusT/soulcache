import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../src/context';
import { useQuery } from '../src/use-query';
import { useQueryClient } from '../src/use-query-client';
import { useMutation } from '../src/use-mutation';
import { usePrefetchQuery } from '../src/use-prefetch-query';
import { useIsFetching } from '../src/use-is-fetching';
import { useIsMutating } from '../src/use-is-mutating';
import { HydrationBoundary } from '../src/hydration-boundary';
import { dehydrate } from '@soulcache/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(client?: QueryClient) {
  const qc = client ?? new QueryClient();
  return {
    client: qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <SoulCacheProvider client={qc}>{children}</SoulCacheProvider>
    ),
  };
}

// ---------------------------------------------------------------------------
// SoulCacheProvider + useQueryClient
// ---------------------------------------------------------------------------

describe('SoulCacheProvider', () => {
  it('provides QueryClient to children via context', () => {
    const { client, wrapper } = createWrapper();

    const { result } = renderHook(() => useQueryClient(), { wrapper });
    expect(result.current).toBe(client);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useQueryClient());
    }).toThrow('useSoulCacheContext: No QueryClient found');
  });
});

// ---------------------------------------------------------------------------
// useQuery
// ---------------------------------------------------------------------------

describe('useQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('returns idle state initially', () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useQuery({
        queryKey: ['test'],
        queryFn: async () => 'data',
        enabled: false,
      }),
      { wrapper },
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches data and returns success state', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useQuery({
        queryKey: ['fetch-test'],
        queryFn: async () => 'hello world',
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('hello world');
    expect(result.current.status).toBe('success');
  });

  it('handles errors', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useQuery({
        queryKey: ['error-test'],
        queryFn: async () => {
          throw new Error('fetch failed');
        },
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('fetch failed');
  });

  it('does not fetch when enabled=false', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result } = renderHook(
      () => useQuery({
        queryKey: ['disabled'],
        queryFn: async () => {
          fetchCount++;
          return 'data';
        },
        enabled: false,
      }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCount).toBe(0);
    expect(result.current.isIdle).toBe(true);
  });

  it('supports queryKey changes', async () => {
    const { wrapper } = createWrapper(client);

    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useQuery({
        queryKey: ['user', id],
        queryFn: async () => `user-${id}`,
      }),
      { wrapper, initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('user-1');
  });

  it('supports onSuccess callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackData: string | undefined;

    renderHook(
      () => useQuery({
        queryKey: ['callback-test'],
        queryFn: async () => 'success data',
        onSuccess: (data) => { callbackData = data; },
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(callbackData).toBe('success data');
    });
  });

  it('supports onError callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackError: Error | undefined;

    renderHook(
      () => useQuery({
        queryKey: ['error-callback'],
        queryFn: async () => { throw new Error('test error'); },
        onError: (err) => { callbackError = err; },
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(callbackError).toBeInstanceOf(Error);
      expect(callbackError?.message).toBe('test error');
    });
  });

  it('reads cached data without refetching', async () => {
    client.setQueryData(['cached'], 'pre-cached');
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useQuery({
        queryKey: ['cached'],
        queryFn: async () => 'fresh',
      }),
      { wrapper },
    );

    // Should immediately have the cached data
    expect(result.current.data).toBe('pre-cached');
  });
});

// ---------------------------------------------------------------------------
// useMutation
// ---------------------------------------------------------------------------

describe('useMutation', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('returns idle state initially', () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => vars,
      }),
      { wrapper },
    );

    expect(result.current.isIdle).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('executes mutation and returns success', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (name: string) => `created: ${name}`,
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate('Alice');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('created: Alice');
  });

  it('handles mutation errors', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (_vars: void) => {
          throw new Error('mutation failed');
        },
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('mutation failed');
  });

  it('prevents concurrent mutations', async () => {
    const { wrapper } = createWrapper(client);
    let callCount = 0;

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => {
          callCount++;
          await new Promise((r) => setTimeout(r, 50));
          return vars;
        },
      }),
      { wrapper },
    );

    // First call
    act(() => {
      result.current.mutate('first');
    });

    // Second call while first is pending
    act(() => {
      result.current.mutate('second');
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Only first should have executed
    expect(callCount).toBe(1);
  });

  it('resets state', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => vars,
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate('test');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('calls onSuccess callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackData: string | undefined;

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => vars,
        onSuccess: (data) => { callbackData = data; },
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate('success');
    });

    await waitFor(() => {
      expect(callbackData).toBe('success');
    });
  });

  it('calls onError callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackError: Error | undefined;

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (_vars: void) => {
          throw new Error('cb error');
        },
        onError: (err) => { callbackError = err; },
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(callbackError?.message).toBe('cb error');
    });
  });

  it('supports mutateAsync', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => `async: ${vars}`,
      }),
      { wrapper },
    );

    let data: string | undefined;
    await act(async () => {
      data = await result.current.mutateAsync('bob');
    });

    expect(data).toBe('async: bob');
  });

  it('supports onMutate for optimistic updates', async () => {
    const { wrapper } = createWrapper(client);
    let context: unknown;

    const { result } = renderHook(
      () => useMutation({
        mutationFn: async (vars: string) => vars,
        onMutate: (vars) => {
          context = { optimistic: vars };
          return context;
        },
      }),
      { wrapper },
    );

    await act(async () => {
      result.current.mutate('optimistic');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(context).toEqual({ optimistic: 'optimistic' });
  });
});

// ---------------------------------------------------------------------------
// usePrefetchQuery
// ---------------------------------------------------------------------------

describe('usePrefetchQuery', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('returns a prefetch function', () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => usePrefetchQuery({
        queryKey: ['prefetch'],
        queryFn: async () => 'prefetched',
      }),
      { wrapper },
    );

    expect(typeof result.current).toBe('function');
  });

  it('prefetches data when called', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => usePrefetchQuery({
        queryKey: ['prefetch-data'],
        queryFn: async () => 'prefetched data',
      }),
      { wrapper },
    );

    act(() => {
      result.current();
    });

    await waitFor(() => {
      const data = client.getQueryData<string>(['prefetch-data']);
      expect(data).toBe('prefetched data');
    });
  });

  it('does not refetch already cached data', async () => {
    client.setQueryData(['already-cached'], 'cached');
    let fetchCount = 0;

    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => usePrefetchQuery({
        queryKey: ['already-cached'],
        queryFn: async () => {
          fetchCount++;
          return 'fresh';
        },
      }),
      { wrapper },
    );

    act(() => {
      result.current();
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useIsFetching
// ---------------------------------------------------------------------------

describe('useIsFetching', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('returns 0 when no queries are fetching', () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(() => useIsFetching(), { wrapper });
    expect(result.current).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// useIsMutating
// ---------------------------------------------------------------------------

describe('useIsMutating', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('returns 0 when no mutations are pending', () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(() => useIsMutating(), { wrapper });
    expect(result.current).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// HydrationBoundary
// ---------------------------------------------------------------------------

describe('HydrationBoundary', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('hydrates state into the query client', async () => {
    const serverClient = new QueryClient();
    serverClient.setQueryData(['hydrated'], 'server data');
    const state = dehydrate(serverClient.getCache());

    const { wrapper } = createWrapper(client);

    renderHook(
      () => useQuery({
        queryKey: ['hydrated'],
        queryFn: async () => 'client data',
        enabled: false,
      }),
      { wrapper: ({ children }: { children: React.ReactNode }) => (
        <SoulCacheProvider client={client}>
          <HydrationBoundary state={state}>
            {children}
          </HydrationBoundary>
        </SoulCacheProvider>
      ) },
    );

    await waitFor(() => {
      const data = client.getQueryData<string>(['hydrated']);
      expect(data).toBe('server data');
    });
  });

  it('renders children', () => {
    const state = dehydrate(new QueryClient().getCache());

    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () => ({ mounted: true }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <SoulCacheProvider client={client}>
            <HydrationBoundary state={state}>
              {children}
            </HydrationBoundary>
          </SoulCacheProvider>
        ),
      },
    );

    expect(result.current.mounted).toBe(true);
  });

  it('skips hydration for empty state', async () => {
    const emptyState = { version: 0, timestamp: Date.now(), queries: [] };

    const { wrapper } = createWrapper(client);

    renderHook(
      () => useQuery({
        queryKey: ['empty-hydration'],
        queryFn: async () => 'fresh',
        enabled: false,
      }),
      { wrapper: ({ children }: { children: React.ReactNode }) => (
        <SoulCacheProvider client={client}>
          <HydrationBoundary state={emptyState}>
            {children}
          </HydrationBoundary>
        </SoulCacheProvider>
      ) },
    );

    const data = client.getQueryData<string>(['empty-hydration']);
    expect(data).toBeUndefined();
  });
});
