/**
 * Scheduler
 *
 * Central coordinator of runtime execution timing.
 *
 * Provides deterministic scheduling, efficient batching, stable execution
 * ordering, and predictable lifecycle management. The Scheduler is an
 * internal subsystem — not exposed directly through the public API.
 *
 * @module scheduler/scheduler
 */

import type {
  ScheduledTask,
  ScheduleTaskOptions,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from './task';
import { createTask, PRIORITY_ORDER } from './task';
import type { SchedulerEventType } from '../types/events.types';
import type { EventBus } from '../events/event-bus';
import { RuntimeError } from '../errors/soulcache-error';
import { ErrorCode } from '../errors/error-codes';
import { generateId } from '../utils/query.utils';

/** Cached priority order derived from PRIORITY_ORDER — O(1) access, no allocation per flush. */
const PRIORITY_ORDER_KEYS: readonly TaskPriority[] = (
  Object.keys(PRIORITY_ORDER) as TaskPriority[]
).sort((a, b) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b]);

/**
 * Scheduler Options
 */
export interface SchedulerOptions {
  /** Maximum tasks allowed in the queue (default: 10000) */
  maxQueueSize?: number;

  /** EventBus for scheduler events (optional) */
  eventBus?: EventBus;
}

/**
 * Scheduler Metrics
 *
 * Observability data for the Scheduler subsystem.
 */
export interface SchedulerMetrics {
  /** Total tasks scheduled since creation */
  readonly totalScheduled: number;

  /** Total tasks completed since creation */
  readonly totalCompleted: number;

  /** Total tasks failed since creation */
  readonly totalFailed: number;

  /** Total tasks cancelled since creation */
  readonly totalCancelled: number;

  /** Current number of tasks in the queue */
  readonly queueSize: number;

  /** Number of currently running tasks */
  readonly activeTaskCount: number;

  /** Number of flush cycles executed */
  readonly flushCount: number;

  /** Number of batches executed */
  readonly batchCount: number;
}

/**
 * Scheduler
 *
 * Coordinates execution timing across the SoulCache runtime.
 *
 * Responsibilities:
 * - Accept scheduled work via `schedule()`
 * - Maintain priority-based execution queues
 * - Execute tasks in deterministic order (priority → FIFO)
 * - Support batch execution with category grouping
 * - Deduplicate observer notifications within a flush cycle
 * - Provide idle execution for low-priority maintenance work
 * - Emit lifecycle events via EventBus
 * - Clean up completed/cancelled tasks
 *
 * @example
 * ```ts
 * const scheduler = new Scheduler({ eventBus });
 *
 * // Schedule a query fetch
 * const taskId = scheduler.schedule({
 *   category: 'query-execution',
 *   priority: 'high',
 *   fn: () => fetchUserData(userId),
 *   owner: 'query-runtime',
 * });
 *
 * // Schedule observer notification (auto-deduplicated within flush)
 * scheduler.schedule({
 *   category: 'observer-notification',
 *   fn: () => notifyObservers(queryHash),
 *   metadata: { queryHash },
 * });
 *
 * // Execute all pending tasks
 * scheduler.flush();
 *
 * // Cleanup
 * scheduler.destroy();
 * ```
 */
export class Scheduler {
  private readonly _tasks: Map<string, ScheduledTask> = new Map();
  private readonly _queues: Map<TaskPriority, string[]> = new Map();
  private readonly _eventBus: EventBus | undefined;
  private readonly _maxQueueSize: number;
  private _destroyed: boolean = false;
  private _flushing: boolean = false;

  // Metrics — cached counters for O(1) access
  private _totalScheduled: number = 0;
  private _totalCompleted: number = 0;
  private _totalFailed: number = 0;
  private _totalCancelled: number = 0;
  private _activeTaskCount: number = 0;
  private _flushCount: number = 0;
  private _batchCount: number = 0;

