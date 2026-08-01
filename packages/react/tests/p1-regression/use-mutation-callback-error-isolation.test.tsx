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
 * useMutation callback throw cascade.
 *
 * If onSuccess/onSettled throws, the rejection must NOT propagate to .catch(),
 * which would incorrectly trigger onError and set mutation status to error.
 * Callback exceptions must not mutate the already-established mutation state.
 */
describe('useMutation callback throw cascade', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('1. onSuccess throws → status stays success, onError NOT called, onSettled called once', async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'data',
          onSuccess: () => {
            throw new Error('onSuccess boom');
          },
          onError,
          onSettled,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('data');
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith('data', null, undefined, undefined);
  });

  it('2. onSettled throws → status stays success, onError NOT called', async () => {
    const onError = vi.fn();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'data',
          onSettled: () => {
            throw new Error('onSettled boom');
          },
          onError,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('3. mutationFn rejects → status error, onError called, onSettled called', async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw new Error('mutation failed');
          },
          onError,
          onSettled,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('mutation failed');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(undefined, expect.any(Error), undefined, undefined);
  });

  it('4. onError throws → does not crash, status remains error', async () => {
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw new Error('mutation failed');
          },
          onError: () => {
            throw new Error('onError boom');
          },
          onSettled,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error!.message).toBe('mutation failed');
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('5. mutateAsync: onSuccess throws → resolves with data, not rejects', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'async-data',
          onSuccess: () => {
            throw new Error('onSuccess boom');
          },
        }),
      { wrapper },
    );

    let resolved: string | undefined;
    let rejected: Error | undefined;

    await act(async () => {
      try {
        resolved = await result.current.mutateAsync(undefined as never);
      } catch (e) {
        rejected = e as Error;
      }
    });

    expect(resolved).toBe('async-data');
    expect(rejected).toBeUndefined();
    expect(result.current.status).toBe('success');
  });
});
