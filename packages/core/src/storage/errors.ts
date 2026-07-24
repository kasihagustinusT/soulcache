/**
 * SoulCache Storage Errors
 *
 * Error classes and utilities for the Storage Layer.
 *
 * @module storage/errors
 */

import type { StorageError, StorageErrorType } from './types';

/**
 * Base storage error class.
 *
 * All storage-related errors extend this class.
 */
export class SoulCacheStorageError extends Error {
  /** Storage error type */
  readonly storageErrorType: StorageErrorType;

  /** Optional key involved in the error */
  readonly key?: string | undefined;

  /** Original error cause */
  readonly storageCause?: Error | undefined;

  constructor(
    type: StorageErrorType,
    message: string,
    options?: { key?: string; cause?: Error }
  ) {
    super(message);
    this.name = 'SoulCacheStorageError';
    this.storageErrorType = type;
    this.key = options?.key;
    this.storageCause = options?.cause;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, SoulCacheStorageError.prototype);
  }

  /**
   * Convert to StorageError interface.
   */
  toStorageError(): StorageError {
    return {
      type: this.storageErrorType,
      message: this.message,
      key: this.key,
      cause: this.storageCause,
    };
  }
}

/**
 * Serialization error.
 */
export class SerializationError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('serialization_failed', message, options);
    this.name = 'SerializationError';
    Object.setPrototypeOf(this, SerializationError.prototype);
  }
}

/**
 * Deserialization error.
 */
export class DeserializationError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('deserialization_failed', message, options);
    this.name = 'DeserializationError';
    Object.setPrototypeOf(this, DeserializationError.prototype);
  }
}

/**
 * Provider error.
 */
export class ProviderError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('provider_error', message, options);
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * Migration error.
 */
export class MigrationError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('migration_failed', message, options);
    this.name = 'MigrationError';
    Object.setPrototypeOf(this, MigrationError.prototype);
  }
}

/**
 * Validation error.
 */
export class ValidationError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('validation_failed', message, options);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Corrupted data error.
 */
export class CorruptedDataError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('corrupted_data', message, options);
    this.name = 'CorruptedDataError';
    Object.setPrototypeOf(this, CorruptedDataError.prototype);
  }
}

/**
 * Checksum mismatch error.
 */
export class ChecksumMismatchError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('checksum_mismatch', message, options);
    this.name = 'ChecksumMismatchError';
    Object.setPrototypeOf(this, ChecksumMismatchError.prototype);
  }
}

/**
 * Unknown algorithm error.
 */
export class UnknownAlgorithmError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('unknown_algorithm', message, options);
    this.name = 'UnknownAlgorithmError';
    Object.setPrototypeOf(this, UnknownAlgorithmError.prototype);
  }
}

/**
 * Version incompatible error.
 */
export class VersionIncompatibleError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('version_incompatible', message, options);
    this.name = 'VersionIncompatibleError';
    Object.setPrototypeOf(this, VersionIncompatibleError.prototype);
  }
}

/**
 * Adapter not found error.
 */
export class AdapterNotFoundError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('adapter_not_found', message, options);
    this.name = 'AdapterNotFoundError';
    Object.setPrototypeOf(this, AdapterNotFoundError.prototype);
  }
}

/**
 * Not initialized error.
 */
export class NotInitializedError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('not_initialized', message, options);
    this.name = 'NotInitializedError';
    Object.setPrototypeOf(this, NotInitializedError.prototype);
  }
}

/**
 * Already disposed error.
 */
export class AlreadyDisposedError extends SoulCacheStorageError {
  constructor(message: string, options?: { key?: string; cause?: Error }) {
    super('already_disposed', message, options);
    this.name = 'AlreadyDisposedError';
    Object.setPrototypeOf(this, AlreadyDisposedError.prototype);
  }
}

/**
 * Create a StorageError from an unknown error.
 */
export function createStorageError(
  type: StorageErrorType,
  message: string,
  cause?: unknown
): StorageError {
  return {
    type,
    message,
    cause: cause instanceof Error ? cause : undefined,
  };
}

/**
 * Check if an error is a SoulCacheStorageError.
 */
export function isStorageError(error: unknown): error is SoulCacheStorageError {
  return error instanceof SoulCacheStorageError;
}
