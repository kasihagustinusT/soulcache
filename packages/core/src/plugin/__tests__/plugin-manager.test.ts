import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginManager } from '../plugin-manager';
import type { Plugin, PluginContext } from '../types';

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  afterEach(async () => {
    if (!manager.isDestroyed) {
      await manager.destroy();
    }
  });

  function createPlugin(overrides?: Partial<Plugin>): Plugin {
    return {
      metadata: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
      },
      ...overrides,
    };
  }

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin = createPlugin();
      manager.register(plugin);

      const reg = manager.getPlugin('test-plugin');
      expect(reg).toBeDefined();
      expect(reg?.state).toBe('registered');
    });

    it('should reject duplicate plugin IDs', () => {
      manager.register(createPlugin());

      expect(() => manager.register(createPlugin())).toThrow('already registered');
    });

    it('should validate metadata', () => {
      expect(() =>
        manager.register(
          createPlugin({
            metadata: { id: '', name: 'Test', version: '1.0.0' },
          }),
        ),
      ).toThrow('valid string id');
    });

    it('should check dependencies', () => {
      expect(() =>
        manager.register(
          createPlugin({
            metadata: {
              id: 'dependent',
              name: 'Dependent',
              version: '1.0.0',
              dependencies: ['nonexistent'],
            },
          }),
        ),
      ).toThrow('depends on "nonexistent"');
    });

    it('should accept plugins with satisfied dependencies', () => {
      manager.register(createPlugin());
      manager.register(
        createPlugin({
          metadata: {
            id: 'dependent',
            name: 'Dependent',
            version: '1.0.0',
            dependencies: ['test-plugin'],
          },
        }),
      );

      expect(manager.getPlugin('dependent')).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize a plugin', async () => {
      const plugin = createPlugin({
        onBeforeInit: vi.fn(),
        onAfterInit: vi.fn(),
      });
      manager.register(plugin);

      await manager.initialize('test-plugin');

      expect(manager.getPlugin('test-plugin')?.state).toBe('active');
      expect(plugin.onBeforeInit).toHaveBeenCalledOnce();
      expect(plugin.onAfterInit).toHaveBeenCalledOnce();
    });

    it('should initialize all plugins', async () => {
      manager.register(createPlugin({ metadata: { id: 'p1', name: 'P1', version: '1.0.0' } }));
      manager.register(createPlugin({ metadata: { id: 'p2', name: 'P2', version: '1.0.0' } }));

      await manager.initializeAll();

      expect(manager.getPlugin('p1')?.state).toBe('active');
      expect(manager.getPlugin('p2')?.state).toBe('active');
    });

    it('should handle initialization errors', async () => {
      const plugin = createPlugin({
        onBeforeInit: vi.fn().mockRejectedValue(new Error('Init failed')),
      });
      manager.register(plugin);

      await expect(manager.initialize('test-plugin')).rejects.toThrow('Init failed');
      expect(manager.getPlugin('test-plugin')?.state).toBe('error');
    });

    it('should not initialize non-registered plugins', async () => {
      await expect(manager.initialize('nonexistent')).rejects.toThrow('not registered');
    });
  });

  describe('suspend / resume', () => {
    it('should suspend and resume a plugin', async () => {
      const plugin = createPlugin({
        onSuspend: vi.fn(),
        onResume: vi.fn(),
      });
      manager.register(plugin);
      await manager.initialize('test-plugin');

      await manager.suspend('test-plugin');
      expect(manager.getPlugin('test-plugin')?.state).toBe('suspended');
      expect(plugin.onSuspend).toHaveBeenCalledOnce();

      await manager.resume('test-plugin');
      expect(manager.getPlugin('test-plugin')?.state).toBe('active');
      expect(plugin.onResume).toHaveBeenCalledOnce();
    });

    it('should not suspend non-active plugins', async () => {
      manager.register(createPlugin());
      await expect(manager.suspend('test-plugin')).rejects.toThrow('cannot be suspended');
    });
  });

  describe('unregister', () => {
    it('should unregister a plugin', async () => {
      manager.register(createPlugin());
      await manager.initialize('test-plugin');

      await manager.unregister('test-plugin');
      expect(manager.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should handle unregistering non-existent plugin', async () => {
      await manager.unregister('nonexistent');
    });
  });

  describe('executeHook', () => {
    it('should execute hooks on active plugins', async () => {
      const onBeforeQuery = vi.fn();
      manager.register(createPlugin({ onBeforeQuery }));
      await manager.initialize('test-plugin');

      const result = await manager.executeHook('beforeQuery', ['users']);

      expect(result.success).toBe(true);
      expect(result.executed).toBe(1);
      expect(onBeforeQuery).toHaveBeenCalledWith(['users'], expect.any(Object));
    });

    it('should skip non-active plugins', async () => {
      const onBeforeQuery = vi.fn();
      manager.register(createPlugin({ onBeforeQuery }));
      // Don't initialize — state is 'registered'

      const result = await manager.executeHook('beforeQuery', ['users']);

      expect(result.executed).toBe(0);
      expect(onBeforeQuery).not.toHaveBeenCalled();
    });

    it('should isolate hook errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      manager.register(
        createPlugin({
          metadata: { id: 'failing', name: 'Failing', version: '1.0.0' },
          onBeforeQuery: vi.fn().mockRejectedValue(new Error('Hook failed')),
        }),
      );
      manager.register(
        createPlugin({
          metadata: { id: 'working', name: 'Working', version: '1.0.0' },
          onBeforeQuery: vi.fn(),
        }),
      );

      await manager.initializeAll();

      const result = await manager.executeHook('beforeQuery', ['users']);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Hook failed');

      consoleSpy.mockRestore();
    });

    it('should handle all hook types', async () => {
      const hooks = {
        onBeforeQuery: vi.fn(),
        onAfterQuery: vi.fn(),
        onBeforeMutation: vi.fn(),
        onAfterMutation: vi.fn(),
        onCacheUpdated: vi.fn(),
        onCacheInvalidated: vi.fn(),
        onShutdown: vi.fn(),
      };

      manager.register(createPlugin(hooks));
      await manager.initialize('test-plugin');

      await manager.executeHook('beforeQuery', ['key']);
      await manager.executeHook('afterQuery', ['key']);
      await manager.executeHook('beforeMutation', ['mut-1']);
      await manager.executeHook('afterMutation', ['mut-1']);
      await manager.executeHook('cacheUpdated', ['key']);
      await manager.executeHook('cacheInvalidated', ['key']);
      await manager.executeHook('shutdown');

      expect(hooks.onBeforeQuery).toHaveBeenCalledOnce();
      expect(hooks.onAfterQuery).toHaveBeenCalledOnce();
      expect(hooks.onBeforeMutation).toHaveBeenCalledOnce();
      expect(hooks.onAfterMutation).toHaveBeenCalledOnce();
      expect(hooks.onCacheUpdated).toHaveBeenCalledOnce();
      expect(hooks.onCacheInvalidated).toHaveBeenCalledOnce();
      expect(hooks.onShutdown).toHaveBeenCalledOnce();
    });
  });

  describe('context', () => {
    it('should provide log function', async () => {
      const log = vi.fn();
      const ctxManager = new PluginManager({ log });

      ctxManager.register(createPlugin());
      await ctxManager.initialize('test-plugin');

      ctxManager.context.log('info', 'test message');
      expect(log).toHaveBeenCalledWith('info', 'test message');

      await ctxManager.destroy();
    });

    it('should provide config get/set', () => {
      manager.context.setConfig('key', 'value');
      expect(manager.context.getConfig('key')).toBe('value');
      expect(manager.context.getConfig('missing')).toBeUndefined();
    });
  });

  describe('metrics', () => {
    it('should track metrics', async () => {
      manager.register(createPlugin({ onBeforeQuery: vi.fn() }));
      await manager.initialize('test-plugin');

      await manager.executeHook('beforeQuery', ['key']);

      const metrics = manager.getMetrics();
      expect(metrics.totalRegistered).toBe(1);
      expect(metrics.activePlugins).toBe(1);
      expect(metrics.totalHookExecutions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('destroy', () => {
    it('should destroy all plugins', async () => {
      const onDispose = vi.fn();
      manager.register(createPlugin({ onDispose }));
      await manager.initialize('test-plugin');

      await manager.destroy();

      expect(manager.isDestroyed).toBe(true);
      expect(onDispose).toHaveBeenCalledOnce();
    });

    it('should be idempotent', async () => {
      await manager.destroy();
      await manager.destroy();
    });

    it('should throw on operations after destroy', () => {
      manager.destroy();

      expect(() => manager.register(createPlugin())).toThrow('destroyed');
    });
  });

  describe('getAllPlugins / getPluginsByState', () => {
    it('should list all plugins', () => {
      manager.register(createPlugin());
      manager.register(createPlugin({ metadata: { id: 'p2', name: 'P2', version: '1.0.0' } }));

      expect(manager.getAllPlugins()).toHaveLength(2);
    });

    it('should filter by state', async () => {
      manager.register(createPlugin());
      manager.register(createPlugin({ metadata: { id: 'p2', name: 'P2', version: '1.0.0' } }));
      await manager.initialize('test-plugin');

      expect(manager.getPluginsByState('active')).toHaveLength(1);
      expect(manager.getPluginsByState('registered')).toHaveLength(1);
    });
  });
});
