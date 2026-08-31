// ============================================================================
// Publication Preflight Gate Unit Tests (tests/unit/publication-preflight.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { evaluatePreflightCriteria, type PreflightEvaluationInput } from '../../src/server/services/claim/publication-preflight';

function createValidPreflightInput(): PreflightEvaluationInput {
  return {
    referenceApproved: true,
    referenceSha256: 'a'.repeat(64),
    framesCount: 16,
    framesAccepted: 16,
    hasUniquePoseIndices: true,
    framesHaveGateMetrics: true,
    framesHaveSemanticVerdicts: true,
    hasSheetPng: true,
    hasSheetWebp: true,
    hasStripPng: true,
    hasStripWebp: true,
    hasManifest: true,
    manifestHasArtifactHashes: true
  };
}

describe('Publication Preflight Gate Evaluation', () => {
  it('passes when all 12 preflight criteria are satisfied', () => {
    const input = createValidPreflightInput();
    const result = evaluatePreflightCriteria(input);
    expect(result.ready).toBe(true);
    expect(result.reasons.length).toBe(0);
  });

  it('fails when reference hero frame is not approved', () => {
    const invalid = { ...createValidPreflightInput(), referenceApproved: false };
    const result = evaluatePreflightCriteria(invalid);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /reference hero frame not approved/i.test(r))).toBe(true);
  });

  it('fails when frame count is less than 16', () => {
    const invalid = { ...createValidPreflightInput(), framesAccepted: 15 };
    const result = evaluatePreflightCriteria(invalid);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /incomplete frames/i.test(r))).toBe(true);
  });

  it('fails when pose indices contain duplicates or gaps', () => {
    const invalid = { ...createValidPreflightInput(), hasUniquePoseIndices: false };
    const result = evaluatePreflightCriteria(invalid);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /missing or duplicate pose indices/i.test(r))).toBe(true);
  });

  it('fails when semantic verdicts lack hash-binding or reviewer identity', () => {
    const invalid = { ...createValidPreflightInput(), framesHaveSemanticVerdicts: false };
    const result = evaluatePreflightCriteria(invalid);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /lack hash-bound semantic review approval/i.test(r))).toBe(true);
  });

  it('fails when any of the 4 master assets (PNG/WebP) are missing', () => {
    const missingSheetWebp = { ...createValidPreflightInput(), hasSheetWebp: false };
    const result = evaluatePreflightCriteria(missingSheetWebp);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /missing landing16-sheet.webp/i.test(r))).toBe(true);

    const missingStripWebp = { ...createValidPreflightInput(), hasStripWebp: false };
    const resStrip = evaluatePreflightCriteria(missingStripWebp);
    expect(resStrip.ready).toBe(false);
    expect(resStrip.reasons.some(r => /missing landing16-strip.webp/i.test(r))).toBe(true);
  });

  it('fails when manifest JSON lacks SHA-256 hashes for all 4 output artifacts', () => {
    const invalid = { ...createValidPreflightInput(), manifestHasArtifactHashes: false };
    const result = evaluatePreflightCriteria(invalid);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => /missing sha-256 hashes/i.test(r))).toBe(true);
  });
});
