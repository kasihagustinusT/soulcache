import { useState, useCallback, useRef, useEffect } from 'react';
import { useSoulCacheContext } from './context';
import { generateId } from '@soulcache/core';
import type { MutationStatus } from '@soulcache/core';

/**
 * Result of the useMutation hook.
 */
export interface MutationResult<TData, TVariables> {
  /** Current mutation data */
  readonly data: TData | undefined;
  /** Current error if any */
  readonly error: Error | null;
  /** Mutation status */
  readonly status: MutationStatus;
  /** Whether the mutation is currently pending */
  readonly isPending: boolean;
  /** Whether the mutation has succeeded */
  readonly isSuccess: boolean;
  /** Whether the mutation has errored */
  readonly isError: boolean;
  /** Whether the mutation is idle */
  readonly isIdle: boolean;
  /** The mutate function */
  readonly mutate: (variables: TVariables) => void;
  /** The mutate function returning a promise */
  readonly mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Reset mutation state */
  readonly reset: () => void;
}

/**
 * Options for the useMutation hook.
 */
export interface UseMutationOptions<TData, TVariables> {
  /** Mutation function */
  readonly mutationFn: (variables: TVariables) => Promise<TData>;
  /** Callback before mutation starts (for optimistic updates) */
  readonly onMutate?: (variables: TVariables) => unknown;
  /** Callback after successful mutation */
  readonly onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  /** Callback after mutation failure */
  readonly onError?: (error: Error, variables: TVariables, context: unknown) => void;
  /** Callback after mutation settles */
  readonly onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: unknown,
  ) => void;
}

/**
 * useMutation
 *
 * Hook for executing mutations with state tracking.
 * The mutation state is tracked via local React state, not via the Core Runtime's
 * MutationObserver (which would introduce unnecessary complexity for single-component
 * mutation tracking). The actual execution still goes through QueryClient.mutate().
 *
 * @example
 * ```tsx
 * function CreateUserForm() {
 *   const { mutate, isPending, isSuccess, error } = useMutation({
 *     mutationFn: (userData) => createUser(userData),
 *     onSuccess: () => {
 *       // Invalidate queries to refetch
 *     },
 *   });
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       mutate({ name: 'Alice' });
 *     }}>
 *       {isPending && <Spinner />}
 *       {isSuccess && <p>User created!</p>}
 *       {error && <ErrorMessage error={error} />}
 *       <button type="submit">Create</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useMutation<TData, TVariables = void>(
  options: UseMutationOptions<TData, TVariables>,
): MutationResult<TData, TVariables> {
  const client = useSoulCacheContext();
  const { mutationFn, onMutate, onSuccess, onError, onSettled } = options;

  const [state, setState] = useState<{
    status: MutationStatus;
    data: TData | undefined;
    error: Error | null;
    variables: TVariables | undefined;
    context: unknown;
  }>({
    status: 'idle',
    data: undefined,
    error: null,
    variables: undefined,
    context: undefined,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const isPendingRef = useRef(false);

  // Track mount state to prevent setState after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    (variables: TVariables) => {
      if (isPendingRef.current) return; // Prevent concurrent mutations

      let context: unknown = undefined;

      isPendingRef.current = true;
      setState((prev) => ({
        ...prev,
        status: 'pending',
        variables,
      }));

      // Wrap onMutate in try-catch so a throw is captured as a mutation error
      try {
        if (onMutate) {
          context = onMutate(variables);
        }
      } catch (onMutateError) {
        const err =
          onMutateError instanceof Error ? onMutateError : new Error(String(onMutateError));
        // Only setState if the hook is still mounted
        if (isMountedRef.current) {
          isPendingRef.current = false;
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err,
          }));
        }
        // Do NOT call onError/onSettled — the mutation never executed
        return;
      }

      client
        .mutate<TData, TVariables>({
          mutationId: generateId(),
          mutationFn,
          variables,
        })
        .then((data: TData) => {
          // Only setState if the hook is still mounted
          if (isMountedRef.current) {
            isPendingRef.current = false;
            setState((prev) => ({
              ...prev,
              status: 'success',
              data,
              error: null,
            }));
          }

          // Wrap callbacks in try-catch so a callback throw does not cascade to .catch()
          try {
            onSuccess?.(data, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
          try {
            onSettled?.(data, null, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          // Only setState if the hook is still mounted
          if (isMountedRef.current) {
            isPendingRef.current = false;
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: err,
            }));
          }

          try {
            onError?.(err, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
          try {
            onSettled?.(undefined, err, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
        });
    },
    [client, mutationFn, onMutate, onSuccess, onError, onSettled],
  );

  const mutateAsync = useCallback(
    (variables: TVariables): Promise<TData> => {
      if (isPendingRef.current) {
        return Promise.reject(new Error('Mutation already in progress'));
      }

      let context: unknown = undefined;

      isPendingRef.current = true;
      setState((prev) => ({
        ...prev,
        status: 'pending',
        variables,
      }));

      // Wrap onMutate in try-catch so a throw is captured as a mutation error
      try {
        if (onMutate) {
          context = onMutate(variables);
        }
      } catch (onMutateError) {
        const err =
          onMutateError instanceof Error ? onMutateError : new Error(String(onMutateError));
        // Only setState if the hook is still mounted
        if (isMountedRef.current) {
          isPendingRef.current = false;
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err,
          }));
        }
        // Do NOT call onError/onSettled — the mutation never executed
        return Promise.reject(err);
      }

      return client
        .mutate<TData, TVariables>({
          mutationId: generateId(),
          mutationFn,
          variables,
        })
        .then((data: TData) => {
          // Only setState if the hook is still mounted
          if (isMountedRef.current) {
            isPendingRef.current = false;
            setState((prev) => ({
              ...prev,
              status: 'success',
              data,
              error: null,
            }));
          }

          // Wrap callbacks in try-catch so a callback throw does not cascade to .catch()
          try {
            onSuccess?.(data, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
          try {
            onSettled?.(data, null, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }

          return data;
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));

          // Only setState if the hook is still mounted
          if (isMountedRef.current) {
            isPendingRef.current = false;
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: err,
            }));
          }

          try {
            onError?.(err, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }
          try {
            onSettled?.(undefined, err, variables, context);
          } catch (_e) {
            /* callback error must not corrupt mutation state */
          }

          throw err;
        });
    },
    [client, mutationFn, onMutate, onSuccess, onError, onSettled],
  );

  const reset = useCallback(() => {
    isPendingRef.current = false;
    setState({
      status: 'idle',
      data: undefined,
      error: null,
      variables: undefined,
      context: undefined,
    });
  }, []);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isPending: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isIdle: state.status === 'idle',
    mutate,
    mutateAsync,
    reset,
  };
}
