/**
 * LifecycleManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager } from '../lifecycle-manager';

describe('LifecycleManager', () => {
  let manager: LifecycleManager;

  beforeEach(() => {
    manager = new LifecycleManager();
  });

  describe('Initial State', () => {
    it('should start in idle status', () => {
      expect(manager.getStatus()).toBe('idle');
    });

    it('should not be disposed initially', () => {
      expect(manager.isDisposed()).toBe(false);
    });

    it('should not be ready initially', () => {
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should transition from idle to initializing', () => {
      manager.setStatus('initializing');
      expect(manager.getStatus()).toBe('initializing');
    });

    it('should transition from initializing to ready', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      expect(manager.getStatus()).toBe('ready');
    });

    it('should transition from ready to persisting', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('persisting');
      expect(manager.getStatus()).toBe('persisting');
    });

    it('should transition from persisting to ready', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('persisting');
      manager.setStatus('ready');
      expect(manager.getStatus()).toBe('ready');
    });

    it('should transition from ready to restoring', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('restoring');
      expect(manager.getStatus()).toBe('restoring');
    });

    it('should transition from ready to error', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('error');
      expect(manager.getStatus()).toBe('error');
    });

    it('should transition from error to ready', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('error');
      manager.setStatus('ready');
      expect(manager.getStatus()).toBe('ready');
    });

    it('should transition to disposing then disposed', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('disposing');
      manager.setStatus('disposed');
      expect(manager.getStatus()).toBe('disposed');
      expect(manager.isDisposed()).toBe(true);
    });

    it('should transition from error to disposing', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('error');
      manager.setStatus('disposing');
      expect(manager.getStatus()).toBe('disposing');
    });

    it('should transition from idle to disposing', () => {
      manager.setStatus('disposing');
      expect(manager.getStatus()).toBe('disposing');
    });
  });

  describe('Invalid Transitions', () => {
    it('should throw for invalid transition from idle', () => {
      expect(() => manager.setStatus('persisting')).toThrow();
    });

    it('should throw for invalid transition from disposed', () => {
      manager.setStatus('initializing');
      manager.setStatus('ready');
      manager.setStatus('disposing');
      manager.setStatus('disposed');
      expect(() => manager.setStatus('ready')).toThrow();
    });

    it('should throw for invalid transition from idle to ready', () => {
      expect(() => manager.setStatus('ready')).toThrow();
    });
  });

  describe('isReady', () => {
    it('should be true only when status is ready', () => {
      expect(manager.isReady()).toBe(false);
      manager.setStatus('initializing');
      expect(manager.isReady()).toBe(false);
      manager.setStatus('ready');
      expect(manager.isReady()).toBe(true);
      manager.setStatus('persisting');
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('Event Handlers', () => {
    it('should call handler when status changes', () => {
      const handler = vi.fn();
      manager.on('status-change', handler);

      manager.setStatus('initializing');

      expect(handler).toHaveBeenCalledWith({
        type: 'status-change',
        from: 'idle',
        to: 'initializing',
      });
    });

    it('should remove handler with unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = manager.on('status-change', handler);

      unsubscribe();
      manager.setStatus('initializing');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit events for multiple transitions', () => {
      const handler = vi.fn();
      manager.on('status-change', handler);

      manager.setStatus('initializing');
      manager.setStatus('ready');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Reset', () => {
    it('should reset to idle and clear handlers', () => {
      const handler = vi.fn();
      manager.on('status-change', handler);

      manager.setStatus('initializing');
      manager.reset();

      expect(manager.getStatus()).toBe('idle');

      manager.setStatus('initializing');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
