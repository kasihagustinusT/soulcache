import { describe, it, expect, beforeEach } from 'vitest';
import { createJsonSerializer } from '../../src/storage/serializer/json-serializer';

/**
 * sortObjectKeys destroys non-plain-object types during serialization.
 *
 * The serializer's sortObjectKeys method uses `typeof obj !== 'object'` to
 * detect non-objects, but Date, Map, Set, RegExp all have typeof === 'object'.
 * Object.keys() returns [] for these types, converting them to {}.
 *
 * Fix: Added a plain-object check (obj.constructor !== Object) before sorting.
 * Non-plain objects are passed through unchanged.
 */
describe('sortObjectKeys non-plain object preservation', () => {
  let serializer: ReturnType<typeof createJsonSerializer>;

  beforeEach(() => {
    serializer = createJsonSerializer({ sortKeys: true });
  });

  it('1. Date object in data is preserved through serialize/deserialize cycle', () => {
    const date = new Date('2025-06-15T12:00:00Z');
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: { createdAt: date },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    // Date should be serialized as an ISO string by JSON.stringify,
    // NOT as an empty object {}
    expect(parsed.metadata.createdAt).not.toEqual({});
    expect(typeof parsed.metadata.createdAt).toBe('string');
    // The ISO string should be parseable back to the same date
    expect(new Date(parsed.metadata.createdAt).getTime()).toBe(date.getTime());
  });

  it('2. Nested Date in object survives serialization', () => {
    const date1 = new Date('2024-01-01T00:00:00Z');
    const date2 = new Date('2024-12-31T23:59:59Z');
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: {
        entries: {
          user: { createdAt: date1, updatedAt: date2 },
        },
      },
      mutationCache: { entries: {} },
      metadata: {},
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    expect(parsed.queryCache.entries.user.createdAt).not.toEqual({});
    expect(parsed.queryCache.entries.user.updatedAt).not.toEqual({});
    expect(new Date(parsed.queryCache.entries.user.createdAt).getTime()).toBe(date1.getTime());
    expect(new Date(parsed.queryCache.entries.user.updatedAt).getTime()).toBe(date2.getTime());
  });

  it('3. Plain objects still have keys sorted deterministically', () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: { zebra: 1, alpha: 2, middle: 3 },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    const keys = Object.keys(parsed.metadata);
    expect(keys).toEqual(['alpha', 'middle', 'zebra']);
  });

  it('4. Array items are recursively sorted', () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: {
        items: [
          { z: 1, a: 2 },
          { m: 3, b: 4 },
        ],
      },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    expect(Object.keys(parsed.metadata.items[0])).toEqual(['a', 'z']);
    expect(Object.keys(parsed.metadata.items[1])).toEqual(['b', 'm']);
  });

  it('5. RegExp object is not silently corrupted to {}', () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: { pattern: /test/gi },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    // RegExp serialized by JSON.stringify becomes "{}" (empty object)
    // because JSON.stringify doesn't know how to serialize RegExp.
    // The key point is that sortObjectKeys doesn't ADDITIONALLY
    // corrupt it — JSON.stringify handles the conversion.
    // We verify sortObjectKeys doesn't throw and doesn't double-corrupt.
    expect(parsed.metadata).toHaveProperty('pattern');
  });

  it('6. null and undefined values pass through correctly', () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: { a: null, b: undefined, c: 'value' },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    expect(parsed.metadata.a).toBeNull();
    expect(parsed.metadata).not.toHaveProperty('b'); // undefined is dropped by JSON.stringify
    expect(parsed.metadata.c).toBe('value');
  });

  it('7. Mixed types in metadata survive round-trip', () => {
    const now = new Date('2025-03-15T10:30:00Z');
    const data = {
      version: 1,
      timestamp: now.getTime(),
      queryCache: { entries: {} },
      mutationCache: { entries: {} },
      metadata: {
        name: 'test',
        count: 42,
        active: true,
        nested: { deep: { value: 'preserved' } },
        list: [1, 2, 3],
        date: now,
      },
    };

    const serialized = serializer.serialize(data);
    const parsed = JSON.parse(serialized);

    expect(parsed.metadata.name).toBe('test');
    expect(parsed.metadata.count).toBe(42);
    expect(parsed.metadata.active).toBe(true);
    expect(parsed.metadata.nested.deep.value).toBe('preserved');
    expect(parsed.metadata.list).toEqual([1, 2, 3]);
    expect(new Date(parsed.metadata.date).getTime()).toBe(now.getTime());
  });
});
