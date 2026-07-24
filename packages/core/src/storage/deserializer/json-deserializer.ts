/**
 * SoulCache JSON Deserializer
 *
 * Default JSON deserializer for persistence.
 *
 * @module storage/deserializer/json
 */

import type { Deserializer, PersistedState, ChecksumInfo, ChecksumAlgorithm } from '../types';
import {
  DeserializationError,
  ValidationError,
  ChecksumMismatchError,
  UnknownAlgorithmError,
  VersionIncompatibleError,
} from '../errors';

/**
 * Supported checksum algorithms.
 */
const SUPPORTED_ALGORITHMS: ChecksumAlgorithm[] = ['sha-256', 'sha-384', 'sha-512', 'md5'];

/**
 * Current schema version.
 */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * JSON deserializer configuration.
 */
export interface JsonDeserializerConfig {
  /** Whether to validate checksums */
  validateChecksum?: boolean;

  /** Whether to validate schema version */
  validateVersion?: boolean;

  /** Accepted schema versions */
  acceptedVersions?: number[];
}

/**
 * Default deserializer configuration.
 */
const DEFAULT_CONFIG: Required<JsonDeserializerConfig> = {
  validateChecksum: true,
  validateVersion: true,
  acceptedVersions: [CURRENT_SCHEMA_VERSION],
};

/**
 * JSON deserializer.
 *
 * Deserializes JSON string to PersistedState with validation.
 */
export class JsonDeserializer implements Deserializer {
  private readonly config: Required<JsonDeserializerConfig>;

  constructor(config?: JsonDeserializerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Deserialize string to PersistedState.
   *
   * @param data - Serialized string
   * @returns Deserialized state
   * @throws DeserializationError if parsing fails
   * @throws ValidationError if validation fails
   * @throws VersionIncompatibleError if version is not accepted
   */
  deserialize(data: string): PersistedState {
    // Parse JSON
    let parsed: unknown;

    try {
      parsed = JSON.parse(data);
    } catch (error) {
      throw new DeserializationError(
        'Failed to parse JSON',
        { cause: error instanceof Error ? error : new Error(String(error)) }
      );
    }

    // Validate structure
    this.validateStructure(parsed);

    // Cast to PersistedState
    const state = parsed as PersistedState;

    // Validate version if configured
    if (this.config.validateVersion) {
      this.validateVersion(state);
    }

    return state;
  }

  /**
   * Deserialize and validate checksum if present.
   *
   * @param data - Serialized string
   * @param expectedChecksum - Expected checksum (optional)
   * @returns Deserialized state
   */
  deserializeWithChecksum(
    data: string,
    expectedChecksum?: ChecksumInfo
  ): PersistedState {
    // Validate checksum if provided and validation is enabled
    if (expectedChecksum && this.config.validateChecksum) {
      this.validateChecksum(data, expectedChecksum);
    }

    return this.deserialize(data);
  }

  /**
   * Validate the structure of parsed data.
   *
   * @param data - Parsed data to validate
   * @throws ValidationError if structure is invalid
   */
  private validateStructure(data: unknown): void {
    if (data === null || data === undefined) {
      throw new ValidationError('Data is null or undefined');
    }

    if (typeof data !== 'object') {
      throw new ValidationError('Data is not an object');
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (typeof obj.version !== 'number') {
      throw new ValidationError('Missing or invalid "version" field');
    }

    if (typeof obj.timestamp !== 'number') {
      throw new ValidationError('Missing or invalid "timestamp" field');
    }

    if (obj.queryCache === undefined || typeof obj.queryCache !== 'object') {
      throw new ValidationError('Missing or invalid "queryCache" field');
    }

    if (obj.mutationCache === undefined || typeof obj.mutationCache !== 'object') {
      throw new ValidationError('Missing or invalid "mutationCache" field');
    }

    if (obj.metadata === undefined || typeof obj.metadata !== 'object') {
      throw new ValidationError('Missing or invalid "metadata" field');
    }

    // Validate queryCache structure
    const queryCache = obj.queryCache as Record<string, unknown>;
    if (queryCache.entries === undefined || typeof queryCache.entries !== 'object') {
      throw new ValidationError('Missing or invalid "queryCache.entries" field');
    }

    // Validate mutationCache structure
    const mutationCache = obj.mutationCache as Record<string, unknown>;
    if (mutationCache.entries === undefined || typeof mutationCache.entries !== 'object') {
      throw new ValidationError('Missing or invalid "mutationCache.entries" field');
    }
  }

  /**
   * Validate schema version.
   *
   * @param state - State to validate
   * @throws VersionIncompatibleError if version is not accepted
   */
  private validateVersion(state: PersistedState): void {
    if (!this.config.acceptedVersions.includes(state.version)) {
      throw new VersionIncompatibleError(
        `Schema version ${state.version} is not accepted. ` +
        `Accepted versions: ${this.config.acceptedVersions.join(', ')}`
      );
    }
  }

  /**
   * Validate checksum.
   *
   * @param data - Original data
   * @param expectedChecksum - Expected checksum
   * @throws UnknownAlgorithmError if algorithm is not supported
   * @throws ChecksumMismatchError if checksum does not match
   */
  private validateChecksum(data: string, expectedChecksum: ChecksumInfo): void {
    // Check if algorithm is supported
    if (!SUPPORTED_ALGORITHMS.includes(expectedChecksum.algorithm)) {
      throw new UnknownAlgorithmError(
        `Checksum algorithm "${expectedChecksum.algorithm}" is not supported. ` +
        `Supported algorithms: ${SUPPORTED_ALGORITHMS.join(', ')}`
      );
    }

    // Calculate checksum
    const calculated = this.calculateChecksum(data, expectedChecksum.algorithm);

    // Compare
    if (calculated.value !== expectedChecksum.value) {
      throw new ChecksumMismatchError(
        `Checksum mismatch. Expected: ${expectedChecksum.value}, Got: ${calculated.value}`
      );
    }
  }

  /**
   * Calculate checksum for data.
   *
   * @param data - Data to checksum
   * @param algorithm - Algorithm to use
   * @returns Checksum information
   */
  private calculateChecksum(data: string, algorithm: ChecksumAlgorithm): ChecksumInfo {
    const value = this.simpleHash(data);

    return {
      algorithm,
      value,
    };
  }

  /**
   * Simple hash function for checksums.
   *
   * @param data - Data to hash
   * @returns Hex-encoded hash
   */
  private simpleHash(data: string): string {
    let hash = 0;

    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
  }
}

/**
 * Create a JsonDeserializer instance.
 */
export function createJsonDeserializer(config?: JsonDeserializerConfig): JsonDeserializer {
  return new JsonDeserializer(config);
}
