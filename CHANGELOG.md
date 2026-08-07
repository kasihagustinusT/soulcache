# Changelog

All notable changes to SoulCache will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-08-07

### Security

- **Honest checksum algorithms (SLC-INTEGRITY-001).** `sha-256` now computes a
  real FIPS 180-4 SHA-256 digest. Previously every configured algorithm
  (`sha-256`, `sha-384`, `sha-512`, `md5`, `fast-32`) silently computed the same
  non-cryptographic 32-bit djb2 value, so a `sha-256`-labeled payload gave no
  more integrity protection than `fast-32`. New writes under `sha-384`,
  `sha-512`, or `md5` now throw with migration guidance; payloads persisted by
  1.0.0/1.1.0 under any label (including legacy djb2 values labeled `sha-256`)
  remain readable and verify correctly.
- **`dehydrate()` no longer includes `error.stack` by default (SLC-HYDRATE-003).**
  Dehydrated error entries expose only `message` and `name`, preventing internal
  file paths from leaking to clients in SSR flows. Pass `includeStack: true` to
  opt back in for server-side debugging.
- **`hydrate()` validates entry structure (SLC-HYDRATE-001).** Malformed entries
  (non-array `queryKey`, non-object query) are rejected before they can corrupt
  the cache. The default `overwrite` merge strategy is unchanged; only hydrate
  state you can authenticate (see `SECURITY.md`).
- **`generateId()` uses a CSPRNG (SLC-RNG-001).** IDs are now generated with
  `crypto.randomUUID()` when available, with the legacy scheme retained as a
  fallback for environments without Web Crypto.

### Changed

- `JsonSerializer`/`JsonDeserializer` checksum selection is now honored; the
  `ChecksumAlgorithm` documentation in `packages/core/src/storage/types.ts`
  describes the semantics of each label.

## [1.1.0] - 2026-08-06

### Changed
- LRU eviction score formula corrected so recently/frequently accessed entries are evicted last.
- Mutation `onSuccess`/`onError`/`onSettled` callbacks are now isolated per callback; a throwing callback no longer corrupts mutation state or skips `onSettled`.
- Retry-engine event listeners are individually isolated; `toError()` preserves `name`/`message` for non-`Error` thrown values (e.g. DOMException in jsdom).
- `InfiniteQuery` default `maxPages` changed from `Infinity` to `50`; navigation flags are recomputed after page-window eviction.
- `EventBus` adds monotonic sequence numbers and opt-in coalesced delivery.

### Security
- `MemoryAdapter` now accepts a `maxEntries` option to cap stored entries and bound memory use.
- `deepEqual` now guards recursion depth to prevent stack-overflow attacks on pathological input.
- `deserialize` now validates the dehydrated-state shape before hydrating, rejecting malformed or hostile payloads.
- `EventBus` now enforces a per-type handler limit to prevent unbounded listener growth.

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
- Lifecycle manager for storage operations
- Diagnostics and health monitoring
- Persistence coordinator for unified storage management
- Storage registry for adapter management

#### Hydration
- Server-side prefetching with `dehydrate` and `hydrate`
- Structural sharing for efficient re-renders
- Streaming-compatible hydration for Next.js App Router
- Partial hydration support

#### React Adapter
- `SoulCacheProvider` context component
- `useQuery` hook with full type inference
- `useMutation` hook with optimistic updates
- `useInfiniteQuery` hook for paginated data
- `useQueryClient` hook for direct client access
- `usePrefetchQuery` hook for preloading
- `useIsFetching` and `useIsMutating` subscription hooks
- `HydrationBoundary` for SSR data transfer

#### DevTools
- `@soulcache/devtools-core` framework-agnostic inspection and diagnostics
- `@soulcache/devtools` React panel with six tabs (Queries, Mutations, Timeline, Metrics, Health, Settings)
- Floating panel with keyboard shortcut (Ctrl/Cmd+Shift+D)
- Query, mutation, and cache inspection
- Timeline recording with event history
- p50, p95, p99 performance metrics
- Health diagnostics with recommendations

#### Error Handling
- Typed error hierarchy (SoulCacheError, ConfigurationError, QueryError, CacheError, RuntimeError)
- Storage-specific errors (SoulCacheStorageError, SerializationError, DeserializationError)
- Migration and validation errors
- Error classification and recovery

#### Utilities
- `generateId` for unique query and mutation identifiers
- `EventBus` for internal event communication
- `SubscriptionManager` for query subscriptions
- `QuerySnapshotManager` for snapshot management

#### Documentation
- Complete documentation platform at [soulcache.vercel.app](https://soulcache.vercel.app)
- Installation guides for npm, pnpm, yarn, and bun
- API reference for all public exports
- React adapter documentation with hooks and components
- Migration guide from React Query and SWR
- Performance benchmarks and optimization guides
- DevTools usage and configuration

#### Developer Experience
- Full TypeScript with strict mode and zero `any` types
- ESM-only with tree-shaking support
- Zero runtime dependencies in core package
- Changesets for version management
- Comprehensive test suite (1,293+ tests)
- CI/CD with GitHub Actions (Node.js 20, 22)
- CodeQL security analysis
- Dependabot for dependency updates
- Nightly builds with security audit
- Benchmark suite for performance tracking

#### Repository
- MIT License
- Contributing guide with development workflow
- Security policy with vulnerability reporting
- Support guide with channels
- Code of Conduct (Contributor Covenant v2.1)
- Issue templates (bug report, feature request, question)
- Pull request template with checklist
- CODEOWNERS for code review
- FUNDING.yml for GitHub Sponsors
- Labels for issue and PR management

[1.1.0]: https://github.com/kasihagustinusT/soulcache/releases/tag/v1.1.0
[1.0.0]: https://github.com/kasihagustinusT/soulcache/releases/tag/v1.0.0
