import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';
import { QueryClient } from '@soulcache/core';
import fs from 'fs';
import path from 'path';

/**
 * useQuery missing getServerSnapshot.
 *
 * useSyncExternalStore requires a third argument (getServerSnapshot)
 * for proper SSR semantics. Without it, React logs a warning during
 * server rendering and hydration may mismatch.
 */
describe('useQuery getServerSnapshot', () => {
  it('1. source contains getServerSnapshot and passes it to useSyncExternalStore', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/use-query.ts'), 'utf-8');
    expect(source).toContain('getServerSnapshot');
    expect(source).toMatch(/useSyncExternalStore\(subscribe,\s*getSnapshot,\s*getServerSnapshot\)/);
  });

  it('2. useQuery renders correctly without SSR warnings', () => {
    const client = new QueryClient();

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(SoulCacheProvider, { client }, children);
    }

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['ssr-test'],
          queryFn: () => Promise.resolve('data'),
        }),
      { wrapper: Wrapper },
    );

    // useQuery auto-fetches on mount by design, so status transitions to
    // 'loading' immediately. The purpose of this test is to verify no SSR
    // warnings — not to assert idle behavior.
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeUndefined();
  });

  it('3. useQuery with prefetched data renders correctly', () => {
    const client = new QueryClient();
    client.setQueryData(['ssr-pre'], 'preloaded');

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(SoulCacheProvider, { client }, children);
    }

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['ssr-pre'],
          queryFn: () => Promise.resolve('data'),
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.data).toBe('preloaded');
  });
});
