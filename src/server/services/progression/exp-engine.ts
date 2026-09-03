// ============================================================================
// GitHoot Experience & Level Progression Engine (src/server/services/progression/exp-engine.ts)
// Calculates authentic developer experience, activity rewards, and level thresholds.
// ============================================================================

export interface LevelProgression {
  level: number;
  currentExp: number;
  levelStartExp: number;
  nextLevelExp: number;
  expInLevel: number;
  levelExpSpan: number;
  progressPercent: number;
  expToNextLevel: number;
}

/**
 * Authentic EXP gained per GitHub activity event type:
 * - Releases: +100 EXP (Major milestone / ship)
 * - Pull Requests: +50 EXP (Collaboration / merge)
 * - Push / Commits: +25 EXP (Active daily coding)
 * - Issues: +20 EXP (Bug reporting / triage)
 * - Create (Branch/Tag): +15 EXP (Scaffolding)
 * - Fork: +15 EXP
 * - Star / Watch: +10 EXP
 */
export function getActivityExp(type: string): number {
  switch (type) {
    case 'ReleaseEvent': return 100;
    case 'PullRequestEvent': return 50;
    case 'PushEvent': return 25;
    case 'IssuesEvent': return 20;
    case 'CreateEvent': return 15;
    case 'ForkEvent': return 15;
    case 'WatchEvent': return 10;
    default: return 10;
  }
}

/**
 * Cumulative EXP threshold required to reach Level L.
 * Level 1: 0 EXP
 * Level 2: 1,000 EXP (span 1,000)
 * Level 3: 2,500 EXP (span 1,500)
 * Level 4: 4,500 EXP (span 2,000)
 * Level 5: 7,000 EXP (span 2,500)
 * Level 6: 10,000 EXP (span 3,000)
 * Level L: 250 * (L - 1) * (L + 2)
 */
export function getExpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return 250 * (level - 1) * (level + 2);
}

/**
 * Compute level progression details given raw accumulated experience.
 */
export function calculateLevelProgression(rawExp: number): LevelProgression {
  const currentExp = Math.max(0, Math.floor(rawExp || 0));
  
  let level = 1;
  while (getExpThresholdForLevel(level + 1) <= currentExp) {
    level++;
    if (level >= 99) break; // Maximum level cap for Genesis stage
  }

  const levelStartExp = getExpThresholdForLevel(level);
  const nextLevelExp = getExpThresholdForLevel(level + 1);
  const levelExpSpan = Math.max(1, nextLevelExp - levelStartExp);
  const expInLevel = Math.max(0, currentExp - levelStartExp);
  const progressPercent = Math.min(100, Math.max(0, (expInLevel / levelExpSpan) * 100));
  const expToNextLevel = Math.max(0, nextLevelExp - currentExp);

  return {
    level,
    currentExp,
    levelStartExp,
    nextLevelExp,
    expInLevel,
    levelExpSpan,
    progressPercent,
    expToNextLevel
  };
}

/**
 * Calculate developer total experience from authentic GitHub telemetry.
 * Base experience:
 * - Public Repos: 30 EXP per repository
 * - Contributions (last year): 2 EXP per contribution
 * - Stars: 15 EXP per star
 * - Followers: 5 EXP per follower
 * - Activities: Sum of recent public event EXP
 *
 * Never drops below any previously persisted experience value.
 */
export function calculateDeveloperExperience(params: {
  public_repos: number;
  followers?: number;
  total_stars?: number;
  contributions_last_year?: number;
  activities?: Array<{ type: string }>;
  stored_experience?: number;
}): { totalExp: number; progression: LevelProgression } {
  const repos = Math.max(0, params.public_repos || 0);
  const followers = Math.max(0, params.followers || 0);
  const stars = Math.max(0, params.total_stars || 0);
  const contributions = Math.max(0, params.contributions_last_year || 0);

  const activitiesExp = (params.activities || []).reduce(
    (acc, act) => acc + getActivityExp(act.type),
    0
  );

  const baseTelemetryExp = (repos * 30) + (contributions * 2) + (stars * 15) + (followers * 5) + activitiesExp;
  const totalExp = Math.max(params.stored_experience || 0, baseTelemetryExp);
  const progression = calculateLevelProgression(totalExp);

  return { totalExp, progression };
}
