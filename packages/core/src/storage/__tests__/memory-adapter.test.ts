/**
 * MemoryAdapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../adapters/memory-adapter';

describe('MemoryAdapter', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
  });

  describe('Lifecycle', () => {
    it('should start not ready before initialization', () => {
      const newAdapter = new MemoryAdapter();
      expect(newAdapter.isReady()).toBe(false);
    });

    it('should be ready after initialization', () => {
      expect(adapter.isReady()).toBe(true);
    });

    it('should not be ready after disposal', async () => {
      await adapter.dispose();
      expect(adapter.isReady()).toBe(false);
    });

    it('should throw when calling methods before initialization', async () => {
      const newAdapter = new MemoryAdapter();
      await expect(newAdapter.get('key')).rejects.toThrow('not initialized');
    });

    it('should allow re-initialization after disposal', async () => {
      await adapter.dispose();
      await adapter.initialize();
      expect(adapter.isReady()).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should get null for non-existent key', async () => {
      const result = await adapter.get('non-existent');
      expect(result).toBeNull();
    });

    it('should set and get value', async () => {
      await adapter.set('key1', 'value1');
      const result = await adapter.get('key1');
      expect(result).toBe('value1');
    });

    it('should overwrite existing value', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key1', 'value2');
      const result = await adapter.get('key1');
      expect(result).toBe('value2');
    });

    it('should delete key', async () => {
      await adapter.set('key1', 'value1');
      await adapter.delete('key1');
      const result = await adapter.get('key1');
      expect(result).toBeNull();
    });

    it('should handle deleting non-existent key', async () => {
      await expect(adapter.delete('non-existent')).resolves.not.toThrow();
    });

    it('should check if key exists', async () => {
      expect(await adapter.has('key1')).toBe(false);
      await adapter.set('key1', 'value1');
      expect(await adapter.has('key1')).toBe(true);
    });

    it('should clear all entries', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.clear();
      expect(await adapter.getSize()).toBe(0);
    });
  });

  describe('Enumeration', () => {
    it('should return all keys', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.set('key3', 'value3');

      const keys = await adapter.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return empty array when no keys', async () => {
      const keys = await adapter.keys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('Size Management', () => {
    it('should return correct size', async () => {
      expect(await adapter.getSize()).toBe(0);
      await adapter.set('key1', 'value1');
      expect(await adapter.getSize()).toBe(1);
      await adapter.set('key2', 'value2');
      expect(await adapter.getSize()).toBe(2);
    });

    it('should return usage information', async () => {
      const usage = await adapter.getUsage();
      expect(usage.used).toBe(0);
      expect(usage.available).toBeNull();
      expect(usage.percentage).toBeNull();
    });

    it('should update usage after setting values', async () => {
      await adapter.set('key1', 'value1');
      const usage = await adapter.getUsage();
      expect(usage.used).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    it('should not be ready after disposal', async () => {
      await adapter.dispose();
      expect(adapter.isReady()).toBe(false);
    });

    it('should throw when accessing data after disposal', async () => {
      await adapter.set('key1', 'value1');
      await adapter.dispose();
      await expect(adapter.getSize()).rejects.toThrow('not initialized');
    });
  });

  describe('Name', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('memory');
    });
  });
});
