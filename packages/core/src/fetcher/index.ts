/**
 * Fetcher Module
 *
 * Provides the fetch pipeline: request construction, abort management,
 * timeout enforcement, deduplication, response handling, and error classification.
 *
 * @module fetcher
 */

export { Fetcher } from './fetcher';
export type {
  FetchRequest,
  FetchResult,
  FetchOptions,
  FetchError,
  FetchMiddleware,
  FetchEvent,
  FetchEventType,
  FetcherOptions,
  ResponseType,
  FetchMethod,
} from './types';
