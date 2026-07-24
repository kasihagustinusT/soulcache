import type {
  Plugin,
  PluginMetadata,
  PluginContext,
  PluginRegistration,
  PluginState,
  HookEventType,
  HookResult,
} from './types';

/**
 * Plugin Manager Metrics
 */
export interface PluginManagerMetrics {
  /** Total plugins registered */
  readonly totalRegistered: number;

  /** Currently active plugins */
  readonly activePlugins: number;

  /** Total hook executions */
  readonly totalHookExecutions: number;

  /** Total hook errors */
  readonly totalHookErrors: number;
}

/**
 * Plugin Manager
 *
 * Central coordinator for all plugins. Manages registration, validation,
 * lifecycle, and hook execution.
 *
 * @example
 * ```ts
 * const manager = new PluginManager();
 *
 * // Register a plugin
 * manager.register({
 *   metadata: { id: 'my-plugin', name: 'My Plugin', version: '1.0.0' },
 *   onAfterInit: (ctx) => ctx.log('info', 'Plugin initialized'),
 * });
 *
 * // Initialize all plugins
 * await manager.initializeAll();
 *
 * // Execute hooks
 * await manager.executeHook('beforeQuery', ['users'], ctx);
 *
 * // Cleanup
 * await manager.destroy();
 * ```
 */
export class PluginManager {
  /** Registered plugins by ID */
  private readonly registry: Map<string, PluginRegistration> = new Map();

  /** Plugin context */
  private readonly _context: PluginContext;

  /** Configuration store */
  private readonly config: Map<string, unknown> = new Map();

  /** Metrics */
  private _totalHookExecutions = 0;
  private _totalHookErrors = 0;

  /** Whether the manager has been destroyed */
  private _destroyed = false;

  constructor(context?: Partial<PluginContext>) {
    this._context = {
      log: context?.log ?? ((_level, _message) => {}),
      getConfig: context?.getConfig ?? ((<T = unknown>(key: string): T | undefined => this.config.get(key) as T) as PluginContext['getConfig']),
      setConfig: context?.setConfig ?? ((key, value) => this.config.set(key, value)),
    };
  }

  /**
   * Plugin Context
   */
  get context(): PluginContext {
    return this._context;
  }

  /**
   * Whether the manager has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Register Plugin
   *
   * Registers a plugin with the manager. Validates metadata and dependencies.
   */
  register(plugin: Plugin): void {
    this.assertNotDestroyed();

    const { metadata } = plugin;

    if (this.registry.has(metadata.id)) {
      throw new Error(`Plugin "${metadata.id}" is already registered`);
    }

    // Validate metadata
    this.validateMetadata(metadata);

    // Check dependencies
    this.checkDependencies(metadata);

    const registration: PluginRegistration = {
      plugin,
      state: 'registered',
      registeredAt: Date.now(),
    };

    this.registry.set(metadata.id, registration);
  }

  /**
   * Unregister Plugin
   *
   * Removes a plugin from the registry after disposing it.
   */
  async unregister(pluginId: string): Promise<void> {
    this.assertNotDestroyed();

    const registration = this.registry.get(pluginId);
    if (registration === undefined) return;

    // Dispose if active
    if (registration.state === 'active' || registration.state === 'suspended') {
      await this.disposePlugin(pluginId);
    }

    registration.state = 'removed';
    this.registry.delete(pluginId);
  }

  /**
   * Get Plugin
   *
   * Returns the registration for a given plugin ID.
   */
  getPlugin(pluginId: string): PluginRegistration | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get All Plugins
   *
   * Returns all registered plugins.
   */
  getAllPlugins(): readonly PluginRegistration[] {
    return [...this.registry.values()];
  }

  /**
   * Get Plugins By State
   *
   * Returns all plugins in a given state.
   */
  getPluginsByState(state: PluginState): readonly PluginRegistration[] {
    return [...this.registry.values()].filter((r) => r.state === state);
  }

  /**
   * Initialize Plugin
   *
   * Initializes a specific plugin by ID.
   */
  async initialize(pluginId: string): Promise<void> {
    this.assertNotDestroyed();

    const registration = this.registry.get(pluginId);
    if (registration === undefined) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }

    if (registration.state !== 'registered') {
      throw new Error(`Plugin "${pluginId}" cannot be initialized from state "${registration.state}"`);
    }

