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

describe('onMutate throw must not stick mutation in pending', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
  });

  it('1. onMutate throws Error', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('onMutate failed');
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('onMutate failed');
    expect(result.current.isError).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('2. onMutate throws string', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw 'string error';
          }, // eslint-disable-line no-throw-literal
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('string error');
  });

  it('3. onMutate throws unknown value', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw { reason: 'complex' };
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('4. mutateAsync rejects when onMutate throws', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('boom');
          },
        }),
      { wrapper },
    );

    await expect(act(() => result.current.mutateAsync(undefined as never))).rejects.toThrow('boom');
  });

  it('5. mutate() resets correctly when onMutate throws', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('fail');
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.status).toBe('error');
    expect(result.current.isError).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('6. subsequent mutation succeeds after onMutate failure', async () => {
    let shouldThrow = true;
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            if (shouldThrow) throw new Error('first fail');
            return undefined;
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.status).toBe('error');

    shouldThrow = false;

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 200));

    expect(result.current.status).toBe('success');
  });

  it('7. onSuccess not called when onMutate throws', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('fail');
          },
          onSuccess,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('8. onError not called when onMutate throws (mutation never ran)', async () => {
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('fail');
          },
          onError,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(onError).not.toHaveBeenCalled();
  });

  it('9. onSettled not called when onMutate throws', async () => {
    const onSettled = vi.fn();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('fail');
          },
          onSettled,
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(onSettled).not.toHaveBeenCalled();
  });

  it('10. mutateAsync returns rejected promise when onMutate throws', async () => {
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw new Error('rejected');
          },
        }),
      { wrapper },
    );

    const promise = act(() => result.current.mutateAsync(undefined as never));
    await expect(promise).rejects.toThrow('rejected');
  });

  it('11. error preserves original error information', async () => {
    const originalError = new Error('original message');
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'ok',
          onMutate: () => {
            throw originalError;
          },
        }),
      { wrapper },
    );

    act(() => {
      result.current.mutate(undefined as never);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.error).toBe(originalError);
  });
});
