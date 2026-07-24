import { describe, it, expect } from 'vitest';
import { createSerializer, defaultSerializer } from '../serializer';

describe('Serializer', () => {
  describe('createSerializer', () => {
    it('should serialize primitives', () => {
      const s = createSerializer();
      expect(s.serialize(null)).toEqual({ type: 'null', value: null, depth: 0 });
      expect(s.serialize(undefined)).toEqual({ type: 'undefined', value: undefined, depth: 0 });
      expect(s.serialize(42)).toEqual({ type: 'number', value: 42, depth: 0 });
      expect(s.serialize('hello')).toEqual({ type: 'string', value: 'hello', depth: 0 });
      expect(s.serialize(true)).toEqual({ type: 'boolean', value: true, depth: 0 });
    });

    it('should serialize bigint', () => {
      const s = createSerializer();
      expect(s.serialize(BigInt(123))).toEqual({ type: 'bigint', value: '123', depth: 0 });
    });

    it('should serialize symbol', () => {
      const s = createSerializer();
      expect(s.serialize(Symbol('test'))).toEqual({ type: 'symbol', value: 'Symbol(test)', depth: 0 });
    });

    it('should serialize functions with name', () => {
      const s = createSerializer();
      const fn = function myFunc() {};
      expect(s.serialize(fn)).toEqual({ type: 'function', value: 'myFunc', depth: 0 });
    });

    it('should serialize anonymous functions', () => {
      const s = createSerializer({ includeFunctionNames: true });
      const fn = () => {};
      const result = s.serialize(fn);
      expect(result.type).toBe('function');
    });

    it('should truncate long strings', () => {
      const s = createSerializer({ maxStringLength: 10 });
      const longStr = 'a'.repeat(20);
      const result = s.serialize(longStr);
      expect(result.type).toBe('string');
      expect(result.truncated).toBe(true);
    });

    it('should serialize Date', () => {
      const s = createSerializer();
      const date = new Date('2024-01-01');
      expect(s.serialize(date)).toEqual({ type: 'date', value: '2024-01-01T00:00:00.000Z', depth: 0 });
    });

    it('should serialize RegExp', () => {
      const s = createSerializer();
      expect(s.serialize(/test/gi)).toEqual({ type: 'regexp', value: '/test/gi', depth: 0 });
    });

    it('should serialize Error', () => {
      const s = createSerializer();
      const error = new Error('test error');
      const result = s.serialize(error);
      expect(result.type).toBe('error');
      expect((result.value as { name: string; message: string }).name).toBe('Error');
      expect((result.value as { name: string; message: string }).message).toBe('test error');
    });

    it('should serialize Map', () => {
      const s = createSerializer();
      const map = new Map([['key1', 'value1'], ['key2', 'value2']]);
      const result = s.serialize(map);
      expect(result.type).toBe('map');
      expect(result.value).toEqual([['key1', 'value1'], ['key2', 'value2']]);
    });

    it('should truncate large Maps', () => {
      const s = createSerializer({ maxArrayLength: 2 });
      const map = new Map([['a', 1], ['b', 2], ['c', 3]]);
      const result = s.serialize(map);
      expect(result.truncated).toBe(true);
    });

    it('should serialize Set', () => {
      const s = createSerializer();
      const set = new Set([1, 2, 3]);
      const result = s.serialize(set);
      expect(result.type).toBe('set');
      expect(result.value).toEqual([1, 2, 3]);
    });

    it('should serialize WeakMap as placeholder', () => {
      const s = createSerializer();
      expect(s.serialize(new WeakMap())).toEqual({ type: 'weakmap', value: '[WeakMap]', depth: 0 });
    });

    it('should serialize Promise as placeholder', () => {
      const s = createSerializer();
      expect(s.serialize(Promise.resolve())).toEqual({ type: 'promise', value: '[Promise]', depth: 0 });
    });

    it('should serialize ArrayBuffer', () => {
      const s = createSerializer();
      const buf = new ArrayBuffer(8);
      expect(s.serialize(buf)).toEqual({ type: 'arraybuffer', value: '[ArrayBuffer 8 bytes]', depth: 0 });
    });

    it('should serialize typed arrays', () => {
      const s = createSerializer();
      const arr = new Uint8Array([1, 2, 3]);
      const result = s.serialize(arr);
      expect(result.type).toBe('typedarray');
    });

    it('should serialize arrays', () => {
      const s = createSerializer();
      const result = s.serialize([1, 2, 3]);
      expect(result.type).toBe('array');
      expect(result.value).toEqual([1, 2, 3]);
      expect(result.depth).toBe(0);
    });

    it('should truncate long arrays', () => {
      const s = createSerializer({ maxArrayLength: 3 });
      const arr = [1, 2, 3, 4, 5];
      const result = s.serialize(arr);
      expect(result.truncated).toBe(true);
    });

    it('should serialize nested objects', () => {
      const s = createSerializer();
      const obj = { a: 1, b: 'hello', c: [1, 2] };
      const result = s.serialize(obj);
      expect(result.type).toBe('object');
      expect(result.value).toEqual({ a: 1, b: 'hello', c: [1, 2] });
    });

    it('should handle circular references', () => {
      const s = createSerializer({ handleCircularRefs: true });
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      const result = s.serialize(obj);
      expect(result.type).toBe('object');
      expect((result.value as Record<string, unknown>).self).toBe('[Circular Reference]');
    });

    it('should respect maxDepth', () => {
      const s = createSerializer({ maxDepth: 2 });
      const deep = { a: { b: { c: { d: 1 } } } };
      const result = s.serialize(deep);
      expect(result.type).toBe('object');
    });

    it('should handle Infinity and NaN', () => {
      const s = createSerializer();
      expect(s.serialize(Infinity)).toEqual({ type: 'number', value: 'Infinity', depth: 0 });
      expect(s.serialize(NaN)).toEqual({ type: 'number', value: 'NaN', depth: 0 });
    });

    it('should use custom serializers', () => {
      const s = createSerializer({
        customSerializers: [
          {
            test: (v) => v instanceof URL,
            serialize: (v) => (v as URL).href,
            deserialize: (v) => new URL(v as string),
          },
        ],
      });
      const url = new URL('https://example.com');
      const result = s.serialize(url);
      expect(result.type).toBe('custom');
      // URL.href includes trailing slash
      expect(result.value).toBe(url.href);
    });
  });

  describe('defaultSerializer', () => {
    it('should exist and be usable', () => {
      expect(defaultSerializer).toBeDefined();
      expect(defaultSerializer.serialize(42)).toEqual({ type: 'number', value: 42, depth: 0 });
    });
  });
});
