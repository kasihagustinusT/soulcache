/**
 * Plugin State
 */
export type PluginState =
  | 'discovered'
  | 'validated'
  | 'registered'
  | 'initialized'
  | 'active'
  | 'suspended'
  | 'resuming'
  | 'stopping'
  | 'disposed'
  | 'removed'
  | 'error';

/**
 * Plugin Metadata
 *
 * Describes a plugin for registration and validation.
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Semver version string */
  readonly version: string;

  /** Plugin description */
  readonly description?: string;

  /** Plugin author */
  readonly author?: string;

  /** Minimum compatible SoulCache version */
  readonly minVersion?: string;

  /** Maximum compatible SoulCache version */
  readonly maxVersion?: string;

  /** Plugin dependencies (other plugin IDs) */
  readonly dependencies?: readonly string[];

  /** Required capabilities */
  readonly capabilities?: readonly string[];
}

/**
 * Plugin Context
 *
 * Runtime environment exposed to plugins.
 * Provides safe access to core services without exposing internals.
 */
export interface PluginContext {
  /** Log a message */
  readonly log: (level: 'info' | 'warn' | 'error', message: string) => void;

  /** Get a configuration value */
  readonly getConfig: <T = unknown>(key: string) => T | undefined;

  /** Set a configuration value */
  readonly setConfig: (key: string, value: unknown) => void;
}

/**
 * Plugin Lifecycle Hooks
 *
 * Optional lifecycle methods a plugin may implement.
 */
export interface PluginHooks {
  /** Called before plugin initialization */
  readonly onBeforeInit?: (ctx: PluginContext) => void | Promise<void>;

  /** Called after plugin initialization */
  readonly onAfterInit?: (ctx: PluginContext) => void | Promise<void>;

  /** Called before query execution */
  readonly onBeforeQuery?: (queryKey: unknown[], ctx: PluginContext) => void | Promise<void>;

  /** Called after query execution */
  readonly onAfterQuery?: (queryKey: unknown[], ctx: PluginContext) => void | Promise<void>;

  /** Called before mutation execution */
  readonly onBeforeMutation?: (mutationId: string, ctx: PluginContext) => void | Promise<void>;

  /** Called after mutation execution */
  readonly onAfterMutation?: (mutationId: string, ctx: PluginContext) => void | Promise<void>;

  /** Called when cache is updated */
  readonly onCacheUpdated?: (queryKey: unknown[], ctx: PluginContext) => void | Promise<void>;

  /** Called when cache is invalidated */
  readonly onCacheInvalidated?: (queryKey: unknown[], ctx: PluginContext) => void | Promise<void>;

  /** Called during runtime shutdown */
  readonly onShutdown?: (ctx: PluginContext) => void | Promise<void>;

  /** Called when plugin is suspended */
  readonly onSuspend?: (ctx: PluginContext) => void | Promise<void>;

  /** Called when plugin is resumed */
  readonly onResume?: (ctx: PluginContext) => void | Promise<void>;

  /** Called when plugin is disposed */
  readonly onDispose?: (ctx: PluginContext) => void | Promise<void>;
}

/**
 * Plugin
 *
 * The interface every SoulCache plugin must implement.
 */
export interface Plugin extends PluginHooks {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;
}

/**
 * Plugin Registration
 *
 * Internal representation of a registered plugin.
 */
export interface PluginRegistration {
  /** The plugin instance */
  readonly plugin: Plugin;

  /** Current state */
  state: PluginState;

  /** Registration timestamp */
  readonly registeredAt: number;

  /** Error if state is 'error' */
  error?: Error;
}

/**
 * Hook Event Type
 */
export type HookEventType =
  | 'beforeInit'
  | 'afterInit'
  | 'beforeQuery'
  | 'afterQuery'
  | 'beforeMutation'
  | 'afterMutation'
  | 'cacheUpdated'
  | 'cacheInvalidated'
  | 'shutdown'
  | 'suspend'
  | 'resume'
  | 'dispose';

/**
 * Hook Execution Result
 */
export interface HookResult {
  /** Whether all hooks completed successfully */
  readonly success: boolean;

  /** Number of hooks executed */
  readonly executed: number;

  /** Errors that occurred (one per failed hook) */
  readonly errors: readonly Error[];
}
