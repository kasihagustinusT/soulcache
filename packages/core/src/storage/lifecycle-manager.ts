/**
 * SoulCache Lifecycle Manager
 *
 * Coordinates storage lifecycle events.
 *
 * @module storage/lifecycle-manager
 */

import type { StorageStatus } from './types';

/**
 * Lifecycle event types.
 */
export type LifecycleEvent =
  | 'status-change'
  | 'before-save'
  | 'after-save'
  | 'before-restore'
  | 'after-restore'
  | 'before-migrate'
  | 'after-migrate'
  | 'before-dispose'
  | 'after-dispose';

/**
 * Lifecycle event handler.
 */
export type LifecycleEventHandler = (event: {
  type: LifecycleEvent;
  from?: StorageStatus;
  to?: StorageStatus;
}) => void;

/**
 * Lifecycle manager.
 *
 * Manages storage status transitions and lifecycle events.
 */
export class LifecycleManager {
  /** Current status */
  private status: StorageStatus = 'idle';

  /** Event handlers */
  private readonly handlers: Map<LifecycleEvent, Set<LifecycleEventHandler>> = new Map();

  /**
   * Get current status.
   */
  getStatus(): StorageStatus {
    return this.status;
  }

  /**
   * Set status with validation.
   *
   * @param newStatus - New status
   * @throws Error if transition is invalid
   */
  setStatus(newStatus: StorageStatus): void {
    const oldStatus = this.status;

    if (!this.isValidTransition(oldStatus, newStatus)) {
      throw new Error(
        `Invalid status transition from "${oldStatus}" to "${newStatus}"`
      );
    }

    this.status = newStatus;
    this.emit('status-change', { type: 'status-change', from: oldStatus, to: newStatus });
  }

  /**
   * Check if status is ready for operations.
   */
  isReady(): boolean {
    return this.status === 'ready';
  }

  /**
   * Check if status is disposed.
   */
  isDisposed(): boolean {
    return this.status === 'disposed' || this.status === 'disposing';
  }

  /**
   * Register an event handler.
   *
   * @param event - Event type
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  on(event: LifecycleEvent, handler: LifecycleEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Emit a lifecycle event.
   *
   * @param event - Event type
   * @param data - Event data
   */
  emit(event: LifecycleEvent, data: { type: LifecycleEvent; from?: StorageStatus; to?: StorageStatus }): void {
    const handlers = this.handlers.get(event);

    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.status = 'idle';
    this.handlers.clear();
  }

  /**
   * Check if a status transition is valid.
   *
   * @param from - Current status
   * @param to - Target status
   */
  private isValidTransition(from: StorageStatus, to: StorageStatus): boolean {
    const validTransitions: Record<StorageStatus, StorageStatus[]> = {
      idle: ['initializing', 'disposing'],
      initializing: ['ready', 'error', 'disposed'],
      ready: ['persisting', 'restoring', 'migrating', 'disposing', 'error'],
      persisting: ['ready', 'error'],
      restoring: ['ready', 'error'],
      migrating: ['ready', 'error'],
      disposing: ['disposed'],
      disposed: [],
      error: ['ready', 'disposing', 'disposed'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}

/**
 * Create a LifecycleManager instance.
 */
export function createLifecycleManager(): LifecycleManager {
  return new LifecycleManager();
}