  constructor(options?: SchedulerOptions) {
    this._maxQueueSize = options?.maxQueueSize ?? 10000;
    this._eventBus = options?.eventBus;

    // Initialize priority queues
    for (const p of PRIORITY_ORDER_KEYS) {
      this._queues.set(p, []);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether the scheduler has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Number of tasks in the queue (pending + queued).
   */
  get queueSize(): number {
    let count = 0;
    for (const queue of this._queues.values()) {
      count += queue.length;
    }
    return count;
  }

  /**
   * Number of currently running tasks.
   */
  get activeTaskCount(): number {
    return this._activeTaskCount;
  }

  /**
   * Get scheduler metrics for observability.
   */
  getMetrics(): SchedulerMetrics {
    return {
      totalScheduled: this._totalScheduled,
      totalCompleted: this._totalCompleted,
      totalFailed: this._totalFailed,
      totalCancelled: this._totalCancelled,
      queueSize: this.queueSize,
      activeTaskCount: this._activeTaskCount,
      flushCount: this._flushCount,
      batchCount: this._batchCount,
    };
  }

  /**
   * Schedule a task for execution.
   *
   * The task is added to the appropriate priority queue and will be
   * executed on the next flush cycle.
   *
   * @param options - Task configuration
   * @returns The unique task ID
   * @throws {RuntimeError} if scheduler is destroyed, queue is full, fn is invalid, or circular dependency detected
   */
  schedule(options: ScheduleTaskOptions): string {
    this.assertNotDestroyed();

    // S-1: Validate fn parameter at runtime
    if (typeof options.fn !== 'function') {
      throw new RuntimeError({
        code: ErrorCode.INVALID_CONFIGURATION,
        message: 'schedule() requires a function for fn',
      });
    }

    if (this.queueSize >= this._maxQueueSize) {
      throw new RuntimeError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Scheduler queue is full (max: ${this._maxQueueSize})`,
      });
    }

    const taskId = generateId();
    const task = createTask(taskId, options);

    // A-4: Validate no circular dependencies before registering
    if (task.dependencies.length > 0) {
      if (this._hasCycle(taskId, task.dependencies)) {
        throw new RuntimeError({
          code: ErrorCode.INVALID_CONFIGURATION,
          message: `Circular dependency detected for task "${taskId}"`,
        });
      }
    }

    this._tasks.set(taskId, task);
    this._queues.get(task.priority)!.push(taskId);
    task.status = 'queued';
    this._totalScheduled++;

    this._emit('scheduler.task-registered', {
      taskId,
      category: task.category,
      priority: task.priority,
    });

    return taskId;
  }

  /**
   * Cancel a pending task.
   *
   * Running tasks cannot be cancelled. Completed/failed tasks are
   * already terminal and return false.
   *
   * @param taskId - The task to cancel
   * @returns Whether the task was successfully cancelled
   */
  cancel(taskId: string): boolean {
    this.assertNotDestroyed();

    const task = this._tasks.get(taskId);
    if (!task) return false;

    // Can only cancel pending/queued tasks
    if (task.status !== 'pending' && task.status !== 'queued') {
      return false;
    }

    // Remove from queue
    const queue = this._queues.get(task.priority);
    if (queue) {
      const index = queue.indexOf(taskId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }

    task.status = 'cancelled';
    this._totalCancelled++;

    this._emit('scheduler.task-cancelled', { taskId });

    return true;
  }

  /**
   * Get a task by ID.
   *
   * @param taskId - The task identifier
   * @returns The task, or undefined if not found
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this._tasks.get(taskId);
  }

  /**
   * Get all tasks in a given status.
   *
   * @param status - The status to filter by
   * @returns Array of matching tasks
   */
  getTasksByStatus(status: TaskStatus): ScheduledTask[] {
    const result: ScheduledTask[] = [];
    for (const task of this._tasks.values()) {
      if (task.status === status) {
        result.push(task);
      }
    }
    return result;
  }

  /**
   * Get all tasks in a given category.
   *
   * @param category - The category to filter by
   * @returns Array of matching tasks
   */
  getTasksByCategory(category: TaskCategory): ScheduledTask[] {
    const result: ScheduledTask[] = [];
    for (const task of this._tasks.values()) {
      if (task.category === category) {
        result.push(task);
      }
    }
    return result;
  }

  /**
   * Flush all pending tasks.
   *
   * Executes tasks in priority order (critical → high → normal → low → idle),
   * then FIFO within each priority level.
   *
   * Observer notification tasks are batched: for the same query hash within
   * a single flush, only the latest notification is executed.
   *
   * @returns Number of tasks executed
   */
  flush(): number {
    if (this._destroyed) return 0;
    if (this._flushing) return 0; // Prevent re-entrancy

    this._flushing = true;
    this._flushCount++;

    let executed = 0;
    let batchFailed = 0;

    try {
      // Collect all queued task IDs in priority order
      const taskIds = this._collectQueuedTasks();

      // Apply batching: deduplicate observer notifications
      const batched = this._applyBatching(taskIds);

      this._batchCount++;

      this._emit('scheduler.batch-started', {
        taskCount: batched.length,
      });

      // Execute each task
      for (const taskId of batched) {
        const task = this._tasks.get(taskId);
        if (!task || task.status !== 'queued') continue;

        // Check dependencies
        if (!this._dependenciesMet(task)) {
          // Re-queue at the end of its priority level
          this._queues.get(task.priority)!.push(taskId);
          continue;
        }

        this._executeTask(task);
        executed++;

        // R-2: Track batch-specific failure count
        // Note: _executeTask mutates task.status; TypeScript cannot track this
        if ((task.status as TaskStatus) === 'failed') {
          batchFailed++;
        }
      }

      this._emit('scheduler.batch-completed', {
        executed,
        failed: batchFailed,
      });
    } finally {
      this._flushing = false;
      this._cleanupCompletedTasks();
    }

    return executed;
  }

  /**
   * Flush tasks of a specific category.
   *
   * Non-matching tasks are re-queued to their original priority levels.
   *
   * @param category - The category to flush
   * @returns Number of tasks executed
   */
  flushCategory(category: TaskCategory): number {
    if (this._destroyed) return 0;
    if (this._flushing) return 0;

    this._flushing = true;
    let executed = 0;

    try {
      const taskIds = this._collectQueuedTasks();

      // A-2: Re-queue non-matching tasks before executing
      for (const taskId of taskIds) {
        const task = this._tasks.get(taskId);
        if (!task || task.category !== category) {
          // Re-queue this task to its original priority level
          if (task && (task.status === 'queued' || task.status === 'pending')) {
            this._queues.get(task.priority)!.push(taskId);
          }
          continue;
        }
      }

      // Now collect only the matching tasks for execution
      const categoryIds: string[] = [];
      for (const taskId of taskIds) {
        const task = this._tasks.get(taskId);
        if (task && task.category === category && task.status === 'queued') {
          categoryIds.push(taskId);
        }
      }

      for (const taskId of categoryIds) {
        const task = this._tasks.get(taskId);
        if (!task || task.status !== 'queued') continue;

        if (!this._dependenciesMet(task)) {
          this._queues.get(task.priority)!.push(taskId);
          continue;
        }

        this._executeTask(task);
        executed++;
      }
    } finally {
      this._flushing = false;
      this._cleanupCompletedTasks();
    }

    return executed;
  }

  /**
   * Flush idle tasks only.
   *
   * Executes tasks with 'idle' priority. Used for maintenance work
   * that should never block critical execution.
   * Non-idle tasks are re-queued to their original priority levels.
   *
   * @returns Number of tasks executed
   */
  flushIdle(): number {
    if (this._destroyed) return 0;
    if (this._flushing) return 0;

    this._flushing = true;
    let executed = 0;

    try {
      const taskIds = this._collectQueuedTasks();

      // A-3: Re-queue non-idle tasks before executing
      for (const taskId of taskIds) {
        const task = this._tasks.get(taskId);
        if (!task || task.priority !== 'idle') {
          // Re-queue this task to its original priority level
          if (task && (task.status === 'queued' || task.status === 'pending')) {
            this._queues.get(task.priority)!.push(taskId);
          }
          continue;
        }
      }

      // Now collect only idle tasks for execution
      const idleIds: string[] = [];
      for (const taskId of taskIds) {
        const task = this._tasks.get(taskId);
        if (task && task.priority === 'idle' && task.status === 'queued') {
          idleIds.push(taskId);
        }
      }

      for (const taskId of idleIds) {
        const task = this._tasks.get(taskId);
        if (!task || task.status !== 'queued') continue;

        if (!this._dependenciesMet(task)) {
          this._queues.get(task.priority)!.push(taskId);
          continue;
        }

        this._executeTask(task);
        executed++;
      }
    } finally {
      this._flushing = false;
      this._cleanupCompletedTasks();
    }

    return executed;
  }

  /**
   * Release all scheduler resources.
   *
   * After destruction, all operations throw.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Cancel all queued tasks
    for (const queue of this._queues.values()) {
      for (const taskId of queue) {
        const task = this._tasks.get(taskId);
        if (task && (task.status === 'pending' || task.status === 'queued')) {
          task.status = 'cancelled';
          this._totalCancelled++;
        }
      }
      queue.length = 0;
    }

    this._tasks.clear();
    this._emit('scheduler.destroyed', {});
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new RuntimeError({
        code: ErrorCode.ALREADY_DESTROYED,
        message: 'Scheduler has been destroyed',
      });
    }
  }

  /**
   * Collect all queued task IDs in priority order (critical → idle),
   * preserving FIFO within each priority level.
   */
  private _collectQueuedTasks(): string[] {
    const result: string[] = [];

    for (const p of PRIORITY_ORDER_KEYS) {
      const queue = this._queues.get(p);
      if (queue) {
        result.push(...queue);
        queue.length = 0; // Clear the queue as we collect
      }
    }

    return result;
  }

  /**
   * Apply batch deduplication.
   *
   * For observer-notification tasks with the same metadata.queryHash,
   * only the last one is kept (most recent notification wins).
   */
  private _applyBatching(taskIds: string[]): string[] {
    const result: string[] = [];
    const observerSeen = new Map<string, string>(); // queryHash → taskId

    for (const taskId of taskIds) {
      const task = this._tasks.get(taskId);
      if (!task) continue;

      // Deduplicate observer notifications by queryHash
      if (task.category === 'observer-notification') {
        const queryHash = task.metadata['queryHash'] as string | undefined;
        if (queryHash) {
          const existing = observerSeen.get(queryHash);
          if (existing) {
            // Cancel the previous notification
            const prevTask = this._tasks.get(existing);
            if (prevTask && prevTask.status === 'queued') {
              prevTask.status = 'cancelled';
              this._totalCancelled++;
            }
          }
          observerSeen.set(queryHash, taskId);
        }
      }

      result.push(taskId);
    }

    return result;
  }

  /**
   * Check if all dependencies of a task have completed.
   */
  private _dependenciesMet(task: ScheduledTask): boolean {
    for (const depId of task.dependencies) {
      const dep = this._tasks.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * A-4: Detect circular dependencies by traversing the dependency graph.
   *
   * @param taskId - The task ID being registered
   * @param dependencies - The dependency IDs to check
   * @returns Whether a cycle exists
   */
  private _hasCycle(taskId: string, dependencies: readonly string[]): boolean {
    const visited = new Set<string>();
    const stack = [...dependencies];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === taskId) {
        return true; // Cycle detected
      }

      if (visited.has(current)) continue;
      visited.add(current);

      const depTask = this._tasks.get(current);
      if (depTask) {
        for (const dep of depTask.dependencies) {
          stack.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Execute a single task.
   */
  private _executeTask(task: ScheduledTask): void {
    task.status = 'running';
    this._activeTaskCount++;

    this._emit('scheduler.task-started', {
      taskId: task.id,
      category: task.category,
    });

    try {
      const result = task.fn();

      // Handle async tasks
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<void>)
          .then(() => {
            this._completeTask(task);
          })
          .catch((error: unknown) => {
            this._failTask(task, error instanceof Error ? error : new Error(String(error)));
          });
      } else {
        // Synchronous completion
        this._completeTask(task);
      }
    } catch (error) {
      this._failTask(task, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Mark a task as completed.
   *
   * R-1: Guards against completion after destroy().
   */
  private _completeTask(task: ScheduledTask): void {
    // R-1: If scheduler was destroyed while async task was in-flight, silently drop
    if (this._destroyed) return;

    task.status = 'completed';
    task.completedAt = Date.now();
    this._totalCompleted++;
    this._activeTaskCount--;

    this._emit('scheduler.task-completed', {
      taskId: task.id,
      category: task.category,
      duration: task.completedAt - (task.startedAt ?? task.createdAt),
    });
  }

  /**
   * Mark a task as failed.
   *
   * R-1: Guards against failure after destroy().
   */
  private _failTask(task: ScheduledTask, error: Error): void {
    // R-1: If scheduler was destroyed while async task was in-flight, silently drop
    if (this._destroyed) return;

    task.status = 'failed';
    task.completedAt = Date.now();
    task.error = error;
    this._totalFailed++;
    this._activeTaskCount--;

    this._emit('scheduler.task-failed', {
      taskId: task.id,
      category: task.category,
      error: error.message,
    });
  }

  /**
   * Clean up completed and cancelled tasks that are no longer needed.
   */
  private _cleanupCompletedTasks(): void {
    const toRemove: string[] = [];

    for (const [id, task] of this._tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this._tasks.delete(id);
    }
  }

  /**
   * Emit a scheduler event via the EventBus.
   *
   * A-1: Uses the full SchedulerEventType union for type-safe event emission.
   */
  private _emit(type: SchedulerEventType, payload: Record<string, unknown>): void {
    if (!this._eventBus) return;

    this._eventBus.emit({
      type,
      source: 'scheduler',
      payload,
    });
  }
}
