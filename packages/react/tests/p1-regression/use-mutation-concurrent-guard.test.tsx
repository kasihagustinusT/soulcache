import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SoulCacheProvider } from '../../src/context';
import { useMutation } from '../../src/use-mutation';
import { QueryClient } from '@soulcache/core';

function createWrapper() {
  const client = new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SoulCacheProvider, { client }, children);
  };
}

/**
 * useMutation stale ref concurrency guard.
 *
 * stateRef.current only updates on re-render. Two rapid mutate() calls
 * both read stale stateRef, bypassing the concurrency guard. isPendingRef
 * is updated synchronously to prevent this.
 */
describe('useMutation concurrent call guard', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('second rapid mutate() call is rejected when first is in flight', async () => {
    let resolveFirst: (v: string) => void;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (vars: string) => {
            if (vars === 'first') {
              return new Promise<string>((resolve) => {
                resolveFirst = resolve;
              });
            }
            return Promise.resolve(vars);
          },
        }),
      { wrapper },
    );

    // First call — starts pending
    act(() => {
      result.current.mutate('first');
    });
    expect(result.current.status).toBe('pending');

    // Second call immediately — should be a no-op
    act(() => {
      result.current.mutate('second');
    });

    // Status should still be pending (from first call), not reset
    expect(result.current.status).toBe('pending');

    // Complete the first mutation
    await act(async () => {
      resolveFirst!('done');
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('done');
  });

  it('mutateAsync second call returns rejected promise', async () => {
    let resolveFirst: (v: string) => void;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (vars: string) => {
            if (vars === 'first') {
              return new Promise<string>((resolve) => {
                resolveFirst = resolve;
              });
            }
            return Promise.resolve(vars);
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutateAsync('first').catch(() => {});
    });
    expect(result.current.status).toBe('pending');

    // Second call should be rejected immediately
    let secondError: string | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync('second');
      } catch (e: any) {
        secondError = e.message;
      }
    });

    expect(secondError).toBe('Mutation already in progress');

    // Complete first
    await act(async () => {
      resolveFirst!('done');
      await new Promise((r) => setTimeout(r, 20));
    });
  });

  it('reset clears isPendingRef so new mutations can start', async () => {
    let resolveFirst: (v: string) => void;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (vars: string) => {
            if (vars === 'first') {
              return new Promise<string>((resolve) => {
                resolveFirst = resolve;
              });
            }
            return Promise.resolve(vars);
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate('first');
    });
    expect(result.current.status).toBe('pending');

    // Reset while pending
    act(() => {
      result.current.reset();
    });

    // The first mutation's promise should have been rejected
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // Now a new mutation should be allowed
    act(() => {
      result.current.mutate('second');
    });
    expect(result.current.status).toBe('pending');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('second');
  });
});
