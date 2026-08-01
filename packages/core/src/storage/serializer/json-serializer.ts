/**
 * SoulCache JSON Serializer
 *
 * Default JSON serializer for persistence.
 *
 * @module storage/serializer/json
 */

import type { Serializer, PersistedState, ChecksumConfig, ChecksumInfo, ChecksumAlgorithm } from '../types';
import { SerializationError } from '../errors';

/**
 * Supported checksum algorithms.
 *
 * Includes the legacy labels so a configured checksum algorithm that was
 * valid in 1.0.0 remains accepted; `fast-32` is the default.
 */
const SUPPORTED_ALGORITHMS: ChecksumAlgorithm[] = [
  'sha-256',
  'sha-384',
  'sha-512',
  'md5',
  'fast-32',
];

/**
 * JSON serializer configuration.
 */
export interface JsonSerializerConfig {
  /** Checksum configuration */
  checksum?: ChecksumConfig | undefined;

  /** Whether to sort keys for deterministic output */
  sortKeys?: boolean;

  /** Indentation for pretty printing (0 = no indentation) */
  indent?: number;
}

/**
 * Default serializer configuration.
 */
const DEFAULT_CONFIG: Required<JsonSerializerConfig> = {
  checksum: undefined as unknown as ChecksumConfig,
  sortKeys: true,
  indent: 0,
};

/**
 * JSON serializer.
 *
 * Serializes PersistedState to JSON string with optional checksum.
 * Produces deterministic output by sorting object keys.
 */
export class JsonSerializer implements Serializer {
  private readonly config: Required<JsonSerializerConfig>;

  constructor(config?: JsonSerializerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Serialize PersistedState to string.
   *
   * @param data - State to serialize
   * @returns Serialized string
   */
  serialize(data: PersistedState): string {
    try {
      // Create a copy with sorted keys for deterministic output
      const sorted = this.sortObjectKeys(data);

      // Serialize to JSON
      const json = JSON.stringify(sorted, null, this.config.indent || undefined);

      return json;
    } catch (error) {
      throw new SerializationError(
        'Failed to serialize persisted state',
        { cause: error instanceof Error ? error : new Error(String(error)) }
      );
    }
  }

  /**
   * Serialize and add checksum if configured.
   *
   * @param data - State to serialize
   * @returns Serialized string with optional checksum
   */
  serializeWithChecksum(data: PersistedState): { serialized: string; checksum?: ChecksumInfo | undefined } {
    const serialized = this.serialize(data);

    let checksum: ChecksumInfo | undefined;

    if (this.config.checksum) {
      checksum = this.calculateChecksum(serialized, this.config.checksum.algorithm);
    }

    return { serialized, checksum };
  }

  /**
   * Calculate checksum for data.
   *
   * @param data - Data to checksum
   * @param algorithm - Algorithm to use
   * @returns Checksum information
   */
  private calculateChecksum(data: string, algorithm: ChecksumAlgorithm): ChecksumInfo {
    // Simple hash implementation for browser/Node.js compatibility
    // In production, this could use Web Crypto API or a hash library
    const value = this.fast32Hash(data);

    return {
      algorithm,
      value,
    };
  }

  /**
   * Fast 32-bit hash function for checksums.
   *
   * Uses a Java hashCode derivative (djb2 variant) for fast, deterministic
   * integrity checking. This is NOT a cryptographic hash — it is used
   * solely for detecting accidental data corruption during persistence.
   *
   * @param data - Data to hash
   * @returns 8-character hex-encoded hash
   */
  private fast32Hash(data: string): string {
    let hash = 0;

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    // Convert to unsigned hex
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Sort object keys recursively for deterministic output.
   *
   * @param obj - Object to sort
   * @returns New object with sorted keys
   */
  private sortObjectKeys<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item)) as T;
    }

    // Only sort plain objects. Non-plain objects (Date, Map, Set, RegExp,
    // custom classes) are passed through unchanged to prevent silent
    // data corruption — Object.keys() returns [] for these types,
    // which would convert them to empty objects {}.
    if (obj.constructor !== Object) {
      return obj;
    }

    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();

    for (const key of keys) {
      sorted[key] = this.sortObjectKeys(
        (obj as Record<string, unknown>)[key]
      );
    }

    return sorted as T;
  }
}

/**
 * Create a JsonSerializer instance.
 */
export function createJsonSerializer(config?: JsonSerializerConfig): JsonSerializer {
  return new JsonSerializer(config);
}

/**
 * Check if an algorithm is supported.
 */
export function isSupportedAlgorithm(algorithm: string): algorithm is ChecksumAlgorithm {
  return SUPPORTED_ALGORITHMS.includes(algorithm as ChecksumAlgorithm);
}
