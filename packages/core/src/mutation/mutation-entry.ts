import type { MutationStatus } from '../types/query.types';

/**
 * Mutation Entry Options
 */
export interface MutationEntryOptions<TData = unknown, TVariables = unknown> {
  /** Unique mutation identifier */
  readonly mutationId: string;

  /** Mutation function */
  readonly mutationFn: (variables: TVariables) => Promise<TData>;

  /** Variables passed to mutation */
  readonly variables?: TVariables;

  /** Callback before mutation starts */
  readonly onMutate?: (variables: TVariables) => unknown;

  /** Callback after successful mutation */
  readonly onSuccess?: (data: TData, variables: TVariables) => void;

  /** Callback after mutation failure */
  readonly onError?: (error: Error, variables: TVariables) => void;

  /** Callback after mutation settles (success or error) */
  readonly onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void;
}

/**
 * Mutation Entry
 *
 * Represents a single mutation execution with full lifecycle tracking.
 * Manages state transitions, callbacks, and optimistic update rollback data.
 *
 * @example
 * ```ts
 * const entry = new MutationEntry({
 *   mutationId: 'mut-1',
 *   mutationFn: async (vars) => {
 *     const res = await fetch('/api/users', { method: 'POST', body: JSON.stringify(vars) });
 *     return res.json();
 *   },
 * });
 *
 * entry.mutate({ name: 'Alice' });
 * ```
 */
