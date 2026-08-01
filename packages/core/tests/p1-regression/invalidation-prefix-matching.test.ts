import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('invalidateQueries uses structural query-key prefix matching', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  it('should invalidate exact key match', async () => {
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['users', 2], { id: 2 });
    client.setQueryData(['posts'], { title: 'hello' });

    await client.invalidateQueries(['users', 1]);

    const sm1 = client.getCache().get(['users', 1]);
    const sm2 = client.getCache().get(['users', 2]);
    const sm3 = client.getCache().get(['posts']);

    expect(sm1?.status).toBe('invalidated');
    expect(sm2?.status).not.toBe('invalidated');
    expect(sm3?.status).not.toBe('invalidated');
  });

  it('should invalidate parent prefix matching child keys', async () => {
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['users', 2], { id: 2 });
    client.setQueryData(['users', 'profile'], { name: 'Alice' });
    client.setQueryData(['posts'], { title: 'hello' });

    await client.invalidateQueries(['users']);

    const entry1 = client.getCache().get(['users', 1]);
    const entry2 = client.getCache().get(['users', 2]);
    const entryProfile = client.getCache().get(['users', 'profile']);
    const entryPosts = client.getCache().get(['posts']);

    expect(entry1?.status).toBe('invalidated');
    expect(entry2?.status).toBe('invalidated');
    expect(entryProfile?.status).toBe('invalidated');
    expect(entryPosts?.status).not.toBe('invalidated');
  });

  it('should invalidate multiple child queries under same parent', async () => {
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['users', 2], { id: 2 });
    client.setQueryData(['users', 3], { id: 3 });

    await client.invalidateQueries(['users']);

    expect(client.getCache().get(['users', 1])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', 2])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', 3])?.status).toBe('invalidated');
  });

  it('should NOT invalidate unrelated queries', async () => {
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['posts', 1], { id: 1 });
    client.setQueryData(['comments'], []);

    await client.invalidateQueries(['users']);

    expect(client.getCache().get(['users', 1])?.status).toBe('invalidated');
    expect(client.getCache().get(['posts', 1])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['comments'])?.status).not.toBe('invalidated');
  });

  it('should NOT match similar string prefix (false positive prevention)', async () => {
    // Old hash-prefix implementation would match ['users'] when invalidating ['user']
    // because JSON.stringify(['user']) = '["user"]' and JSON.stringify(['users']) = '["users"]'
    // and '["users"]'.startsWith('["user"') === true (off-by-one with .slice(0,-1))
    client.setQueryData(['user'], { name: 'Alice' });
    client.setQueryData(['users'], [{ id: 1 }]);
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['user-settings'], { theme: 'dark' });
    client.setQueryData(['users', 'settings'], { lang: 'en' });

    await client.invalidateQueries(['user']);

    expect(client.getCache().get(['user'])?.status).toBe('invalidated');
    // These must NOT be invalidated — they are not children of ['user']
    expect(client.getCache().get(['users'])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['users', 1])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['user-settings'])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['users', 'settings'])?.status).not.toBe('invalidated');
  });

  it('should NOT match similar-but-not-equal string prefix', async () => {
    client.setQueryData(['user-settings'], { theme: 'dark' });
    client.setQueryData(['users', 'settings'], { lang: 'en' });

    await client.invalidateQueries(['user-settings']);

    expect(client.getCache().get(['user-settings'])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', 'settings'])?.status).not.toBe('invalidated');
  });

  it('should match all entries when invalidating empty key', async () => {
    client.setQueryData(['users', 1], { id: 1 });
    client.setQueryData(['posts'], { title: 'hello' });
    client.setQueryData(['a', 'b', 'c'], 'deep');

    await client.invalidateQueries([]);

    expect(client.getCache().get(['users', 1])?.status).toBe('invalidated');
    expect(client.getCache().get(['posts'])?.status).toBe('invalidated');
    expect(client.getCache().get(['a', 'b', 'c'])?.status).toBe('invalidated');
  });

  it('should match nested object segments using deep equality', async () => {
    client.setQueryData(['users', { page: 1 }], { data: 'page1' });
    client.setQueryData(['users', { page: 2 }], { data: 'page2' });
    client.setQueryData(['users', { name: 'Alice' }], { data: 'alice' });

    await client.invalidateQueries(['users', { page: 1 }]);

    expect(client.getCache().get(['users', { page: 1 }])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', { page: 2 }])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['users', { name: 'Alice' }])?.status).not.toBe('invalidated');
  });

  it('should match nested array segments using deep equality', async () => {
    client.setQueryData(['users', ['a']], { data: 'a' });
    client.setQueryData(['users', ['a'], 'b'], { data: 'ab' });
    client.setQueryData(['users', ['c']], { data: 'c' });

    await client.invalidateQueries(['users', ['a']]);

    expect(client.getCache().get(['users', ['a']])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', ['a'], 'b'])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', ['c']])?.status).not.toBe('invalidated');
  });

  it('should match exact multi-segment key without false positives', async () => {
    client.setQueryData(['users', 1, 'profile'], { name: 'Alice' });
    client.setQueryData(['users', 1, 'settings'], { theme: 'dark' });
    client.setQueryData(['users', 2, 'profile'], { name: 'Bob' });

    await client.invalidateQueries(['users', 1, 'profile']);

    expect(client.getCache().get(['users', 1, 'profile'])?.status).toBe('invalidated');
    expect(client.getCache().get(['users', 1, 'settings'])?.status).not.toBe('invalidated');
    expect(client.getCache().get(['users', 2, 'profile'])?.status).not.toBe('invalidated');
  });
});
