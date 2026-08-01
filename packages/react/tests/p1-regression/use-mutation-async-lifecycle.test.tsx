import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useMutation } from '../../src/use-mutation';

function createWrapper(client?: QueryClient) {
  const qc = client ?? new QueryClient();
  return {
    client: qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <SoulCacheProvider client={qc}>{children}</SoulCacheProvider>
    ),
  };
}

describe('mutateAsync updates hook state and fires callbacks', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('mutateAsync transitions state: idle → pending → success', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => {
            await new Promise((r) => setTimeout(r, 50));
            return `created: ${vars}`;
          },
        }),
      { wrapper },
    );

    expect(result.current.status).toBe('idle');

    let promise: Promise<string>;
    act(() => {
      promise = result.current.mutateAsync('Alice');
    });

    // Should be pending
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });
    expect(result.current.status).toBe('pending');

    await act(async () => {
      await promise!;
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.status).toBe('success');
  });

  it('mutateAsync transitions state: idle → pending → error', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (_vars: void) => {
            throw new Error('mutation failed');
          },
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (_e) {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('mutation failed');
  });

  it('mutateAsync updates data on success', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => `result: ${vars}`,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync('test');
    });

    await waitFor(() => {
      expect(result.current.data).toBe('result: test');
    });
  });

  it('mutateAsync updates error on failure', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (_vars: void) => {
            throw new Error('fail');
          },
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (_e) {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.error?.message).toBe('fail');
  });

  it('mutateAsync calls onSuccess callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackData: string | undefined;
    let callbackVars: string | undefined;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => `ok: ${vars}`,
          onSuccess: (data, vars) => {
            callbackData = data;
            callbackVars = vars;
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync('hello');
    });

    await waitFor(() => {
      expect(callbackData).toBe('ok: hello');
    });
    expect(callbackVars).toBe('hello');
  });

  it('mutateAsync calls onError callback', async () => {
    const { wrapper } = createWrapper(client);
    let callbackError: Error | undefined;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (_vars: void) => {
            throw new Error('cb err');
          },
          onError: (err) => {
            callbackError = err;
          },
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (_e) {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(callbackError?.message).toBe('cb err');
    });
  });

  it('mutateAsync calls onSettled callback on success', async () => {
    const { wrapper } = createWrapper(client);
    let settledData: string | undefined;
    let settledError: Error | null | undefined;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => vars,
          onSettled: (data, error) => {
            settledData = data;
            settledError = error;
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync('done');
    });

    await waitFor(() => {
      expect(settledData).toBe('done');
    });
    expect(settledError).toBeNull();
  });

  it('mutateAsync calls onSettled callback on error', async () => {
    const { wrapper } = createWrapper(client);
    let settledError: Error | null | undefined;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (_vars: void) => {
            throw new Error('settled err');
          },
          onSettled: (_data, error) => {
            settledError = error;
          },
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (_e) {
        /* expected */
      }
    });

    await waitFor(() => {
      expect(settledError).toBeInstanceOf(Error);
    });
    expect(settledError?.message).toBe('settled err');
  });

  it('mutateAsync prevents concurrent mutations', async () => {
    const { wrapper } = createWrapper(client);
    let callCount = 0;

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => {
            callCount++;
            await new Promise((r) => setTimeout(r, 50));
            return vars;
          },
        }),
      { wrapper },
    );

    // First call — start the mutation
    let p1: Promise<string>;
    act(() => {
      p1 = result.current.mutateAsync('first');
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Second call while pending — should reject immediately
    let p2Rejected = false;
    await act(async () => {
      try {
        await result.current.mutateAsync('second');
      } catch (_e) {
        p2Rejected = true;
      }
    });
    expect(p2Rejected).toBe(true);

    // Only the first call should have executed
    expect(callCount).toBe(1);

    // Complete the first
    await act(async () => {
      await p1!;
    });
  });

  it('mutateAsync returns the resolved data', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: string) => `result: ${vars}`,
        }),
      { wrapper },
    );

    let returnValue: string | undefined;
    await act(async () => {
      returnValue = await result.current.mutateAsync('check');
    });

    expect(returnValue).toBe('result: check');
  });

  it('mutateAsync propagates error to caller', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (_vars: void) => {
            throw new Error('thrown');
          },
        }),
      { wrapper },
    );

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError?.message).toBe('thrown');
  });
});
