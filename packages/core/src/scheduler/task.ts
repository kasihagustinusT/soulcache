/**
 * Scheduler Task Types
 *
 * Defines the task model used by the Scheduler subsystem.
 *
 * @module scheduler/task
 */

/**
 * Task Category
 *
 * Identifies the subsystem that owns the task.
 * Used for batch grouping and execution strategy.
 */
export type TaskCategory =
  | 'query-execution'
  | 'mutation-execution'
  | 'cache-update'
  | 'cache-cleanup'
  | 'observer-notification'
  | 'event-dispatch'
  | 'persistence'
  | 'plugin-hook'
  | 'internal-maintenance';

/**
 * Task Priority
 *
 * Determines execution order. Lower numeric value = higher priority.
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'idle';

/**
 * Task Status
 *
 * Lifecycle states for a scheduled task.
 */
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Priority to numeric mapping for O(1) comparison.
 */
export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  idle: 4,
};

/**
 * Scheduled Task
 *
 * Internal representation of a task registered with the Scheduler.
 */
export interface ScheduledTask {
  /** Unique task identifier */
  readonly id: string;

  /** Owning subsystem identifier */
  readonly owner: string;

  /** Task category for batch grouping */
  readonly category: TaskCategory;

  /** Execution priority */
  readonly priority: TaskPriority;

  /** Current lifecycle status */
  status: TaskStatus;

  /** The function to execute */
  readonly fn: () => void | Promise<void>;

  /** Task IDs that must complete before this task runs */
  readonly dependencies: readonly string[];

  /** Additional metadata */
  readonly metadata: Record<string, unknown>;

  /** Creation timestamp */
  readonly createdAt: number;

  /** Start timestamp (set when execution begins) */
  startedAt: number | undefined;

  /** Completion timestamp */
  completedAt: number | undefined;

  /** Failure reason (if status is 'failed') */
  error: Error | undefined;
}

/**
 * Options for creating a new scheduled task.
 */
export interface ScheduleTaskOptions {
  /** Task category */
  category: TaskCategory;

  /** Execution priority (default: 'normal') */
  priority?: TaskPriority;

  /** The function to execute */
  fn: () => void | Promise<void>;

  /** Owning subsystem identifier (default: 'internal') */
  owner?: string;

  /** Task IDs that must complete before this task runs */
  dependencies?: readonly string[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a ScheduledTask from options.
 *
 * @param id - Unique task identifier
 * @param options - Task creation options
 * @returns A new ScheduledTask
 */
export function createTask(id: string, options: ScheduleTaskOptions): ScheduledTask {
  return {
    id,
    owner: options.owner ?? 'internal',
    category: options.category,
    priority: options.priority ?? 'normal',
    status: 'pending',
    fn: options.fn,
    dependencies: options.dependencies ?? [],
    metadata: options.metadata ?? {},
    createdAt: Date.now(),
    startedAt: undefined,
    completedAt: undefined,
    error: undefined,
  };
}
