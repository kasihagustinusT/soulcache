import { describe, it, expect, afterEach } from 'vitest';
import React, { Suspense } from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Suspense throw must not produce unhandled rejections', () => {
  afterEach(() => {
    cleanup();
  });
  it('1. suspense catch mechanism: .catch(() => {}) resolves with original value on success', async () => {
    // Verify the fix mechanism in isolation:
    // client.fetchQuery returns a promise.
    // .catch(() => {}) creates a new promise that resolves with the original value
    // when the original resolves.
    const original = Promise.resolve('data');
    const caught = original.catch(() => {});
    const result = await caught;
    expect(result).toBe('data');
  });

  it('2. suspense catch mechanism: .catch(() => {}) resolves with undefined on rejection', async () => {
    // When the original rejects, .catch(() => {}) swallows and resolves with undefined.
    // This prevents unhandled rejection while allowing React to re-render.
    const original = Promise.reject(new Error('fail'));
    const caught = original.catch(() => {});
    const result = await caught;
    expect(result).toBeUndefined();
  });

  it('3. suspense with successful fetch renders data', async () => {
    const client = new QueryClient();

    function TestComponent() {
      const { data } = useQuery({
        queryKey: ['ok'],
        queryFn: async () => 'hello',
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

    await waitFor(() => {
      expect(getByText('hello')).toBeTruthy();
    });
  });

  it('4. suspense with failing fetch shows error via snapshot state', async () => {
    const client = new QueryClient();
    let rejectFetch!: (e: Error) => void;
    const failPromise = new Promise<never>((_, reject) => {
      rejectFetch = reject;
    });

    let hasError = false;

    function TestComponent() {
      const result = useQuery({
        queryKey: ['fail-snap'],
        queryFn: () => failPromise,
        suspense: true,
      });
      hasError = result.isError;
      return <div>{result.error?.message ?? 'no error'}</div>;
    }

    render(
      <SoulCacheProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <TestComponent />
        </Suspense>
      </SoulCacheProvider>,
    );

    // Reject the fetch
    await act(async () => {
      rejectFetch(new Error('network error'));
      await new Promise((r) => setTimeout(r, 100));
    });

    // After .catch() swallows rejection, React re-renders with error snapshot
    await waitFor(() => {
      expect(hasError).toBe(true);
    });
  });

  it('5. unhandledrejection listener detects no spurious rejections', async () => {
    const unhandled: unknown[] = [];

    const handler = (e: PromiseRejectionEvent) => {
      unhandled.push(e.reason);
      e.preventDefault();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handler);
    }

    const client = new QueryClient();
    let rejectFetch!: (e: Error) => void;
    const failPromise = new Promise<never>((_, reject) => {
      rejectFetch = reject;
    });

    function TestComponent() {
      useQuery({
        queryKey: ['unhandled'],
        queryFn: () => failPromise,
        suspense: true,
      });
      return <div />;
    }

    const { unmount } = render(
      <SoulCacheProvider client={client}>
        <Suspense fallback={<div>loading</div>}>
          <TestComponent />
        </Suspense>
      </SoulCacheProvider>,
    );

    // Reject and unmount before it settles
    await act(async () => {
      rejectFetch(new Error('boom'));
      await new Promise((r) => setTimeout(r, 50));
    });

    unmount();

    // Wait for any async rejection to propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    // No unhandled rejections should have been detected
    expect(unhandled).toHaveLength(0);

    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', handler);
    }
  });
});
