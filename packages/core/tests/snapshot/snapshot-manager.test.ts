import { describe, it, expect } from 'vitest';
import { QuerySnapshotManager } from '../../src/snapshot/snapshot-manager';

describe('QuerySnapshotManager', () => {
  describe('create', () => {
    it('should create a frozen snapshot', () => {
      const manager = new QuerySnapshotManager();

      const snap = manager.create({
        queryId: 'q-1',
        queryKey: ['user', 1],
        status: 'idle',
        fetchStatus: 'idle',
      });

      expect(snap.queryId).toBe('q-1');
      expect(snap.queryKey).toEqual(['user', 1]);
      expect(snap.status).toBe('idle');
      expect(snap.fetchStatus).toBe('idle');
      expect(snap.data).toBeUndefined();
      expect(snap.error).toBeNull();
      expect(snap.version).toBe(1);
      expect(Object.isFrozen(snap)).toBe(true);
    });

    it('should increment version', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['a'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const snap2 = manager.create({
        queryId: 'q-2',
        queryKey: ['b'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      expect(snap2.version).toBe(snap1.version + 1);
    });
  });

  describe('update', () => {
    it('should create new snapshot with changes', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const { snapshot: snap2, changed } = manager.update(snap1, {
        status: 'loading',
        fetchStatus: 'fetching',
      });

      expect(changed).toBe(true);
      expect(snap2.status).toBe('loading');
      expect(snap2.fetchStatus).toBe('fetching');
      expect(snap2.version).toBe(snap2.version);
      expect(Object.isFrozen(snap2)).toBe(true);
    });

    it('should return same snapshot if no changes', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const { snapshot: snap2, changed } = manager.update(snap1, {
        status: 'idle',
        fetchStatus: 'idle',
      });

      expect(changed).toBe(false);
      expect(snap2).toBe(snap1); // Same reference
    });

    it('should update only specified fields', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const { snapshot: snap2 } = manager.update(snap1, {
        status: 'success',
      });

      expect(snap2.status).toBe('success');
      expect(snap2.fetchStatus).toBe('idle'); // unchanged
      expect(snap2.queryId).toBe('q-1'); // unchanged
    });

    it('should update data with structural sharing', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create<{ name: string }>({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const data = { name: 'Alice' };
      const { snapshot: snap2 } = manager.update(snap1, {
        data,
        status: 'success',
      });

      expect(snap2.data).toBe(data); // Same reference
      expect(snap2.data?.name).toBe('Alice');
    });

    it('should reuse unchanged field references', () => {
      const manager = new QuerySnapshotManager();

      const error = new Error('test');
      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'error',
        fetchStatus: 'idle',
        error,
      });

      const { snapshot: snap2 } = manager.update(snap1, {
        status: 'loading',
      });

      // error reference should be reused
      expect(snap2.error).toBe(error);
      // queryId reference should be reused
      expect(snap2.queryId).toBe(snap1.queryId);
    });
  });

  describe('equals', () => {
    it('should return true for identical snapshots', () => {
      const manager = new QuerySnapshotManager();

      const snap = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      expect(manager.equals(snap, snap)).toBe(true);
    });

    it('should return false for different snapshots', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const snap2 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'success',
        fetchStatus: 'idle',
      });

      expect(manager.equals(snap1, snap2)).toBe(false);
    });
  });

  describe('dataEquals', () => {
    it('should return true for same data reference', () => {
      const manager = new QuerySnapshotManager();
      const data = { name: 'Alice' };

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'success',
        fetchStatus: 'idle',
        data,
      });

      const snap2 = manager.create({
        queryId: 'q-2',
        queryKey: ['other'],
        status: 'error', // different status
        fetchStatus: 'idle',
        data, // same data
      });

      expect(manager.dataEquals(snap1, snap2)).toBe(true);
    });

    it('should return false for different data', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'success',
        fetchStatus: 'idle',
        data: 'a',
      });

      const snap2 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'success',
        fetchStatus: 'idle',
        data: 'b',
      });

      expect(manager.dataEquals(snap1, snap2)).toBe(false);
    });
  });

  describe('diff', () => {
    it('should detect all changes', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
        data: 'old',
      });

      const snap2 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'success',
        fetchStatus: 'fetching',
        data: 'new',
        error: new Error('test'),
      });

      const d = manager.diff(snap1, snap2);
      expect(d.status).toBe(true);
      expect(d.fetchStatus).toBe(true);
      expect(d.data).toBe(true);
      expect(d.error).toBe(true);
      expect(d.version).toBe(true);
    });

    it('should detect no changes', () => {
      const manager = new QuerySnapshotManager();

      const snap1 = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      const d = manager.diff(snap1, snap1);
      expect(d.status).toBe(false);
      expect(d.fetchStatus).toBe(false);
      expect(d.data).toBe(false);
      expect(d.error).toBe(false);
      expect(d.version).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should prevent mutation of snapshot', () => {
      const manager = new QuerySnapshotManager();

      const snap = manager.create({
        queryId: 'q-1',
        queryKey: ['user'],
        status: 'idle',
        fetchStatus: 'idle',
      });

      expect(() => {
        (snap as { status: string }).status = 'success';
      }).toThrow();
    });
  });
});
