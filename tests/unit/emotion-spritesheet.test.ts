// ============================================================================
// Emotion Spritesheet Contract & Geometry Alignment Unit Tests
// (tests/unit/emotion-spritesheet.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { EMOTION_POSE_SET, EMOTION_POSE_PROMPT } from '../../src/server/services/dna/contracts';
import { PET_EMOTIONS } from '../../src/client/components/PetSpritesheetPlayer';

describe('Emotion Spritesheet Geometry & Contract Integrity', () => {
  it('declares exactly 8 cells for the 4x2 grid (1024x512)', () => {
    expect(EMOTION_POSE_SET.length).toBe(8);
  });

  it('keeps all col and row coordinates within 4 columns and 2 rows', () => {
    for (const pose of EMOTION_POSE_SET) {
      expect(pose.col).toBeGreaterThanOrEqual(0);
      expect(pose.col).toBeLessThan(4);
      expect(pose.row).toBeGreaterThanOrEqual(0);
      expect(pose.row).toBeLessThan(2);
    }
  });

  it('guarantees zero cell collisions (no two poses share the same col and row)', () => {
    const seenCells = new Set<string>();
    for (const pose of EMOTION_POSE_SET) {
      const key = `${pose.col},${pose.row}`;
      expect(seenCells.has(key)).toBe(false);
      seenCells.add(key);
    }
    expect(seenCells.size).toBe(8);
  });

  it('provides a valid non-empty prompt for every emotion pose', () => {
    for (const pose of EMOTION_POSE_SET) {
      expect(EMOTION_POSE_PROMPT[pose.id]).toBeDefined();
      expect(typeof EMOTION_POSE_PROMPT[pose.id]).toBe('string');
      expect(EMOTION_POSE_PROMPT[pose.id].length).toBeGreaterThan(10);
    }
  });

  it('aligns client PET_EMOTIONS with the canonical emotion grid coordinates', () => {
    expect(PET_EMOTIONS.length).toBe(7); // 7 interactive companion emotions (portrait is hero bust)

    for (const clientEmotion of PET_EMOTIONS) {
      const serverPose = EMOTION_POSE_SET.find(p => p.id === clientEmotion.id);
      expect(serverPose).toBeDefined();
      expect(clientEmotion.col).toBe(serverPose!.col);
      expect(clientEmotion.row).toBe(serverPose!.row);
    }
  });
});
