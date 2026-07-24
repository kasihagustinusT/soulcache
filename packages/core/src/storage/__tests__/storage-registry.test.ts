/**
 * StorageRegistry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StorageRegistry } from '../storage-registry';
import { MemoryAdapter } from '../adapters/memory-adapter';

describe('StorageRegistry', () => {
  let registry: StorageRegistry;

  beforeEach(() => {
    registry = new StorageRegistry();
  });

  describe('Registration', () => {
    it('should register an adapter', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);
      expect(registry.has('memory')).toBe(true);
    });

    it('should throw when registering duplicate adapter', () => {
      const adapter1 = new MemoryAdapter();
      const adapter2 = new MemoryAdapter();
      registry.register(adapter1);
      expect(() => registry.register(adapter2)).toThrow('already registered');
    });

    it('should unregister an adapter', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);
      const result = registry.unregister('memory');
      expect(result).toBe(true);
      expect(registry.has('memory')).toBe(false);
    });

    it('should return false when unregistering non-existent adapter', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Retrieval', () => {
    it('should get adapter by name', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);
      const retrieved = registry.get('memory');
      expect(retrieved).toBe(adapter);
    });

    it('should return undefined for non-existent adapter', () => {
      const retrieved = registry.get('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get or throw for existing adapter', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);
      const retrieved = registry.getOrThrow('memory');
      expect(retrieved).toBe(adapter);
    });

    it('should throw for non-existent adapter with getOrThrow', () => {
      expect(() => registry.getOrThrow('non-existent')).toThrow('not found');
    });
  });

  describe('Enumeration', () => {
    it('should return all adapter names', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);

      const names = registry.getNames();
      expect(names).toHaveLength(1);
      expect(names).toContain('memory');
    });

    it('should return all adapters', () => {
      const adapter = new MemoryAdapter();
      registry.register(adapter);

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(adapter);
    });

    it('should return correct size', () => {
      expect(registry.getSize()).toBe(0);
      registry.register(new MemoryAdapter());
      expect(registry.getSize()).toBe(1);
    });
  });

  describe('Clear', () => {
    it('should clear all adapters', () => {
      registry.register(new MemoryAdapter());
      registry.clear();
      expect(registry.getSize()).toBe(0);
    });

    it('should allow re-registering after clear', () => {
      registry.register(new MemoryAdapter());
      registry.clear();
      registry.register(new MemoryAdapter());
      expect(registry.getSize()).toBe(1);
    });
  });
});
