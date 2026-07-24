/**
 * Errors Module
 *
 * @module errors
 */

export { ErrorCode } from './error-codes';
export type { ErrorCode as ErrorCodeType } from './error-codes';

export {
  SoulCacheError,
  ConfigurationError,
  QueryError,
  CacheError,
  RuntimeError,
} from './soulcache-error';
