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

## Security Best Practices

- SoulCache has zero runtime dependencies
- No remote code execution
- No secret logging
- No `eval()` in production code
- Full TypeScript with strict mode

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |
| < 1.0   | No        |
