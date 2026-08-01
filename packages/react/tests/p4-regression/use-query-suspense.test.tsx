import { describe, it, expect } from 'vitest';
import React, { Suspense } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

function TestQuery({ client, queryKey }: { client: QueryClient; queryKey: string[] }) {
  const { data } = useQuery({
    queryKey,
    queryFn: async () => 'resolved',
    suspense: true,
  });
  return <div>{data}</div>;
}

describe('Suspense integration', () => {
  it('suspends on missing data and resolves', async () => {
    const client = new QueryClient();

    const screen = render(
      <Suspense fallback={<div>loading</div>}>
        <SoulCacheProvider client={client}>
          <TestQuery client={client} queryKey={['susp-resolve']} />
        </SoulCacheProvider>
      </Suspense>,
    );

    expect(screen.getByText('loading')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('resolved')).toBeTruthy();
    });
  });

  it('suspends on pre-existing cache data (already has data)', async () => {
    const client = new QueryClient();
    client.setQueryData(['susp-cached'], 'from-cache');

    const screen = render(
      <Suspense fallback={<div>loading</div>}>
        <SoulCacheProvider client={client}>
          <TestQuery client={client} queryKey={['susp-cached']} />
        </SoulCacheProvider>
      </Suspense>,
    );

    await waitFor(() => {
      expect(screen.getByText('from-cache')).toBeTruthy();
    });
  });

  it('can mount and unmount while suspended without error', async () => {
    const client = new QueryClient();
    let resolve: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolve = r;
    });

    const TestSlow = () => {
      useQuery({
        queryKey: ['susp-slow'],
        queryFn: async () => fetchPromise,
        suspense: true,
      });
      return null;
    };

    const screen = render(
      <Suspense fallback={<div>loading</div>}>
        <SoulCacheProvider client={client}>
          <TestSlow />
        </SoulCacheProvider>
      </Suspense>,
    );

    expect(screen.getByText('loading')).toBeTruthy();

    screen.unmount();

    resolve!('done');
    await new Promise((r) => setTimeout(r, 10));
  });

  it('old suspense promise cannot affect new query after replacement', async () => {
    const client = new QueryClient();
    let resolveOld: (v: string) => void;
    const oldPromise = new Promise<string>((r) => {
      resolveOld = r;
    });

    let renderCount = 0;

    const TestReplace = ({ useNew }: { useNew: boolean }) => {
      const key = useNew ? ['susp-replace-new'] : ['susp-replace-old'];
      const { data } = useQuery({
        queryKey: key,
        queryFn: async () => (useNew ? 'new-data' : oldPromise),
        suspense: true,
      });
      renderCount++;
      return <div>{data}</div>;
    };

    const screen = render(
      <Suspense fallback={<div>loading</div>}>
        <SoulCacheProvider client={client}>
          <TestReplace useNew={false} />
        </SoulCacheProvider>
      </Suspense>,
    );

    expect(screen.getByText('loading')).toBeTruthy();

    screen.rerender(
      <Suspense fallback={<div>loading</div>}>
        <SoulCacheProvider client={client}>
          <TestReplace useNew={true} />
        </SoulCacheProvider>
      </Suspense>,
    );

    resolveOld!('old-data');
    await new Promise((r) => setTimeout(r, 30));

    await waitFor(() => {
      expect(screen.getByText('new-data')).toBeTruthy();
    });
  });
});
