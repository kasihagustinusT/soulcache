/**
 * Plugin System Module
 *
 * @module plugin
 */

export { PluginManager } from './plugin-manager';
export type { PluginManagerMetrics } from './plugin-manager';
export type {
  Plugin,
  PluginMetadata,
  PluginContext,
  PluginHooks,
  PluginRegistration,
  PluginState,
  HookEventType,
  HookResult,
} from './types';
