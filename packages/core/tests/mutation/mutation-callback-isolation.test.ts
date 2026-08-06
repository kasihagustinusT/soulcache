import { describe, it, expect } from 'vitest';
import { MutationEntry } from '../../src/mutation/mutation-entry';
import { MutationCache } from '../../src/mutation/mutation-cache';
import { MutationObserver } from '../../src/mutation/mutation-observer';
import { QueryClient } from '../../src/client/query-client';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Mutation callback isolation regression suite (BUG-1).
 *
 * Covers the callback-isolation contract introduced by the BUG-1 fix in
 * `MutationEntry.mutate()`:
 *  - a synchronously throwing `onSuccess`/`onSettled` must not corrupt the
 *    committed success state, must not escape `mutate()` as a rejection, and
 *    must not re-trigger `mutateWithRetry()` (no duplicate write);
 *  - a synchronously throwing `onError` must not replace the original
 *    mutation error and must not prevent `onSettled`;
 *  - an `onMutate` throw remains a mutation error (preserved behavior).
 *
 * NOTE on async callbacks: callbacks are typed `(...) => void` (synchronous).
 * A synchronously throwing callback is isolated. An `async` callback that
 * REJECTS (rather than throwing synchronously) is NOT isolated — its rejected
 * promise is orphaned (unhandled rejection). This limitation is intentional
 * (deferred beyond v1.1.0); it does not corrupt mutation state. See
 * `docs/content/docs/mutation.mdx` "Callback errors" note.
 */