    try {
      registration.state = 'initialized';

      if (registration.plugin.onBeforeInit) {
        await registration.plugin.onBeforeInit(this._context);
      }

      registration.state = 'active';

      if (registration.plugin.onAfterInit) {
        await registration.plugin.onAfterInit(this._context);
      }
    } catch (error) {
      registration.state = 'error';
      registration.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Initialize All Plugins
   *
   * Initializes all registered plugins in registration order.
   */
  async initializeAll(): Promise<void> {
    this.assertNotDestroyed();

    for (const [id] of this.registry) {
      const registration = this.registry.get(id);
      if (registration?.state === 'registered') {
        await this.initialize(id);
      }
    }
  }

  /**
   * Suspend Plugin
   *
   * Suspends an active plugin.
   */
  async suspend(pluginId: string): Promise<void> {
    this.assertNotDestroyed();

    const registration = this.registry.get(pluginId);
    if (registration === undefined) return;

    if (registration.state !== 'active') {
      throw new Error(`Plugin "${pluginId}" cannot be suspended from state "${registration.state}"`);
    }

    registration.state = 'suspended';

    if (registration.plugin.onSuspend) {
      await registration.plugin.onSuspend(this._context);
    }
  }

  /**
   * Resume Plugin
   *
   * Resumes a suspended plugin.
   */
  async resume(pluginId: string): Promise<void> {
    this.assertNotDestroyed();

    const registration = this.registry.get(pluginId);
    if (registration === undefined) return;

    if (registration.state !== 'suspended') {
      throw new Error(`Plugin "${pluginId}" cannot be resumed from state "${registration.state}"`);
    }

    registration.state = 'resuming';

    if (registration.plugin.onResume) {
      await registration.plugin.onResume(this._context);
    }

    registration.state = 'active';
  }

  /**
   * Execute Hook
   *
   * Executes a lifecycle hook across all active plugins.
   * Errors in individual plugins are isolated and collected.
   */
  async executeHook(
    hookType: HookEventType,
    ...args: unknown[]
  ): Promise<HookResult> {
    this.assertNotDestroyed();

    const errors: Error[] = [];
    let executed = 0;

    for (const registration of this.registry.values()) {
      if (registration.state !== 'active') continue;

      const hookName = `on${hookType.charAt(0).toUpperCase()}${hookType.slice(1)}` as keyof Plugin;
      const hook = registration.plugin[hookName];
      if (typeof hook !== 'function') continue;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (hook as any)(...args, this._context);
        executed++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        this._totalHookErrors++;
        this._context.log('error', `Plugin "${registration.plugin.metadata.id}" hook "${hookType}" failed: ${err.message}`);
      }

      this._totalHookExecutions++;
    }

    return {
      success: errors.length === 0,
      executed,
      errors,
    };
  }

  /**
   * Get Metrics
   *
   * Returns current plugin manager metrics.
   */
  getMetrics(): PluginManagerMetrics {
    return {
      totalRegistered: this.registry.size,
      activePlugins: this.getPluginsByState('active').length,
      totalHookExecutions: this._totalHookExecutions,
      totalHookErrors: this._totalHookErrors,
    };
  }

  /**
   * Destroy
   *
   * Disposes all plugins and cleans up resources.
   */
  async destroy(): Promise<void> {
    if (this._destroyed) return;
    this._destroyed = true;

    // Dispose all active plugins
    for (const [id, registration] of this.registry) {
      if (registration.state === 'active' || registration.state === 'suspended') {
        try {
          await this.disposePlugin(id);
        } catch (_error) {
          // Best-effort cleanup
        }
      }
    }

    this.registry.clear();
    this.config.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private async disposePlugin(pluginId: string): Promise<void> {
    const registration = this.registry.get(pluginId);
    if (registration === undefined) return;

    registration.state = 'stopping';

    if (registration.plugin.onDispose) {
      await registration.plugin.onDispose(this._context);
    }

    registration.state = 'disposed';
  }

  private validateMetadata(metadata: PluginMetadata): void {
    if (!metadata.id || typeof metadata.id !== 'string') {
      throw new Error('Plugin metadata must have a valid string id');
    }
    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new Error('Plugin metadata must have a valid string name');
    }
    if (!metadata.version || typeof metadata.version !== 'string') {
      throw new Error('Plugin metadata must have a valid string version');
    }
  }

  private checkDependencies(metadata: PluginMetadata): void {
    if (metadata.dependencies === undefined || metadata.dependencies.length === 0) return;

    for (const depId of metadata.dependencies) {
      if (!this.registry.has(depId)) {
        throw new Error(`Plugin "${metadata.id}" depends on "${depId}" which is not registered`);
      }
    }
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('PluginManager has been destroyed');
    }
  }
}
