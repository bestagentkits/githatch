// ============================================================================
// GitHoot Experience & Level Progression Engine Unit Tests
// (tests/unit/exp-engine.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  getActivityExp,
  getExpThresholdForLevel,
  calculateLevelProgression,
  calculateDeveloperExperience
} from '../../src/server/services/progression/exp-engine';

describe('Experience Engine (exp-engine.ts)', () => {
  describe('getActivityExp', () => {
    it('awards authentic EXP for specific event types', () => {
      expect(getActivityExp('ReleaseEvent')).toBe(100);
      expect(getActivityExp('PullRequestEvent')).toBe(50);
      expect(getActivityExp('PushEvent')).toBe(25);
      expect(getActivityExp('IssuesEvent')).toBe(20);
      expect(getActivityExp('CreateEvent')).toBe(15);
      expect(getActivityExp('ForkEvent')).toBe(15);
      expect(getActivityExp('WatchEvent')).toBe(10);
      expect(getActivityExp('UnknownEvent')).toBe(10);
    });
  });

  describe('getExpThresholdForLevel', () => {
    it('returns exact cumulative thresholds per level', () => {
      expect(getExpThresholdForLevel(1)).toBe(0);
      expect(getExpThresholdForLevel(2)).toBe(1000);
      expect(getExpThresholdForLevel(3)).toBe(2500);
      expect(getExpThresholdForLevel(4)).toBe(4500);
      expect(getExpThresholdForLevel(5)).toBe(7000);
      expect(getExpThresholdForLevel(10)).toBe(27000);
    });
  });

  describe('calculateLevelProgression', () => {
    it('handles Level 1 zero experience', () => {
      const p = calculateLevelProgression(0);
      expect(p.level).toBe(1);
      expect(p.currentExp).toBe(0);
      expect(p.levelStartExp).toBe(0);
      expect(p.nextLevelExp).toBe(1000);
      expect(p.expInLevel).toBe(0);
      expect(p.progressPercent).toBe(0);
      expect(p.expToNextLevel).toBe(1000);
    });

    it('calculates mid-level progress accurately', () => {
      // 500 EXP is halfway through Level 1 (span 1,000)
      const p1 = calculateLevelProgression(500);
      expect(p1.level).toBe(1);
      expect(p1.progressPercent).toBe(50);
      expect(p1.expToNextLevel).toBe(500);

      // 1,750 EXP: Level 2 starts at 1,000, next level at 2,500 (span 1,500). Exp in level = 750 (50%)
      const p2 = calculateLevelProgression(1750);
      expect(p2.level).toBe(2);
      expect(p2.expInLevel).toBe(750);
      expect(p2.levelExpSpan).toBe(1500);
      expect(p2.progressPercent).toBe(50);
      expect(p2.expToNextLevel).toBe(750);
    });

    it('caps progress percentage between 0 and 100', () => {
      const p = calculateLevelProgression(999);
      expect(p.level).toBe(1);
      expect(p.progressPercent).toBeCloseTo(99.9, 1);
    });
  });

  describe('calculateDeveloperExperience', () => {
    it('computes authentic developer experience from GitHub telemetry', () => {
      const { totalExp, progression } = calculateDeveloperExperience({
        public_repos: 10,       // 10 * 30 = 300
        followers: 20,          // 20 * 5 = 100
        total_stars: 10,        // 10 * 15 = 150
        contributions_last_year: 500, // 500 * 2 = 1000
        activities: [
          { type: 'PushEvent' },      // +25
          { type: 'PullRequestEvent' } // +50
        ]
      });

      // Total = 300 + 100 + 150 + 1000 + 75 = 1625 EXP
      expect(totalExp).toBe(1625);
      expect(progression.level).toBe(2); // Level 2 is 1000 to 2500
      expect(progression.expInLevel).toBe(625);
    });

    it('never drops below stored experience in database', () => {
      const { totalExp } = calculateDeveloperExperience({
        public_repos: 1,
        stored_experience: 50000
      });
      expect(totalExp).toBe(50000);
    });
  });
});
