# Contributing to SoulCache

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/soulcache.git
   cd soulcache
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feat/my-feature
   ```

## Development

### Scripts

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests
pnpm test:coverage  # Run tests with coverage
pnpm typecheck      # Type check all packages
pnpm lint           # Lint all files
pnpm lint:fix       # Auto-fix lint issues
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting
```

### Project Structure

```
soulcache/
├── packages/
│   ├── core/          # Core runtime (@soulcache/core)
│   └── react/         # React adapter (@soulcache/react)
├── docs/              # Documentation site
└── scripts/           # Build & validation scripts
```

### Adding Changes

1. Create a changeset:
   ```bash
   pnpm changeset
   ```
2. Select the affected package(s)
3. Choose the version bump type
4. Write a summary of the change

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding missing tests
- `chore:` maintenance
- `perf:` performance improvement

### Pull Request Process

1. Ensure all checks pass:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
2. Add a changeset if this is a user-facing change
3. Update documentation if needed
4. Request review

## Code Style

- TypeScript strict mode
- No `any` types in source
- ESM-only modules
- Zero runtime dependencies
- Follow existing patterns

## Reporting Bugs

Use the [bug report template](https://github.com/kasihagustinusT/soulcache/issues/new?template=bug_report.md).

## Requesting Features

Use the [feature request template](https://github.com/kasihagustinusT/soulcache/issues/new?template=feature_request.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
