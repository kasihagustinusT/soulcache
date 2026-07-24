# Changelog

All notable changes to SoulCache will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-23

### Added

#### Core Runtime
- Query engine with stale-while-revalidate, background refetching, and request deduplication
- Cache engine with configurable TTL, garbage collection, and dependency tracking
- Retry engine with exponential, linear, and constant backoff strategies
- Mutation system with optimistic updates, rollback, and automatic cache invalidation
- Observer system with structured snapshots and real-time subscriptions
- Scheduler with priority-based task scheduling (immediate, high, normal, low, idle)
- Infinite query support with cursor-based and page-based pagination
- Plugin system with lifecycle hooks for query, mutation, cache, and error events

#### Storage
- Pluggable storage adapters (Memory, IndexedDB, LocalStorage)
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
- Comprehensive test suite (756 tests)
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

[1.0.0]: https://github.com/kasihagustinusT/soulcache/releases/tag/v1.0.0
