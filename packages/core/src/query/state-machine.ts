import type { QueryRecordState } from '../types/internal.types';
import { RuntimeError } from '../errors/soulcache-error';
import { ErrorCode } from '../errors/error-codes';

/**
 * Valid state transitions map.
 *
 * Key = current state, Value = set of allowed next states.
 */
const VALID_TRANSITIONS: Record<QueryRecordState, ReadonlySet<QueryRecordState>> = {
  idle: new Set(['pending', 'invalidated', 'destroyed']),
  pending: new Set(['fetching', 'idle', 'error', 'destroyed']),
  fetching: new Set(['success', 'error', 'idle', 'destroyed']),
  success: new Set(['stale', 'fetching', 'invalidated', 'destroyed']),
  error: new Set(['pending', 'invalidated', 'destroyed']),
  stale: new Set(['fetching', 'invalidated', 'destroyed']),
  invalidated: new Set(['pending', 'destroyed']),
  destroyed: new Set(),
};

/**
 * State Transition Listener
 *
 * Called whenever the state machine transitions.
 */
export type StateTransitionListener = (
  from: QueryRecordState,
  to: QueryRecordState,
  queryId: string,
) => void;

/**
 * Query State Machine
 *
 * Manages the deterministic lifecycle of a single query.
 * All transitions are validated against an explicit transition map.
 * Invalid transitions throw typed errors.
 *
 * @example
 * ```ts
 * const sm = new QueryStateMachine('q-1');
 * sm.transition('pending');  // idle -> pending
 * sm.transition('fetching'); // pending -> fetching
 * sm.transition('success');  // fetching -> success
 * ```
 */
export class QueryStateMachine {
  private _state: QueryRecordState;
  private readonly _queryId: string;
  private readonly _listeners: Set<StateTransitionListener>;
  private _destroyed: boolean;

  constructor(queryId: string, initialState?: QueryRecordState) {
    this._queryId = queryId;
    this._state = initialState ?? 'idle';
    this._listeners = new Set();
    this._destroyed = false;
  }

  /**
   * Current state of the machine.
   */
  get state(): QueryRecordState {
    return this._state;
  }

  /**
   * The query identifier this machine manages.
   */
  get queryId(): string {
    return this._queryId;
  }

  /**
   * Whether the machine has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Attempt a state transition.
   *
   * @param to - Target state
   * @throws {RuntimeError} if transition is invalid
   */
  transition(to: QueryRecordState): void {
    if (this._destroyed && to !== 'destroyed') {
      throw new RuntimeError({
        code: ErrorCode.QUERY_DESTROYED,
        message: `Cannot transition from "${this._state}" to "${to}": machine is destroyed`,
        metadata: { queryId: this._queryId, from: this._state, to },
      });
    }

    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed || !allowed.has(to)) {
      throw new RuntimeError({
        code: ErrorCode.INVALID_TRANSITION,
        message: `Invalid transition from "${this._state}" to "${to}" for query "${this._queryId}"`,
        metadata: { queryId: this._queryId, from: this._state, to },
      });
    }

    const from = this._state;
    this._state = to;

    if (to === 'destroyed') {
      this._destroyed = true;
    }

    this.notifyListeners(from, to);
  }

  /**
   * Check if a transition is valid without executing it.
   *
   * @param to - Target state to validate
   * @returns true if the transition would succeed
   */
  canTransition(to: QueryRecordState): boolean {
    if (this._destroyed) return false;
    const allowed = VALID_TRANSITIONS[this._state];
    return allowed !== undefined && allowed.has(to);
  }

  /**
   * Subscribe to state transitions.
   *
   * @param listener - Callback invoked on each transition
   * @returns Unsubscribe function
   */
  onTransition(listener: StateTransitionListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Remove all transition listeners.
   */
  clearListeners(): void {
    this._listeners.clear();
  }

  /**
   * Destroy the machine.
   * Transitions to 'destroyed' and clears all listeners after notification.
   */
  destroy(): void {
    if (this._destroyed) return;
    this.transition('destroyed');
    this._listeners.clear();
  }

  private notifyListeners(from: QueryRecordState, to: QueryRecordState): void {
    for (const listener of this._listeners) {
      try {
        listener(from, to, this._queryId);
      } catch (_error) {
        // Listener errors must not crash the runtime.
      }
    }
  }
}
