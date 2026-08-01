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

describe('no internal setState after unmount', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('1. mutate success after unmount does not warn', async () => {
    let resolveFn!: (value: string) => void;
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn }), { wrapper });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    await act(async () => {
      resolveFn('done');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mutationFn).toHaveBeenCalled();
  });

  it('2. mutate error after unmount does not warn', async () => {
    let rejectFn!: (error: Error) => void;
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn }), { wrapper });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    await act(async () => {
      rejectFn(new Error('fail'));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mutationFn).toHaveBeenCalled();
  });

  it('3. mutateAsync success after unmount', async () => {
    let resolveFn!: (value: string) => void;
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn }), { wrapper });

    // Capture the promise before unmount
    const promise = result.current.mutateAsync(undefined as never);
    unmount();

    await act(async () => {
      resolveFn('done');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mutationFn).toHaveBeenCalled();
  });

  it('4. mutateAsync error after unmount', async () => {
    let rejectFn!: (error: Error) => void;
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn }), { wrapper });

    // Capture the promise before unmount and suppress unhandled rejection
    const promise = result.current.mutateAsync(undefined as never);
    promise.catch(() => {}); // Prevent unhandled rejection
    unmount();

    await act(async () => {
      rejectFn(new Error('fail'));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mutationFn).toHaveBeenCalled();
  });

  it('5. onSuccess still fires after unmount', async () => {
    let resolveFn!: (value: string) => void;
    const onSuccess = vi.fn();
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn, onSuccess }), {
      wrapper,
    });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    await act(async () => {
      resolveFn('done');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onSuccess).toHaveBeenCalledWith('done', undefined, undefined);
  });

  it('6. onError still fires after unmount', async () => {
    let rejectFn!: (error: Error) => void;
    const onError = vi.fn();
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectFn = reject;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn, onError }), { wrapper });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    const error = new Error('fail');
    await act(async () => {
      rejectFn(error);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onError).toHaveBeenCalledWith(error, undefined, undefined);
  });

  it('7. onSettled still fires after unmount', async () => {
    let resolveFn!: (value: string) => void;
    const onSettled = vi.fn();
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn, onSettled }), {
      wrapper,
    });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    await act(async () => {
      resolveFn('done');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(onSettled).toHaveBeenCalledWith('done', null, undefined, undefined);
  });

  it('8. mounted component still updates normally', async () => {
    const mutationFn = vi.fn(async () => 'done');

    const { result } = renderHook(() => useMutation({ mutationFn }), { wrapper });

    expect(result.current.isIdle).toBe(true);

    act(() => {
      result.current.mutate(undefined as never);
    });

    await new Promise((r) => setTimeout(r, 200));

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('done');
    expect(result.current.isSuccess).toBe(true);
  });

  it('9. StrictMode produces no React warning', async () => {
    let resolveFn!: (value: string) => void;
    const mutationFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMutation({ mutationFn }), {
      wrapper: ({ children }) => (
        <React.StrictMode>
          <SoulCacheProvider client={new QueryClient()}>{children}</SoulCacheProvider>
        </React.StrictMode>
      ),
    });

    act(() => {
      result.current.mutate(undefined as never);
    });

    unmount();

    await act(async () => {
      resolveFn('done');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mutationFn).toHaveBeenCalled();
  });
});
