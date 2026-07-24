import { describe, it, expect, vi } from 'vitest';
import { QueryStateMachine } from '../../src/query/state-machine';

describe('QueryStateMachine', () => {
  describe('construction', () => {
    it('should default to idle state', () => {
      const sm = new QueryStateMachine('q-1');
      expect(sm.state).toBe('idle');
      expect(sm.queryId).toBe('q-1');
      expect(sm.isDestroyed).toBe(false);
    });

    it('should accept initial state', () => {
      const sm = new QueryStateMachine('q-1', 'pending');
      expect(sm.state).toBe('pending');
    });
  });

  describe('valid transitions', () => {
    it('should transition idle -> pending', () => {
      const sm = new QueryStateMachine('q-1');
      sm.transition('pending');
      expect(sm.state).toBe('pending');
    });

    it('should transition idle -> invalidated', () => {
      const sm = new QueryStateMachine('q-1');
      sm.transition('invalidated');
      expect(sm.state).toBe('invalidated');
    });

    it('should transition pending -> fetching', () => {
      const sm = new QueryStateMachine('q-1', 'pending');
      sm.transition('fetching');
      expect(sm.state).toBe('fetching');
    });

    it('should transition pending -> idle', () => {
      const sm = new QueryStateMachine('q-1', 'pending');
      sm.transition('idle');
      expect(sm.state).toBe('idle');
    });

    it('should transition pending -> error', () => {
      const sm = new QueryStateMachine('q-1', 'pending');
      sm.transition('error');
      expect(sm.state).toBe('error');
    });

    it('should transition fetching -> success', () => {
      const sm = new QueryStateMachine('q-1', 'fetching');
      sm.transition('success');
      expect(sm.state).toBe('success');
    });

    it('should transition fetching -> error', () => {
      const sm = new QueryStateMachine('q-1', 'fetching');
      sm.transition('error');
      expect(sm.state).toBe('error');
    });

    it('should transition fetching -> idle', () => {
      const sm = new QueryStateMachine('q-1', 'fetching');
      sm.transition('idle');
      expect(sm.state).toBe('idle');
    });

    it('should transition success -> stale', () => {
      const sm = new QueryStateMachine('q-1', 'success');
      sm.transition('stale');
      expect(sm.state).toBe('stale');
    });

    it('should transition success -> fetching', () => {
      const sm = new QueryStateMachine('q-1', 'success');
      sm.transition('fetching');
      expect(sm.state).toBe('fetching');
    });

    it('should transition success -> invalidated', () => {
      const sm = new QueryStateMachine('q-1', 'success');
      sm.transition('invalidated');
      expect(sm.state).toBe('invalidated');
    });

    it('should transition error -> pending', () => {
      const sm = new QueryStateMachine('q-1', 'error');
      sm.transition('pending');
      expect(sm.state).toBe('pending');
    });

    it('should transition error -> invalidated', () => {
      const sm = new QueryStateMachine('q-1', 'error');
      sm.transition('invalidated');
      expect(sm.state).toBe('invalidated');
    });

    it('should transition stale -> fetching', () => {
      const sm = new QueryStateMachine('q-1', 'stale');
      sm.transition('fetching');
      expect(sm.state).toBe('fetching');
    });

    it('should transition stale -> invalidated', () => {
      const sm = new QueryStateMachine('q-1', 'stale');
      sm.transition('invalidated');
      expect(sm.state).toBe('invalidated');
    });

    it('should transition invalidated -> pending', () => {
      const sm = new QueryStateMachine('q-1', 'invalidated');
      sm.transition('pending');
      expect(sm.state).toBe('pending');
    });
  });

  describe('destroy transition from any state', () => {
    const states = ['idle', 'pending', 'fetching', 'success', 'error', 'stale', 'invalidated'] as const;

    for (const state of states) {
      it(`should transition ${state} -> destroyed`, () => {
        const sm = new QueryStateMachine('q-1', state);
        sm.transition('destroyed');
        expect(sm.state).toBe('destroyed');
        expect(sm.isDestroyed).toBe(true);
      });
    }
  });

  describe('invalid transitions', () => {
    it('should throw on idle -> success', () => {
      const sm = new QueryStateMachine('q-1');
      expect(() => sm.transition('success')).toThrow('Invalid transition');
    });

    it('should throw on idle -> fetching', () => {
      const sm = new QueryStateMachine('q-1');
      expect(() => sm.transition('fetching')).toThrow('Invalid transition');
    });

    it('should throw on idle -> error', () => {
      const sm = new QueryStateMachine('q-1');
      expect(() => sm.transition('error')).toThrow('Invalid transition');
    });

    it('should throw on pending -> success', () => {
      const sm = new QueryStateMachine('q-1', 'pending');
      expect(() => sm.transition('success')).toThrow('Invalid transition');
    });

    it('should throw on success -> idle', () => {
      const sm = new QueryStateMachine('q-1', 'success');
      expect(() => sm.transition('idle')).toThrow('Invalid transition');
    });

    it('should throw on success -> pending', () => {
      const sm = new QueryStateMachine('q-1', 'success');
      expect(() => sm.transition('pending')).toThrow('Invalid transition');
    });

    it('should throw on destroyed -> any', () => {
      const sm = new QueryStateMachine('q-1');
      sm.transition('destroyed');
      expect(() => sm.transition('idle')).toThrow('destroyed');
      expect(() => sm.transition('pending')).toThrow('destroyed');
    });

    it('should throw RuntimeError with correct code', () => {
      const sm = new QueryStateMachine('q-1');
      try {
        sm.transition('success');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('SC_INVALID_TRANSITION');
      }
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      const sm = new QueryStateMachine('q-1');
      expect(sm.canTransition('pending')).toBe(true);
      expect(sm.canTransition('invalidated')).toBe(true);
      expect(sm.canTransition('destroyed')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      const sm = new QueryStateMachine('q-1');
      expect(sm.canTransition('success')).toBe(false);
      expect(sm.canTransition('error')).toBe(false);
    });

    it('should return false after destroy', () => {
      const sm = new QueryStateMachine('q-1');
      sm.destroy();
      expect(sm.canTransition('pending')).toBe(false);
    });
  });

  describe('onTransition', () => {
    it('should notify listeners on transition', () => {
      const sm = new QueryStateMachine('q-1');
      const listener = vi.fn();

      sm.onTransition(listener);
      sm.transition('pending');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('idle', 'pending', 'q-1');
    });

    it('should support multiple listeners', () => {
      const sm = new QueryStateMachine('q-1');
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      sm.onTransition(listener1);
      sm.onTransition(listener2);
      sm.transition('pending');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const sm = new QueryStateMachine('q-1');
      const listener = vi.fn();

      const unsub = sm.onTransition(listener);
      sm.transition('pending');
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      sm.transition('fetching');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not crash on listener error', () => {
      const sm = new QueryStateMachine('q-1');
      sm.onTransition(() => {
        throw new Error('listener error');
      });

      expect(() => sm.transition('pending')).not.toThrow();
      expect(sm.state).toBe('pending');
    });
  });

  describe('full lifecycle', () => {
    it('should complete a full fetch cycle', () => {
      const sm = new QueryStateMachine('q-1');
      const transitions: string[] = [];

      sm.onTransition((from, to) => {
        transitions.push(`${from}->${to}`);
      });

      sm.transition('pending');
      sm.transition('fetching');
      sm.transition('success');

      expect(sm.state).toBe('success');
      expect(transitions).toEqual(['idle->pending', 'pending->fetching', 'fetching->success']);
    });

    it('should handle refetch cycle', () => {
      const sm = new QueryStateMachine('q-1');
      sm.transition('pending');
      sm.transition('fetching');
      sm.transition('success');
      sm.transition('stale');
      sm.transition('fetching');
      sm.transition('success');

      expect(sm.state).toBe('success');
    });

    it('should handle error recovery', () => {
      const sm = new QueryStateMachine('q-1');
      sm.transition('pending');
      sm.transition('fetching');
      sm.transition('error');
      sm.transition('pending');
      sm.transition('fetching');
      sm.transition('success');

      expect(sm.state).toBe('success');
    });
  });

  describe('clearListeners', () => {
    it('should remove all listeners', () => {
      const sm = new QueryStateMachine('q-1');
      const listener = vi.fn();

      sm.onTransition(listener);
      sm.clearListeners();
      sm.transition('pending');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should not double-destroy', () => {
      const sm = new QueryStateMachine('q-1');
      sm.destroy();
      expect(sm.isDestroyed).toBe(true);
      sm.destroy();
      expect(sm.isDestroyed).toBe(true);
    });
  });
});
