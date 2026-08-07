# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-08-07

### Security
- **Honest checksum algorithms (SLC-INTEGRITY-001).** `sha-256` now computes a real
  FIPS 180-4 SHA-256 digest (64-hex). Previously every configured label
  (`sha-256`, `sha-384`, `sha-512`, `md5`, `fast-32`) silently computed the same
  32-bit djb2 value. Writes under `sha-384`/`sha-512`/`md5` now throw
  `SerializationError` (never implemented, deprecated); payloads persisted by
  1.0.0/1.1.0 under any label (including legacy djb2 values labeled `sha-256`)
  remain readable via dual-mode verification.
- **`dehydrate()` no longer includes `error.stack` by default (SLC-HYDRATE-003).**
  Dehydrated error entries expose only `message` and `name`; pass
  `includeStack: true` to opt back in for server-side debugging.
- **`hydrate()` validates entry structure (SLC-HYDRATE-001).** Malformed entries
  (non-array `queryKey`, non-object query) are rejected before they can corrupt the
  cache; default `overwrite` merge strategy is unchanged.
- **`generateId()` uses a CSPRNG (SLC-RNG-001).** IDs use `crypto.randomUUID()` when
  available, with the legacy scheme retained as a fallback.

### Changed
- `JsonSerializer`/`JsonDeserializer` checksum selection is now honored; the
  `ChecksumAlgorithm` documentation describes the semantics of each label.

## [1.1.0] - 2026-08-06

### Changed
- LRU eviction score formula corrected so recently/frequently accessed entries are evicted last.
- Mutation `onSuccess`/`onError`/`onSettled` callbacks are isolated per callback; a throwing callback no longer corrupts mutation state or skips `onSettled`.
- Retry-engine event listeners are individually isolated; `toError()` preserves `name`/`message` for non-`Error` thrown values.
- `InfiniteQuery` default `maxPages` changed from `Infinity` to `50`; navigation flags are recomputed after page-window eviction.
- `EventBus` adds monotonic sequence numbers and opt-in coalesced delivery.

### Security
- `MemoryAdapter` accepts a `maxEntries` option to cap stored entries and bound memory use.
- `deepEqual` guards recursion depth to prevent stack-overflow attacks on pathological input.
- `deserialize` validates the dehydrated-state shape before hydrating.
- `EventBus` enforces a per-type handler limit.

## [1.0.0] - 2026-07-23

### Added

#### Core Runtime
- Query client with request deduplication
- Cache engine with configurable TTL, garbage collection, and dependency tracking
- Mutation system with optimistic updates and rollback
- Observer system with structured snapshots and real-time subscriptions
- Scheduler with priority-based task scheduling (immediate, high, normal, low, idle)
- Infinite query support with cursor-based and page-based pagination
- Retry engine (internal module) with exponential, linear, and constant backoff strategies
- Plugin system (internal module) with lifecycle hooks for query, mutation, cache, and error events

#### Storage
- Pluggable storage adapters (Memory)
- Automatic persistence with configurable serialization
- Migration manager for schema versioning
- Restore manager for cache recovery
- Diagnostics and health monitoring
- Persistence coordinator for unified storage management

#### Hydration
- Server-side prefetching with `dehydrate` and `hydrate`
- Structural sharing for efficient re-renders
- Streaming-compatible hydration for Next.js App Router

#### Error Handling
- Typed error hierarchy (SoulCacheError, ConfigurationError, QueryError, CacheError, RuntimeError)
- Error classification and recovery

#### Utilities
- `generateId` for unique query and mutation identifiers
- `EventBus` for internal event communication
- `SubscriptionManager` for query subscriptions
- `QuerySnapshotManager` for snapshot management

## [0.1.0] - 2026-07-18

### Added

- Initial package scaffold
