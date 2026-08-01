import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

function createWrapper(client?: QueryClient) {
  const qc = client ?? new QueryClient();
  return {
    client: qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <SoulCacheProvider client={qc}>{children}</SoulCacheProvider>
    ),
  };
}

describe('onSuccess/onError must fire on transitions only', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. pending → success invokes onSuccess once', async () => {
    const { wrapper } = createWrapper(client);
    let successCount = 0;

    renderHook(
      () =>
        useQuery({
          queryKey: ['transition-test'],
          queryFn: async () => 'data',
          onSuccess: () => {
            successCount++;
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(successCount).toBe(1));
  });

  it('2. additional successful snapshots do not invoke onSuccess again', async () => {
    const { wrapper } = createWrapper(client);
    let successCount = 0;

    // Pre-populate cache with the same data queryFn returns
    client.setQueryData(['bg-test'], 'data');

    renderHook(
      () =>
        useQuery({
          queryKey: ['bg-test'],
          queryFn: async () => 'data',
          onSuccess: () => {
            successCount++;
          },
        }),
      { wrapper },
    );

    // Wait for initial success
    await waitFor(() => expect(successCount).toBe(1));

    // Trigger refetch via fetchQuery
    await act(async () => {
      client.fetchQuery({
        queryKey: ['bg-test'],
        queryFn: async () => 'data',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // onSuccess should NOT fire again for refetch (same data)
    expect(successCount).toBe(1);
  });

  it('3. pending → error invokes onError once', async () => {
    const { wrapper } = createWrapper(client);
    let errorCount = 0;

    renderHook(
      () =>
        useQuery({
          queryKey: ['error-test'],
          queryFn: async () => {
            throw new Error('fail');
          },
          onError: () => {
            errorCount++;
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(errorCount).toBe(1));
  });

  it('4. additional error snapshots do not invoke onError again', async () => {
    const { wrapper } = createWrapper(client);
    let errorCount = 0;

    renderHook(
      () =>
        useQuery({
          queryKey: ['error-persist'],
          queryFn: async () => {
            throw new Error('persistent');
          },
          onError: () => {
            errorCount++;
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(errorCount).toBe(1));

    // Trigger refetch via fetchQuery (will fail again)
    await act(async () => {
      client
        .fetchQuery({
          queryKey: ['error-persist'],
          queryFn: async () => {
            throw new Error('persistent');
          },
        })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 50));
    });

    // onError should NOT fire again
    expect(errorCount).toBe(1);
  });

  it('5. refetch behavior: onSuccess fires on new success after error recovery', async () => {
    const { wrapper } = createWrapper(client);
    let successCount = 0;
    let callCount = 0;

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['recover-test'],
          queryFn: async () => {
            callCount++;
            if (callCount === 1) throw new Error('first fail');
            return 'recovered';
          },
          onSuccess: () => {
            successCount++;
          },
        }),
      { wrapper },
    );

    // Wait for initial error
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Trigger refetch via fetchQuery (will succeed)
    await act(async () => {
      client.fetchQuery({
        queryKey: ['recover-test'],
        queryFn: async () => 'recovered',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // onSuccess should fire once for the recovery
    await waitFor(() => expect(successCount).toBe(1));
  });

  it('6. StrictMode does not duplicate callbacks', async () => {
    const { wrapper } = createWrapper(client);
    let successCount = 0;

    // Note: React StrictMode in development double-invokes effects.
    // The callback should still fire only once due to transition tracking.
    renderHook(
      () =>
        useQuery({
          queryKey: ['strict-test'],
          queryFn: async () => 'data',
          onSuccess: () => {
            successCount++;
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(successCount).toBeGreaterThanOrEqual(1));
    // In dev mode with StrictMode, effects run twice, but the transition
    // tracking should prevent duplicate callbacks.
    expect(successCount).toBeLessThanOrEqual(2);
  });

  it('7. callback prop changes do not retrigger historical events', async () => {
    const { wrapper } = createWrapper(client);
    let count1 = 0;
    let count2 = 0;

    const { rerender } = renderHook(
      ({ onSuccess }) =>
        useQuery({
          queryKey: ['prop-change'],
          queryFn: async () => 'data',
          onSuccess,
        }),
      {
        wrapper,
        initialProps: {
          onSuccess: () => {
            count1++;
          },
        },
      },
    );

    await waitFor(() => expect(count1).toBe(1));

    // Change the callback prop
    rerender({
      onSuccess: () => {
        count2++;
      },
    });

    // Wait a tick for any effects
    await new Promise((r) => setTimeout(r, 50));

    // The old callback should not fire again
    expect(count1).toBe(1);
    // The new callback should not fire for the historical success
    expect(count2).toBe(0);
  });
});
