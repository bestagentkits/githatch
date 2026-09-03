// ============================================================================
// GitHoot Client Progression & EXP Helper (src/client/utils/progression.ts)
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

export function getExpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  return 250 * (level - 1) * (level + 2);
}

export function calculateLevelProgression(rawExp: number): LevelProgression {
  const currentExp = Math.max(0, Math.floor(rawExp || 0));
  
  let level = 1;
  while (getExpThresholdForLevel(level + 1) <= currentExp) {
    level++;
    if (level >= 99) break;
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
