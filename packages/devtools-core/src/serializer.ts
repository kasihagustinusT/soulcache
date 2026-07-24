/**
 * Serializer
 *
 * Handles serialization of non-JSON-safe values like Map, Set, Date,
 * Error, RegExp, undefined, function references, and circular references.
 */

import type { SerializationOptions, SerializedValue } from './types';

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_STRING_LENGTH = 1000;
const DEFAULT_MAX_ARRAY_LENGTH = 100;

/**
 * Create a serializer with the given options.
 */
export function createSerializer(options?: SerializationOptions) {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxStringLength = options?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const maxArrayLength = options?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH;
  const includeFunctionNames = options?.includeFunctionNames ?? true;
  const handleCircularRefs = options?.handleCircularRefs ?? true;
  const customSerializers = options?.customSerializers ?? [];

  function serialize(value: unknown, depth: number = 0): SerializedValue {
    if (depth > maxDepth) {
      return { type: 'truncated', value: '[Max Depth Exceeded]', truncated: true, depth };
    }

    if (value === null) {
      return { type: 'null', value: null, depth };
    }

    if (value === undefined) {
      return { type: 'undefined', value: undefined, depth };
    }

    // Check custom serializers first
    for (const cs of customSerializers) {
      if (cs.test(value)) {
        return { type: 'custom', value: cs.serialize(value), depth };
      }
    }

    // Primitives
    if (typeof value === 'string') {
      if (value.length > maxStringLength) {
        return {
          type: 'string',
          value: value.slice(0, maxStringLength) + '...',
          truncated: true,
          depth,
        };
      }
      return { type: 'string', value, depth };
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return { type: 'number', value: String(value), depth };
      }
      return { type: 'number', value, depth };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean', value, depth };
    }

    if (typeof value === 'bigint') {
      return { type: 'bigint', value: value.toString(), depth };
    }

    if (typeof value === 'symbol') {
      return { type: 'symbol', value: value.toString(), depth };
    }

    if (typeof value === 'function') {
      if (includeFunctionNames) {
        return { type: 'function', value: value.name || '[anonymous]', depth };
      }
      return { type: 'function', value: '[Function]', depth };
    }

    // Built-in objects
    if (value instanceof Error) {
      return {
        type: 'error',
        value: {
          name: value.name,
          message: value.message,
          stack: value.stack?.split('\n').slice(0, 5).join('\n'),
        },
        depth,
      };
    }

    if (value instanceof Date) {
      return { type: 'date', value: value.toISOString(), depth };
    }

    if (value instanceof RegExp) {
      return { type: 'regexp', value: value.toString(), depth };
    }

    if (value instanceof Map) {
      const entries: [unknown, unknown][] = [];
      let truncated = false;
      let count = 0;
      for (const entry of value) {
        if (count >= maxArrayLength) {
          truncated = true;
          break;
        }
        entries.push([serialize(entry[0], depth + 1).value, serialize(entry[1], depth + 1).value]);
        count++;
      }
      return {
        type: 'map',
        value: entries,
        truncated,
        depth,
      };
    }

    if (value instanceof Set) {
      const items: unknown[] = [];
      let truncated = false;
      let count = 0;
      for (const item of value) {
        if (count >= maxArrayLength) {
          truncated = true;
          break;
        }
        items.push(serialize(item, depth + 1).value);
        count++;
      }
      return {
        type: 'set',
        value: items,
        truncated,
        depth,
      };
    }

    if (value instanceof WeakMap) {
      return { type: 'weakmap', value: '[WeakMap]', depth };
    }

    if (value instanceof WeakSet) {
      return { type: 'weakset', value: '[WeakSet]', depth };
    }

    if (value instanceof Promise) {
      return { type: 'promise', value: '[Promise]', depth };
    }

    if (value instanceof ArrayBuffer) {
      return { type: 'arraybuffer', value: `[ArrayBuffer ${value.byteLength} bytes]`, depth };
    }

    if (ArrayBuffer.isView(value)) {
      return { type: 'typedarray', value: `[${value.constructor.name} ${value.byteLength} bytes]`, depth };
    }

    // Arrays
    if (Array.isArray(value)) {
      if (handleCircularRefs) {
        return serializeArrayWithCircularRef(value, depth);
      }
      return serializeArray(value, depth);
    }

    // Plain objects
    if (typeof value === 'object') {
      if (handleCircularRefs) {
        return serializeObjectWithCircularRef(value as Record<string, unknown>, depth);
      }
      return serializeObject(value as Record<string, unknown>, depth);
    }

    return { type: 'unknown', value: String(value), depth };
  }

  function serializeArray(arr: unknown[], depth: number): SerializedValue {
    const items: unknown[] = [];
    let truncated = false;
    for (let i = 0; i < arr.length; i++) {
      if (i >= maxArrayLength) {
        truncated = true;
        break;
      }
      items.push(serialize(arr[i]!, depth + 1).value);
    }
    return { type: 'array', value: items, truncated, depth };
  }

  function serializeObject(obj: Record<string, unknown>, depth: number): SerializedValue {
    const entries: [string, unknown][] = [];
    const keys = Object.keys(obj);
    let truncated = false;
    for (let i = 0; i < keys.length; i++) {
      if (i >= maxArrayLength) {
        truncated = true;
        break;
      }
      const key = keys[i]!;
      entries.push([key, serialize(obj[key], depth + 1).value]);
    }
    return { type: 'object', value: Object.fromEntries(entries), truncated, depth };
  }

  function serializeArrayWithCircularRef(arr: unknown[], depth: number): SerializedValue {
    const seen = new WeakSet<object>();
    return serializeWithCircularCheck(arr, depth, seen);
  }

  function serializeObjectWithCircularRef(obj: Record<string, unknown>, depth: number): SerializedValue {
    const seen = new WeakSet<object>();
    return serializeWithCircularCheck(obj, depth, seen);
  }

  function serializeWithCircularCheck(value: unknown, depth: number, seen: WeakSet<object>): SerializedValue {
    if (depth > maxDepth) {
      return { type: 'truncated', value: '[Max Depth Exceeded]', truncated: true, depth };
    }

    if (value === null || value === undefined) {
      return serialize(value, depth);
    }

    if (typeof value !== 'object') {
      return serialize(value, depth);
    }

    if (seen.has(value as object)) {
      return { type: 'circular', value: '[Circular Reference]', depth };
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      const items: unknown[] = [];
      let truncated = false;
      for (let i = 0; i < value.length; i++) {
        if (i >= maxArrayLength) {
          truncated = true;
          break;
        }
        items.push(serializeWithCircularCheck(value[i]!, depth + 1, seen).value);
      }
      return { type: 'array', value: items, truncated, depth };
    }

    const entries: [string, unknown][] = [];
    const keys = Object.keys(value as Record<string, unknown>);
    let truncated = false;
    for (let i = 0; i < keys.length; i++) {
      if (i >= maxArrayLength) {
        truncated = true;
        break;
      }
      const key = keys[i]!;
      entries.push([
        key,
        serializeWithCircularCheck((value as Record<string, unknown>)[key], depth + 1, seen).value,
      ]);
    }

    seen.delete(value as object);
    return { type: 'object', value: Object.fromEntries(entries), truncated, depth };
  }

  return { serialize };
}

/** Default serializer instance */
export const defaultSerializer = createSerializer();
