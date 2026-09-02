// ============================================================================
// Queue Worker 16-Pose Loop Unit Tests (tests/unit/queue-worker-16poses.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  filterMissingPoses,
  isModelAllowlisted
} from '../../src/server/queue/generation-worker';
import { POSE_SET, MODEL_ALLOWLIST } from '../../src/server/services/dna/contracts';

describe('Queue Worker 16-Pose Checkpointing & Logic', () => {
  it('enforces model allowlist strictly', () => {
    expect(isModelAllowlisted('nano-banana-pro-preview')).toBe(true);
    expect(isModelAllowlisted('gemini-3-pro-image')).toBe(true);
    expect(isModelAllowlisted('gemini-2.5-flash-image')).toBe(false);
    expect(isModelAllowlisted('grok-imagine')).toBe(false);
  });

  it('filterMissingPoses returns only poses that need generation', () => {
    const allPoses = POSE_SET;
    const completedPoseIds = new Set(['hover', 'dive_start', 'dive_steep']);

    const missing = filterMissingPoses(allPoses, completedPoseIds);
    expect(missing.length).toBe(13);
    expect(missing[0].id).toBe('plunge');
    expect(missing.map(p => p.id)).not.toContain('hover');
  });

  it('filterMissingPoses returns empty array when all 16 poses are complete', () => {
    const allPoses = POSE_SET;
    const completedPoseIds = new Set(allPoses.map(p => p.id));

    const missing = filterMissingPoses(allPoses, completedPoseIds);
    expect(missing.length).toBe(0);
  });
});
