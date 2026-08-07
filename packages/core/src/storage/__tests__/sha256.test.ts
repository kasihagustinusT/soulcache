/**
 * SHA-256 implementation tests.
 *
 * Verified against the FIPS 180-4 Appendix B.1 / B.2 test vectors.
 */

import { describe, it, expect } from 'vitest';
import { sha256Hex } from '../checksum/sha256';

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 empty-string vector', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the FIPS 180-4 "abc" vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the FIPS 180-4 two-block vector', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('matches the known quick-brown-fox digest', () => {
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });

  it('handles a 56-byte message (boundary where padding + length fit one block)', () => {
    const msg = 'a'.repeat(55);
    expect(sha256Hex(msg)).toHaveLength(64);
    expect(sha256Hex(msg)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles a 64-byte message (exact block boundary)', () => {
    const msg = 'a'.repeat(64);
    expect(sha256Hex(msg)).toHaveLength(64);
    expect(sha256Hex(msg)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const input = 'the same input, twice';
    expect(sha256Hex(input)).toBe(sha256Hex(input));
  });

  it('is sensitive to changes (avalanche)', () => {
    const a = sha256Hex('persisted-state-v1');
    const b = sha256Hex('persisted-state-v2');
    let differing = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) differing++;
    }
    expect(differing).toBeGreaterThan(32);
  });
});
