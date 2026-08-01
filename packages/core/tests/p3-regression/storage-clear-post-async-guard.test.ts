import { describe, it, expect, vi } from 'vitest';
import { StorageManager } from '../../src/storage/storage-manager';
import { MemoryAdapter } from '../../src/storage/adapters/memory-adapter';

function createReadyManager(): Promise<StorageManager> {
  const adapter = new MemoryAdapter();
  const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
  return adapter
    .initialize()
    .then(() => manager.initialize())
    .then(() => manager);
}

describe('clear() post-async guard', () => {
  it('1. clear() works normally when no concurrent dispose', async () => {
    const manager = await createReadyManager();

    await manager.save({
      version: 1,
      timestamp: Date.now(),
      queryCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
      mutationCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
      metadata: { lastUpdated: Date.now(), schemaVersion: 1 },
    });
    expect(await manager.restore()).not.toBeNull();

    await manager.clear();

    const afterClear = await manager.restore();
    expect(afterClear).toBeNull();
    expect(manager.isReady()).toBe(true);
  });

  it('2. clear() events fire correctly on success', async () => {
    const manager = await createReadyManager();
    const startHandler = vi.fn();
    const completeHandler = vi.fn();
    manager.on('storage.clear.start', startHandler);
    manager.on('storage.clear.complete', completeHandler);

    await manager.clear();

    expect(startHandler).toHaveBeenCalledTimes(1);
    expect(completeHandler).toHaveBeenCalledTimes(1);
    expect(manager.isReady()).toBe(true);
  });

  it('3. clear() after dispose does not crash adapter access', async () => {
    const manager = await createReadyManager();

    // Intercept coordinator.clear to simulate concurrent dispose
    const coordinator = (
      manager as unknown as { coordinator: { clear: (adapter: unknown) => Promise<void> } }
    ).coordinator;
    const originalClear = coordinator.clear.bind(coordinator);

    let disposeDuringClear = false;
    coordinator.clear = async (adapter: unknown) => {
      await originalClear(adapter);
      // Simulate dispose happening during the async operation
      if (!disposeDuringClear) {
        disposeDuringClear = true;
        await manager.dispose();
      }
    };

    await manager.clear();

    // After concurrent dispose, manager should be disposed
    expect(manager.getStatus()).toBe('disposed');
  });

  it('4. clear() error handler preserves disposed status', async () => {
    const manager = await createReadyManager();

    // Make coordinator.clear throw
    const coordinator = (
      manager as unknown as { coordinator: { clear: (adapter: unknown) => Promise<void> } }
    ).coordinator;
    coordinator.clear = async () => {
      throw new Error('clear failed');
    };

    await expect(manager.clear()).rejects.toThrow('clear failed');
    // Should still be ready after error
    expect(manager.isReady()).toBe(true);
  });
});
