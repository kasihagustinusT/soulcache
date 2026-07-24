import { useState, useCallback, useRef } from 'react';
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
  readonly onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: unknown) => void;
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

  const mutate = useCallback(
    (variables: TVariables) => {
      const { status } = stateRef.current;
      if (status === 'pending') return; // Prevent concurrent mutations

      let context: unknown = undefined;

      setState((prev) => ({
        ...prev,
        status: 'pending',
        variables,
      }));

      // Execute onMutate
      if (onMutate) {
        context = onMutate(variables);
      }

      client.mutate<TData, TVariables>({
        mutationId: generateId(),
        mutationFn,
        variables,
      })
        .then((data: TData) => {
          setState((prev) => ({
            ...prev,
            status: 'success',
            data,
            error: null,
          }));

          onSuccess?.(data, variables, context);
          onSettled?.(data, null, variables, context);
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err,
          }));

          onError?.(err, variables, context);
          onSettled?.(undefined, err, variables, context);
        });
    },
    [client, mutationFn, onMutate, onSuccess, onError, onSettled],
  );

  const mutateAsync = useCallback(
    (variables: TVariables): Promise<TData> => {
      return client.mutate<TData, TVariables>({
        mutationId: generateId(),
        mutationFn,
        variables,
      });
    },
    [client, mutationFn],
  );

  const reset = useCallback(() => {
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
