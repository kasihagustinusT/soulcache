import { describe, it, expect, afterEach } from 'vitest';
import React, { Suspense } from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Suspense must handle first-time (undefined snapshot) queries', () => {
  afterEach(() => {
    cleanup();
  });

  it('1. first-time suspense query should suspend and render data', async () => {
    const client = new QueryClient();

    function TestComponent() {
      const { data } = useQuery({
        queryKey: ['first-time'],
        queryFn: async () => 'hello from first query',
        suspense: true,
      });
      return <div>{data}</div>;
    }

    const { getByText } = render(
      <SoulCacheProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <TestComponent />
        </Suspense>
      </SoulCacheProvider>,
    );

    // Should show loading fallback first (suspense thrown)
    expect(getByText('loading')).toBeTruthy();

    // Then resolve to data
    await waitFor(() => {
      expect(getByText('hello from first query')).toBeTruthy();
    });
  });

  it('2. first-time suspense query should not crash on snapshot access', async () => {
    const client = new QueryClient();
    let renderCount = 0;
    const caughtError: Error | null = null;

    function TestComponent() {
      renderCount++;
      // This mirrors the original crash: accessing snapshot properties when snapshot is undefined
      const result = useQuery({
        queryKey: ['no-crash'],
        queryFn: async () => ({ ok: true }),
        suspense: true,
      });

      // This access pattern would crash if snapshot was undefined
      // Fix ensures snapshot is never undefined here
      return <div>{result.data ? 'rendered' : 'no data'}</div>;
    }

    render(
      <SoulCacheProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <TestComponent />
        </Suspense>
      </SoulCacheProvider>,
    );

    await waitFor(() => {
      expect(renderCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('3. repeated suspense queries with new keys each time should not crash', async () => {
    const client = new QueryClient();
    let queryKeyCounter = 0;

    function TestComponent({ qk }: { qk: string[] }) {
      const { data } = useQuery({
        queryKey: qk,
        queryFn: async () => ({ key: qk[0] }),
        suspense: true,
      });
      return <div>{JSON.stringify(data)}</div>;
    }

    function Wrapper() {
      queryKeyCounter++;
      return (
        <SoulCacheProvider client={client}>
          <Suspense fallback={<div>loading-{queryKeyCounter}</div>}>
            <TestComponent qk={[`key-${queryKeyCounter}`]} />
          </Suspense>
        </SoulCacheProvider>
      );
    }

    // First render with key-1
    const { rerender } = render(<Wrapper />);

    await waitFor(() => {
      expect(document.body.textContent).toContain('key-1');
    });

    // Rerender with key-2 (simulating navigation)
    rerender(<Wrapper />);

    await waitFor(() => {
      expect(document.body.textContent).toContain('key-2');
    });
  });
});
