/**
 * DevToolsProvider
 *
 * React context provider that makes DevTools state available
 * to all panel components without prop drilling.
 */

import { createContext, useContext } from 'react';
import type { SoulCacheDevTools } from './use-soulcache-devtools';

export interface DevToolsContextValue {
  readonly devtools: SoulCacheDevTools;
  readonly isOpen: boolean;
  readonly activeTab: DevToolsTab;
}

export type DevToolsTab = 'queries' | 'mutations' | 'timeline' | 'metrics' | 'health' | 'settings';

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function useDevToolsContext(): DevToolsContextValue {
  const ctx = useContext(DevToolsContext);
  if (!ctx) {
    throw new Error('useDevToolsContext must be used within a DevToolsProvider');
  }
  return ctx;
}

export { DevToolsContext };
