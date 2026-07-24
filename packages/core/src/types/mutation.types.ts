import type { MutationStatus } from './query.types';

/**
 * Mutation Options
 *
 * Configuration for a mutation operation.
 */
export interface MutationOptions<TData, TVariables> {
  /** Function performing server modification */
  readonly mutationFn: (variables: TVariables) => Promise<TData>;

  /** Executed before mutation starts */
  readonly onMutate?: (variables: TVariables) => unknown;

  /** Executed after successful mutation */
  readonly onSuccess?: (data: TData, variables: TVariables) => void;

  /** Executed after mutation failure */
  readonly onError?: (error: Error, variables: TVariables) => void;

  /** Executed after success or failure */
  readonly onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
  ) => void;
}

/**
 * Mutation Result
 *
 * The result of a mutation operation.
 */
export interface MutationResult<TData> {
  /** The mutation data */
  readonly data: TData | undefined;

  /** The error if mutation failed */
  readonly error: Error | null;

  /** Current mutation status */
  readonly status: MutationStatus;

  /** Whether mutation is pending */
  readonly isPending: boolean;

  /** Whether mutation completed successfully */
  readonly isSuccess: boolean;

  /** Whether mutation encountered an error */
  readonly isError: boolean;

  /** Execute the mutation */
  readonly mutate: (variables: unknown) => void;

  /** Execute the mutation asynchronously */
  readonly mutateAsync: (variables: unknown) => Promise<TData>;

  /** Reset mutation state */
  readonly reset: () => void;
}
