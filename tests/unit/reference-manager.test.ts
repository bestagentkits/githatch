// ============================================================================
// Reference Manager & Two-Phase CAS Approval Unit Tests (tests/unit/reference-manager.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generateReferenceKey,
  generateCandidateKey,
  verifyCandidateProvenance
} from '../../src/server/services/ai/reference-manager';

describe('Reference Manager & Immutability', () => {
  it('generates immutable R2 key paths matching specification', () => {
    const sha = '4f969930e7ce0747a1c73233601716674749715cff671a8502512652f2109d98';
    const canonicalKey = generateReferenceKey(sha);
    expect(canonicalKey).toBe('references/4f969930e7ce0747a1c73233601716674749715cff671a8502512652f2109d98.png');

    const candKey = generateCandidateKey('guardian-123', sha);
    expect(candKey).toBe('candidates/guardian-123/4f969930e7ce0747a1c73233601716674749715cff671a8502512652f2109d98.png');
  });

  it('verifyCandidateProvenance rejects mismatched SHA-256', () => {
    const recorded = 'sha-original-123';
    const actual = 'sha-modified-456';
    expect(() => {
      verifyCandidateProvenance({
        candidateSha256: recorded,
        actualBufferSha256: actual,
        recordedIdentityHash: 'id-hash-1',
        currentIdentityHash: 'id-hash-1'
      });
    }).toThrow(/candidate bytes changed/i);
  });

  it('verifyCandidateProvenance rejects changed IdentitySpec', () => {
    const sha = 'sha-valid-123';
    expect(() => {
      verifyCandidateProvenance({
        candidateSha256: sha,
        actualBufferSha256: sha,
        recordedIdentityHash: 'id-hash-original',
        currentIdentityHash: 'id-hash-modified'
      });
    }).toThrow(/identity spec changed/i);
  });

  it('verifyCandidateProvenance passes when all hashes align', () => {
    const sha = 'sha-valid-123';
    const result = verifyCandidateProvenance({
      candidateSha256: sha,
      actualBufferSha256: sha,
      recordedIdentityHash: 'id-hash-1',
      currentIdentityHash: 'id-hash-1'
    });
    expect(result).toBe(true);
  });
});
