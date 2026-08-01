import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MutationEntry } from '../../src/mutation/mutation-entry';

describe('Mutation AbortController identity', () => {
  it('cancelled mutation does not call onError as ordinary failure', async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();

    const entry = new MutationEntry({
      mutationId: 'new-12-cancel',
      mutationFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'data';
      },
      onError,
      onSettled,
    });

    // Start first mutation
    const p1 = entry.mutate('vars1');

    // Immediately start second (cancels first)
    const p2 = entry.mutate('vars2');

    // Catch rejections so they don't become unhandled
    p1.catch(() => {});

    await p2;

    // Cancelled mutation should NOT trigger onError
    expect(onError).not.toHaveBeenCalled();
    // onSettled called once for the successful second mutation, NOT for the cancelled first
    expect(onSettled).toHaveBeenCalledOnce();
    expect(onSettled.mock.calls[0][2]).toBe('vars2');
  });

  it('overlapping mutations: old mutation settles without corrupting new', async () => {
    const order: string[] = [];

    const entry = new MutationEntry({
      mutationId: 'new-12-overlap',
      mutationFn: async (vars: string) => {
        if (vars === 'slow') {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        order.push(`resolve-${vars}`);
        return vars;
      },
    });

    const p1 = entry.mutate('slow');
    p1.catch(() => {});

    const p2 = entry.mutate('fast');
    await p2;

    // Only fast should have resolved
    expect(order).toContain('resolve-fast');
    expect(order).not.toContain('resolve-slow');
  });

  it('single mutation success: no behavior change', async () => {
    const entry = new MutationEntry({
      mutationId: 'new-12-single',
      mutationFn: async () => 'result',
    });

    const result = await entry.mutate('vars');
    expect(result).toBe('result');
  });

  it('single mutation error: error callback fires', async () => {
    const onError = vi.fn();

    const entry = new MutationEntry({
      mutationId: 'new-12-error',
      mutationFn: async () => {
        throw new Error('mutation error');
      },
      onError,
    });

    try {
      await entry.mutate('vars');
    } catch {
      // expected
    }

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe('mutation error');
  });
});