describe('MutationEntry callback isolation (BUG-1)', () => {
  describe('success path', () => {
    it('A1: all callbacks throw on success — mutate resolves, state stays success', async () => {
      const entry = new MutationEntry({
        mutationId: 'a1',
        mutationFn: async () => 'ok',
        onSuccess: () => { throw new Error('s-boom'); },
        onError: () => { throw new Error('e-boom'); },
        onSettled: () => { throw new Error('st-boom'); },
      });
      await expect(entry.mutate({})).resolves.toBe('ok');
      expect(entry.status).toBe('success');
      expect(entry.error).toBeNull();
      expect(entry.data).toBe('ok');
    });

    it('A3: callback ORDER preserved on success and error paths', async () => {
      const calls: string[] = [];
      const okEntry = new MutationEntry({
        mutationId: 'a3a',
        mutationFn: async () => 'ok',
        onSuccess: () => calls.push('success'),
        onSettled: () => calls.push('settled'),
      });
      await okEntry.mutate({});
      expect(calls).toEqual(['success', 'settled']);

      const calls2: string[] = [];
      const errEntry = new MutationEntry({
        mutationId: 'a3b',
        mutationFn: async () => { throw new Error('x'); },
        onError: () => calls2.push('error'),
        onSettled: () => calls2.push('settled'),
      });
      await expect(errEntry.mutate({})).rejects.toThrow('x');
      expect(calls2).toEqual(['error', 'settled']);
    });

    it('A4: success state committed before onSuccess runs', async () => {
      let observedStatus = '';
      const entry = new MutationEntry({
        mutationId: 'a4',
        mutationFn: async () => 'ok',
        onSuccess: () => { observedStatus = entry.status; },
      });
      await entry.mutate({});
      expect(observedStatus).toBe('success');
    });

    it('B1: async onSuccess that resolves (no throw) is harmless; onSettled is not delayed', async () => {
      const order: string[] = [];
      const entry = new MutationEntry({
        mutationId: 'b1',
        mutationFn: async () => 'ok',
        onSuccess: async () => { await sleep(1); order.push('success'); },
        onSettled: () => order.push('settled'),
      });
      await expect(entry.mutate({})).resolves.toBe('ok');
      expect(entry.status).toBe('success');
      // Callbacks are not awaited: a resolving async onSuccess must not delay
      // onSettled, corrupt state, or affect the mutation result. 'settled' runs
      // first; the async continuation eventually fires too.
      expect(order[0]).toBe('settled');
      await sleep(10);
      expect(order).toEqual(['settled', 'success']);
    });

    it('B2: throwing onSuccess does not affect a subsequent mutate call', async () => {
      let calls = 0;
      const entry = new MutationEntry({
        mutationId: 'b2',
        mutationFn: async (v: number) => { calls++; return v * 2; },
        onSuccess: () => { throw new Error('boom'); },
      });
      await expect(entry.mutate(2)).resolves.toBe(4);
      await expect(entry.mutate(5)).resolves.toBe(10);
      expect(calls).toBe(2);
      expect(entry.status).toBe('success');
      expect(entry.data).toBe(10);
    });
  });

  describe('error path', () => {
    it('A2: all callbacks throw on error — original error propagates, state stays error', async () => {
      const entry = new MutationEntry({
        mutationId: 'a2',
        mutationFn: async () => { throw new Error('real-fail'); },
        onSuccess: () => { throw new Error('s-boom'); },
        onError: () => { throw new Error('e-boom'); },
        onSettled: () => { throw new Error('st-boom'); },
      });
      let thrown: unknown;
      try { await entry.mutate({}); } catch (e) { thrown = e; }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('real-fail');
      expect(entry.status).toBe('error');
      expect(entry.error?.message).toBe('real-fail');
    });

    it('A14: non-Error mutation rejection is normalized to Error before callbacks', async () => {
      const entry = new MutationEntry({
        mutationId: 'a14',
        mutationFn: async () => { throw 'plain-string-failure'; },
        onError: (e) => { expect(e).toBeInstanceOf(Error); },
      });
      await expect(entry.mutate({})).rejects.toBeInstanceOf(Error);
    });

    it('A15: onMutate throw is a mutation error; onSuccess NOT called; onError then onSettled run', async () => {
      const order: string[] = [];
      const entry = new MutationEntry({
        mutationId: 'a15',
        mutationFn: async () => { order.push('fn'); return 'ok'; },
        onMutate: () => { throw new Error('optimistic-boom'); },
        onSuccess: () => { order.push('success'); },
        onError: () => { order.push('error'); },
        onSettled: () => { order.push('settled'); },
      });
      await expect(entry.mutate({})).rejects.toThrow('optimistic-boom');
      expect(order).toEqual(['error', 'settled']); // mutationFn never ran
      expect(entry.status).toBe('error');
    });
  });

  describe('retry interaction', () => {
    it('A8: mutateWithRetry — real failure still retries despite throwing onError/onSettled', async () => {
      let attempts = 0;
      const entry = new MutationEntry({
        mutationId: 'a8',
        mutationFn: async () => { attempts++; throw new Error('network'); },
        onError: () => { throw new Error('cb-boom'); },
        onSettled: () => { throw new Error('st-boom'); },
      });
      await expect(entry.mutateWithRetry({}, 2, 5)).rejects.toThrow('network');
      expect(attempts).toBe(3); // 1 + 2 retries
      expect(entry.error?.message).toBe('network');
    });

    it('A16: same-millisecond retry storm — maxRetries 0 executes exactly once', async () => {
      let attempts = 0;
      const entry = new MutationEntry({
        mutationId: 'a16',
        mutationFn: async () => { attempts++; throw new Error('x'); },
      });
      await expect(entry.mutateWithRetry({}, 0, 0)).rejects.toThrow('x');
      expect(attempts).toBe(1);
    });

    it('A19: throwing onError does not prevent retry loop from continuing (recovers on retry)', async () => {
      let attempts = 0;
      const entry = new MutationEntry({
        mutationId: 'a19',
        mutationFn: async () => {
          attempts++;
          if (attempts === 1) throw new Error('first-fail');
          return 'recovered';
        },
        onError: () => { throw new Error('cb-boom'); },
      });
      await expect(entry.mutateWithRetry({}, 1, 5)).resolves.toBe('recovered');
      expect(attempts).toBe(2);
      expect(entry.status).toBe('success');
    });
  });

  describe('cancellation and concurrency', () => {
    it('A6: cancel during in-flight — rejects Mutation cancelled, no error/settled callbacks (pre-existing)', async () => {
      let errorCalls = 0;
      let settledCalls = 0;
      const entry = new MutationEntry({
        mutationId: 'a6',
        mutationFn: async () => { await sleep(100); return 'done'; },
        onError: () => { errorCalls++; },
        onSettled: () => { settledCalls++; },
      });
      const p = entry.mutate({});
      await sleep(5);
      entry.cancel();
      await expect(p).rejects.toThrow('Mutation cancelled');
      expect(errorCalls).toBe(0);
      expect(settledCalls).toBe(0);
    });

    it('A7: two concurrent mutate calls — latest wins, first cancelled, no corruption', async () => {
      const entry = new MutationEntry({
        mutationId: 'a7',
        mutationFn: async (v: string) => { await sleep(v === 'slow' ? 60 : 5); return v; },
      });
      const p1 = entry.mutate('slow');
      // Pre-attach a rejection handler: the second mutate cancels the first via
      // cancel(), whose 'Mutation cancelled' rejection can otherwise be
      // momentarily unhandled (pre-existing cancel-delivery footgun).
      p1.catch(() => {});
      await sleep(10);
      const p2 = entry.mutate('fast');
      await expect(p2).resolves.toBe('fast');
      await expect(p1).rejects.toThrow('Mutation cancelled');
      expect(entry.status).toBe('success');
      expect(entry.data).toBe('fast');
    });

    it('B3: cancel() during onSuccess — committed data returned; no crash', async () => {
      const entry = new MutationEntry({
        mutationId: 'b3',
        mutationFn: async () => 'ok',
        onSuccess: () => { entry.cancel(); },
      });
      const result = await entry.mutate({});
      expect(result).toBe('ok');
      expect(entry.error?.message).toBe('Mutation cancelled');
    });
  });

  describe('lifecycle reentrancy from callbacks', () => {
    it('A5: bounded reentrant mutate from onSuccess does not corrupt state', async () => {
      let nested = 0;
      const entry = new MutationEntry({
        mutationId: 'a5',
        mutationFn: async (v: string) => `outer-${v}`,
        onSuccess: () => {
          // Reentrant mutate from a callback (guarded to one level): the library
          // must not corrupt state or crash. Unbounded reentrancy is user error.
          if (nested === 0) {
            nested++;
            void entry.mutate('inner');
          }
        },
      });
      await expect(entry.mutate('outer')).resolves.toBe('outer-outer');
      await sleep(20);
      expect(entry.data).toBe('outer-inner');
      expect(entry.status).toBe('success');
    });

    it('A12: destroy() from inside onSuccess — no crash, next mutate rejects', async () => {
      const entry = new MutationEntry({
        mutationId: 'a12',
        mutationFn: async () => 'ok',
        onSuccess: () => { entry.destroy(); },
      });
      await expect(entry.mutate({})).resolves.toBe('ok');
      await expect(entry.mutate({})).rejects.toThrow('MutationEntry has been destroyed');
    });

    it('A13: reset() from inside onSuccess — no crash, committed data returned', async () => {
      const entry = new MutationEntry({
        mutationId: 'a13',
        mutationFn: async () => 'ok',
        onSuccess: () => { entry.reset(); },
      });
      const result = await entry.mutate({});
      expect(result).toBe('ok');
      expect(entry.status).toBe('idle'); // reset won after commit
    });

    it('B4: cache mutation (setQueryData) from onSuccess during QueryClient flow', async () => {
      const client = new QueryClient({});
      const result = await client.mutate<string, { name: string }>({
        mutationId: 'b4',
        mutationFn: async (v) => `hello-${v.name}`,
        variables: { name: 'alice' },
        onSuccess: () => {
          client.setQueryData(['greeting'], 'cached');
        },
      });
      expect(result).toBe('hello-alice');
      expect(client.getQueryData(['greeting'])).toBe('cached');
    });
  });

  describe('observers and listeners', () => {
    it('A11: listener that throws is isolated; other listeners still notified (pre-existing)', async () => {
      const entry = new MutationEntry({ mutationId: 'a11', mutationFn: async () => 'ok' });
      const notified: string[] = [];
      entry.subscribe(() => { notified.push('l1'); });
      entry.subscribe(() => { throw new Error('listener-boom'); });
      entry.subscribe(() => { notified.push('l3'); });
      await entry.mutate({});
      // notifyListeners fires for pending + success; the throwing listener never
      // blocks l1/l3 and never crashes the runtime.
      expect(notified).toEqual(['l1', 'l3', 'l1', 'l3']);
    });

    it('B5: MutationObserver reflects correct final snapshot with throwing callback', async () => {
      const entry = new MutationEntry({
        mutationId: 'b5',
        mutationFn: async () => 'obs-ok',
        onSuccess: () => { throw new Error('boom'); },
      });
      const observer = new MutationObserver({ mutationId: 'b5' });
      observer.bind(entry);
      const p = entry.mutate({});
      await p;
      await sleep(5);
      const snap = observer.getSnapshot();
      expect(snap.status).toBe('success');
      expect(snap.data).toBe('obs-ok');
      expect(snap.error).toBeNull();
      observer.destroy();
    });

    it('A17: callback executed exactly once per mutate (no double-fire)', async () => {
      let successCalls = 0;
      let settledCalls = 0;
      const entry = new MutationEntry({
        mutationId: 'a17',
        mutationFn: async () => { await sleep(1); return 'ok'; },
        onSuccess: () => { successCalls++; },
        onSettled: () => { settledCalls++; },
      });
      await entry.mutate({});
      expect(successCalls).toBe(1);
      expect(settledCalls).toBe(1);
    });
  });

  describe('QueryClient and MutationCache integration', () => {
    it('A9: QueryClient.mutate — throwing onSuccess still resolves; cache entry is success', async () => {
      const client = new QueryClient({});
      const result = await client.mutate<string, void>({
        mutationId: 'a9',
        mutationFn: async () => 'client-ok',
        variables: undefined,
        onSuccess: () => { throw new Error('cb-boom'); },
        onSettled: () => { throw new Error('st-boom'); },
      });
      expect(result).toBe('client-ok');
      const found = client.getMutationCache().findAll({ status: 'success' });
      expect(found.some((m) => m.id === 'a9')).toBe(true);
      expect(found.find((m) => m.id === 'a9')?.data).toBe('client-ok');
    });

    it('A10: MutationCache — throwing callbacks do not leak entries or break eviction', async () => {
      const cache = new MutationCache({ maxSize: 2 });
      cache.create({ mutationId: 'm1', mutationFn: async () => 'a', onSuccess: () => { throw new Error('x'); } });
      cache.create({ mutationId: 'm2', mutationFn: async () => 'b', onSettled: () => { throw new Error('y'); } });
      cache.create({ mutationId: 'm3', mutationFn: async () => 'c' });
      expect(cache.size).toBe(2); // m1 evicted
      expect(cache.get('m1')).toBeUndefined();
      expect(cache.get('m2')?.id).toBe('m2');
      expect(cache.get('m3')?.id).toBe('m3');
    });

    it('B6: QueryClient.mutate failure with throwing onError/onSettled propagates original error', async () => {
      const client = new QueryClient({});
      let thrown: unknown;
      try {
        await client.mutate<string, void>({
          mutationId: 'b6',
          mutationFn: async () => { throw new Error('origin-fail'); },
          variables: undefined,
          onError: () => { throw new Error('cb-boom'); },
          onSettled: () => { throw new Error('st-boom'); },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('origin-fail');
      const found = client.getMutationCache().findAll({ status: 'error' });
      expect(found.find((m) => m.id === 'b6')?.error?.message).toBe('origin-fail');
    });
  });
});