export class MutationEntry<TData = unknown, TVariables = unknown> {
  private readonly _id: string;
  private readonly _mutationFn: (variables: TVariables) => Promise<TData>;
  private readonly _onMutateFn: ((variables: TVariables) => unknown) | undefined;
  private readonly _onSuccessFn: ((data: TData, variables: TVariables) => void) | undefined;
  private readonly _onErrorFn: ((error: Error, variables: TVariables) => void) | undefined;
  private readonly _onSettledFn: ((
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void) | undefined;
  private _variables: TVariables | undefined;
  private _data: TData | undefined;
  private _error: Error | null;
  private _status: MutationStatus;
  private _context: unknown;
  private _retryCount: number;
  private _createdAt: number;
  private _updatedAt: number;
  private _destroyed: boolean;
  private _abortController: AbortController | null;
  private _listeners: Set<() => void>;

  constructor(options: MutationEntryOptions<TData, TVariables>) {
    this._id = options.mutationId;
    this._mutationFn = options.mutationFn;
    this._onMutateFn = options.onMutate;
    this._onSuccessFn = options.onSuccess;
    this._onErrorFn = options.onError;
    this._onSettledFn = options.onSettled;
    this._variables = options.variables;
    this._data = undefined;
    this._error = null;
    this._status = 'idle';
    this._context = undefined;
    this._retryCount = 0;
    this._createdAt = Date.now();
    this._updatedAt = Date.now();
    this._destroyed = false;
    this._abortController = null;
    this._listeners = new Set();
  }

  /**
   * Unique mutation identifier.
   */
  get id(): string {
    return this._id;
  }

  /**
   * Current mutation status.
   */
  get status(): MutationStatus {
    return this._status;
  }

  /**
   * Mutation result data.
   */
  get data(): TData | undefined {
    return this._data;
  }

  /**
   * Mutation error if failed.
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * Current variables.
   */
  get variables(): TVariables | undefined {
    return this._variables;
  }

  /**
   * Optimistic update context from onMutate.
   */
  get context(): unknown {
    return this._context;
  }

  /**
   * Number of retry attempts.
   */
  get retryCount(): number {
    return this._retryCount;
  }

  /**
   * Creation timestamp.
   */
  get createdAt(): number {
    return this._createdAt;
  }

  /**
   * Last update timestamp.
   */
  get updatedAt(): number {
    return this._updatedAt;
  }

  /**
   * Whether mutation is pending.
   */
  get isPending(): boolean {
    return this._status === 'pending';
  }

  /**
   * Whether mutation succeeded.
   */
  get isSuccess(): boolean {
    return this._status === 'success';
  }

  /**
   * Whether mutation failed.
   */
  get isError(): boolean {
    return this._status === 'error';
  }

  /**
   * Whether mutation has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Subscribe to mutation state changes.
   *
   * @param listener - Function called on state change
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    if (this._destroyed) {
      return () => {};
    }

    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Execute the mutation.
   *
   * Manages the full lifecycle: onMutate → mutationFn → onSuccess/onError → onSettled
   *
   * @param variables - Mutation variables
   * @returns Mutation result
   */
  async mutate(variables: TVariables): Promise<TData> {
    this.assertNotDestroyed();

    // Cancel any in-flight mutation
    this.cancel();

    this._variables = variables;
    this._status = 'pending';
    this._updatedAt = Date.now();
    this._abortController = new AbortController();

    this.notifyListeners();

    try {
      // Execute onMutate for optimistic updates
      if (this._onMutateFn) {
        this._context = this._onMutateFn(variables);
      }

      // Execute mutation with abort awareness
      const signal = this._abortController.signal;
      const data = await new Promise<TData>((resolve, reject) => {
        // Listen for abort
        const onAbort = () => {
          reject(new Error('Mutation cancelled'));
        };
        signal.addEventListener('abort', onAbort, { once: true });

        this._mutationFn(variables).then(
          (value) => {
            signal.removeEventListener('abort', onAbort);
            resolve(value);
          },
          (err) => {
            signal.removeEventListener('abort', onAbort);
            reject(err);
          },
        );
      });

      this._data = data;
      this._error = null;
      this._status = 'success';
      this._updatedAt = Date.now();

      this.notifyListeners();

      // Execute callbacks
      this._onSuccessFn?.(data, variables);
      this._onSettledFn?.(data, null, variables);

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Don't update state if cancelled
      if (this._abortController?.signal.aborted && err.message === 'Mutation cancelled') {
        throw err;
      }

      this._error = err;
      this._status = 'error';
      this._updatedAt = Date.now();

      this.notifyListeners();

      // Execute callbacks
      this._onErrorFn?.(err, variables);
      this._onSettledFn?.(undefined, err, variables);

      throw err;
    } finally {
      this._abortController = null;
    }
  }

  /**
   * Execute mutation with retry logic.
   *
   * @param variables - Mutation variables
   * @param maxRetries - Maximum number of retries
   * @param retryDelay - Delay between retries in ms
   * @returns Mutation result
   */
  async mutateWithRetry(
    variables: TVariables,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<TData> {
    this._retryCount = 0;
    let lastError: Error | undefined;

    while (this._retryCount <= maxRetries) {
      try {
        return await this.mutate(variables);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this._retryCount++;

        if (this._retryCount <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Cancel an in-flight mutation.
   */
  cancel(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Reset mutation state to idle.
   */
  reset(): void {
    this.assertNotDestroyed();

    this._data = undefined;
    this._error = null;
    this._status = 'idle';
    this._context = undefined;
    this._retryCount = 0;
    this._updatedAt = Date.now();

    this.notifyListeners();
  }

  /**
   * Destroy the mutation entry.
   * Cancels any in-flight mutation and clears all listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.cancel();
    this._listeners.clear();
  }

  /**
   * Get current snapshot of mutation state.
   */
  getSnapshot(): {
    readonly status: MutationStatus;
    readonly data: TData | undefined;
    readonly error: Error | null;
    readonly variables: TVariables | undefined;
    readonly context: unknown;
    readonly isPending: boolean;
    readonly isSuccess: boolean;
    readonly isError: boolean;
  } {
    return {
      status: this._status,
      data: this._data,
      error: this._error,
      variables: this._variables,
      context: this._context,
      isPending: this._status === 'pending',
      isSuccess: this._status === 'success',
      isError: this._status === 'error',
    };
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('MutationEntry has been destroyed');
    }
  }

  private notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (_error) {
        // Listener errors must not crash the runtime.
      }
    }
  }
}
