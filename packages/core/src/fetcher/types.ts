import type { QueryKey } from '../types/query.types';

/**
 * Response Type
 *
 * Controls how the response body is parsed.
 */
export type ResponseType = 'json' | 'text' | 'blob' | 'stream';

/**
 * Fetch Request Method
 */
export type FetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Fetch Request
 *
 * A fully-resolved request ready for execution.
 */
export interface FetchRequest {
  /** Unique request identifier */
  readonly id: string;

  /** Request URL */
  readonly url: string;

  /** HTTP method */
  readonly method: FetchMethod;

  /** Request headers */
  readonly headers: Record<string, string>;

  /** Request body (serialized) */
  readonly body?: string;

  /** AbortSignal for cancellation */
  signal?: AbortSignal;

  /** Timeout in milliseconds (0 = no timeout) */
  readonly timeout: number;

  /** Expected response type */
  readonly responseType: ResponseType;

  /** Query key that triggered this request */
  readonly queryKey: QueryKey;
}

/**
 * Fetch Options
 *
 * User-provided options for a fetch operation.
 */
export interface FetchOptions {
  /** Request URL (overrides key-based URL construction) */
  readonly url?: string;

  /** HTTP method */
  readonly method?: FetchMethod;

  /** Request headers */
  readonly headers?: Record<string, string>;

  /** Request body (will be JSON-serialized) */
  readonly body?: unknown;

  /** Timeout in milliseconds (default: 30_000) */
  readonly timeout?: number;

  /** Expected response type (default: 'json') */
  readonly responseType?: ResponseType;

  /** External AbortSignal for cancellation */
  readonly signal?: AbortSignal;

  /** Custom fetch function (default: globalThis.fetch) */
  readonly fetchFn?: typeof globalThis.fetch;
}

/**
 * Fetch Result
 *
 * The successful result of a fetch operation.
 */
export interface FetchResult<T = unknown> {
  /** Parsed response data */
  readonly data: T;

  /** HTTP status code */
  readonly status: number;

  /** Response headers */
  readonly headers: Headers;

  /** Request duration in milliseconds */
  readonly duration: number;

  /** The request that produced this result */
  readonly request: FetchRequest;
}

/**
 * Fetch Error
 *
 * Typed error from a failed fetch operation.
 */
export interface FetchError extends Error {
  /** Error category */
  readonly type: 'network' | 'timeout' | 'abort' | 'http' | 'parse';

  /** HTTP status code (for 'http' errors) */
  readonly status?: number;

  /** The original error */
  readonly cause?: Error;

  /** Request duration in milliseconds */
  readonly duration: number;

  /** Request that failed */
  readonly request: FetchRequest;
}

/**
 * Fetch Middleware
 *
 * Intercepts and modifies requests before execution.
 * Return a FetchResult to short-circuit the pipeline.
 */
export type FetchMiddleware = (
  request: FetchRequest,
  next: (request: FetchRequest) => Promise<FetchResult>,
) => Promise<FetchResult>;

/**
 * Fetch Event Types
 */
export type FetchEventType =
  | 'fetch:start'
  | 'fetch:success'
  | 'fetch:error'
  | 'fetch:retry'
  | 'fetch:dedup';

/**
 * Fetch Event
 */
export interface FetchEvent {
  /** Event type */
  readonly type: FetchEventType;

  /** Request ID */
  readonly requestId: string;

  /** Query key */
  readonly queryKey: QueryKey;

  /** Duration (for completion events) */
  readonly duration?: number;

  /** Error (for error events) */
  readonly error?: Error;

  /** Attempt number (for retry events) */
  readonly attempt?: number;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Fetcher Options
 */
export interface FetcherOptions {
  /** Default timeout in milliseconds (default: 30_000) */
  readonly defaultTimeout?: number;

  /** Default response type (default: 'json') */
  readonly defaultResponseType?: ResponseType;

  /** Custom global fetch function */
  readonly fetchFn?: typeof globalThis.fetch;

  /** Global middleware applied to all requests */
  readonly middleware?: readonly FetchMiddleware[];

  /** Event listener */
  readonly onEvent?: (event: FetchEvent) => void;
}
