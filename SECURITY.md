# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in SoulCache, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub's private vulnerability reporting](https://github.com/kasihagustinusT/soulcache/security/advisories/new) to report the issue.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- Acknowledgment: within 48 hours
- Assessment: within 1 week
- Fix: depends on severity

## Scope

This policy applies to:
- `@soulcache/core`
- `@soulcache/react`
- `@soulcache/devtools-core`
- `@soulcache/devtools`

## Security Best Practices

- SoulCache has zero runtime dependencies
- No remote code execution
- No secret logging
- No `eval()` in production code
- Full TypeScript with strict mode

## Secure Usage Guidance

### Scope query keys per user / tenant

Request deduplication is single-flight per query key. Two concurrent calls with
the same key share one promise. For user-scoped data, always include the user or
tenant in the key so one user can never receive another user's cached response:

```ts
await queryClient.fetchQuery({
  queryKey: ['user', userId, 'profile'],
  queryFn: () => fetchProfile(userId),
});
```

On a server with a shared cache, prefer a per-request cache instance or key
every user-scoped query with the request's user context.

### Only hydrate state you can authenticate

`hydrate(cache, state)` writes whatever state it is given and, by default,
overwrites existing entries (`mergeStrategy: 'overwrite'`). Only hydrate state
that originates from a source you trust (e.g. a server-signed SSR payload). Do
not hydrate from client-controllable storage (localStorage) without validating
the data. Use `mergeStrategy: 'skip'` or `'merge'`, or a `filter`, to limit what
is written.

### Checksums detect corruption, not tampering

Persistence checksums (`fast-32`, and `sha-256` since 1.1.1) are unkeyed and
detect accidental data corruption. An attacker who can modify persisted bytes
can recompute the checksum. If persisted data must be tamper-resistant, protect
the storage layer or authenticate the payload (e.g. HMAC-SHA-256 with a
server-held secret) before persistence.

### Do not ship `error.stack` to clients

Since 1.1.1, `dehydrate()` omits `error.stack` by default. Keep it that way in
production; if you must include stacks (server-side debugging), pass
`includeStack: true` and never forward the result to a client.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.1.x   | Yes       |
| 1.0.x   | Yes       |
| < 1.0   | No        |
