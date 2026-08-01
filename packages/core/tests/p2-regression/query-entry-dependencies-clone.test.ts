import { describe, it, expect } from 'vitest';
import { QueryEntry } from '../../src/cache/query-entry';
import { QueryClient } from '../../src/client/query-client';

describe('QueryEntry dependencies cloned on set', () => {
  it('constructor clones dependencies array', () => {
    const deps = ['a', 'b'];
    const entry = new QueryEntry({
      queryId: 'h5-1',
      queryKey: ['test'],
      keyHash: 'test',
      dependencies: deps,
    });

    // Mutate the original array
    deps.push('c');

    // Entry should be unaffected
    expect(entry.dependencies).toEqual(['a', 'b']);
    expect(entry.dependencies).not.toBe(deps);
  });

  it('cache-engine set clones dependencies', () => {
    const client = new QueryClient();
    const deps = ['x', 'y'];

    client.setQueryData(['h5', 'cache'], undefined);

    // Use cache directly to set dependencies
    const cache = (client as any)._cache;
    const entry = cache.set({
      queryKey: ['h5', 'set-deps'],
      data: { v: 1 },
      dependencies: deps,
    });

    // Mutate the original array
    deps.push('z');

    expect(entry.dependencies).toEqual(['x', 'y']);
    expect(entry.dependencies).not.toBe(deps);
  });

  it('empty dependencies stays independent', () => {
    const deps: string[] = [];
    const entry = new QueryEntry({
      queryId: 'h5-empty',
      queryKey: ['empty'],
      keyHash: 'empty',
      dependencies: deps,
    });

    deps.push('added');
    expect(entry.dependencies).toEqual([]);
  });
});
