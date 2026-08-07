#!/usr/bin/env node

/**
 * SoulCache Bug Verification Suite
 *
 * Standalone regression suite that verifies the audited bug fixes against the
 * built distribution (each package's dist folder). Runs without vitest:
 *
 *   pnpm build
 *   node --test tests/test-bug-verification-suite.mjs
 *
 * Covers: BC1 (checksum algorithm superset), BC2/BC3 (markStale/isStale
 * shims), fetch-status reset on error path, cache round-trip, observer
 * lifecycle, and JSON persistence round-trip.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../packages/core/dist/index.js';

const persistedState = () => ({
  version: 1,
  timestamp: Date.now(),
  queryCache: { entries: {} },
  mutationCache: { entries: {} },
  metadata: {},
});

test('BC1: legacy checksum algorithm labels are accepted by the deserializer', () => {
  const serializer = core.createJsonSerializer({ checksum: { algorithm: 'fast-32' } });
  const { serialized, checksum } = serializer.serializeWithChecksum(persistedState());

  assert.ok(checksum, 'checksum present');
  const deserializer = core.createJsonDeserializer();
  const state = deserializer.deserializeWithChecksum(serialized, checksum);
  assert.equal(state.version, 1);
});

test('BC1: sha-256 and fast-32 checksums round-trip', () => {
  const deserializer = core.createJsonDeserializer();
  for (const algorithm of ['sha-256', 'fast-32']) {
    const serializer = core.createJsonSerializer({ checksum: { algorithm } });
    const { serialized, checksum } = serializer.serializeWithChecksum(persistedState());
    const state = deserializer.deserializeWithChecksum(serialized, checksum);
    assert.equal(state.version, 1, `label ${algorithm} accepted`);
    if (algorithm === 'sha-256') {
      assert.match(checksum.value, /^[0-9a-f]{64}$/, 'sha-256 produces a real 64-hex digest');
    }
  }
});

test('BC1: legacy checksum labels remain readable (read-only, rejected on write)', () => {
  const deserializer = core.createJsonDeserializer();
  const serializer = core.createJsonSerializer({ checksum: { algorithm: 'fast-32' } });
  const { serialized, checksum } = serializer.serializeWithChecksum(persistedState());

  for (const algorithm of ['sha-256', 'sha-384', 'sha-512', 'md5']) {
    const labeled = { ...checksum, algorithm };
    const state = deserializer.deserializeWithChecksum(serialized, labeled);
    assert.equal(state.version, 1, `legacy label ${algorithm} readable`);
  }

  for (const algorithm of ['sha-384', 'sha-512', 'md5']) {
    assert.throws(
      () => core.createJsonSerializer({ checksum: { algorithm } }).serializeWithChecksum(persistedState()),
      /never implemented and is deprecated/,
      `legacy label ${algorithm} rejected on write`,
    );
  }
});

test('BC1: unknown algorithms are still rejected', () => {
  const serializer = core.createJsonSerializer();
  const { serialized } = serializer.serializeWithChecksum(persistedState());
  const deserializer = core.createJsonDeserializer();
  assert.throws(
    () =>
      deserializer.deserializeWithChecksum(serialized, {
        algorithm: 'bogus-64',
        value: 'deadbeef',
      }),
    /not supported/,
  );
});

test('BC2: markStale marks the entry stale and records staleAt', () => {
  const entry = new core.QueryEntry({
    queryId: 'q-1',
    queryKey: ['k'],
    keyHash: 'h',
    data: 1,
  });
  assert.equal(entry.status, 'fresh');
  entry.markStale();
  assert.equal(entry.status, 'stale');
  assert.ok(entry.staleAt, 'staleAt recorded');
});

test('BC3: isStale uses staleAt then lastFetchedAt', () => {
  const entry = new core.QueryEntry({
    queryId: 'q-1',
    queryKey: ['k'],
    keyHash: 'h',
    data: 1,
  });
  entry.staleAt = new Date(Date.now() - 5000).toISOString();
  assert.equal(entry.isStale(1000), true);
  assert.equal(entry.isStale(50_000), false);

  entry.staleAt = null;
  entry.lastFetchedAt = Date.now() - 10_000;
  assert.equal(entry.isStale(5000), true);
  assert.equal(entry.isStale(50_000), false);
});

test('cache: set/get round-trip and invalidation', () => {
  const engine = new core.CacheEngine();
  engine.set({ queryKey: ['todos'], data: { id: 1 } });
  const entry = engine.get(['todos']);
  assert.deepEqual(entry.data, { id: 1 });
  assert.equal(engine.size, 1);
  engine.invalidate(['todos']);
  assert.equal(engine.get(['todos']).state, 'invalidated');
});

test('client: fetchStatus resets to idle after an error', async () => {
  const client = new core.QueryClient();
  await assert.rejects(
    () =>
      client.fetchQuery({
        queryKey: ['h', 'err'],
        queryFn: async () => {
          throw new Error('boom');
        },
      }),
    /boom/,
  );
  const snapshot = client.getQuerySnapshot(['h', 'err']);
  assert.equal(snapshot.status, 'error');
  assert.equal(snapshot.fetchStatus, 'idle');
});

test('client: fetchQuery resolves data on success', async () => {
  const client = new core.QueryClient();
  const data = await client.fetchQuery({
    queryKey: ['h', 'ok'],
    queryFn: async () => ({ ok: true }),
  });
  assert.deepEqual(data, { ok: true });
  const snapshot = client.getQuerySnapshot(['h', 'ok']);
  assert.equal(snapshot.status, 'success');
  assert.equal(snapshot.fetchStatus, 'idle');
});

test('observer: subscribe/unsubscribe lifecycle cleans up listeners', () => {
  const observer = new core.QueryObserver({ queryId: 'q', queryKey: ['k'], onUpdate: () => {} });
  const unsub = observer.subscribe(() => {});
  assert.equal(observer.listenerCount, 1);
  unsub();
  assert.equal(observer.listenerCount, 0);
  assert.equal(observer.isDestroyed, false);
});

test('storage: JSON persistence round-trip with checksum', () => {
  const serializer = core.createJsonSerializer({ checksum: { algorithm: 'fast-32' } });
  const state = persistedState();
  const { serialized, checksum } = serializer.serializeWithChecksum(state);
  assert.equal(typeof serialized, 'string');
  assert.equal(checksum.algorithm, 'fast-32');
  const deserializer = core.createJsonDeserializer();
  const back = deserializer.deserializeWithChecksum(serialized, checksum);
  assert.equal(back.version, state.version);
});
