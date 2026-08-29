// ============================================================================
// GitHoot Tamagotchi Mood State Engine (src/server/services/progression/mood-engine.ts)
// ============================================================================

import type { EnergyState } from '../../types';

export interface MoodDetails {
  state: EnergyState;
  title: string;
  description: string;
  recommendedPose: 'idle' | 'happy' | 'sleepy' | 'proud' | 'work' | 'celebrate';
  badgeColor: string;
}

export function calculateGuardianMood(lastActivityTimestamp: number): MoodDetails {
  const now = Date.now();
  const hoursSinceActive = (now - lastActivityTimestamp) / (1000 * 3600);

  if (hoursSinceActive <= 24) {
    return {
      state: 'Energetic',
      title: '⚡ Energetic & Sparking',
      description: 'Vừa lập trình sôi nổi trong 24h qua! Linh thú đang hào hứng cùng bạn.',
      recommendedPose: 'work',
      badgeColor: '#00ff88'
    };
  }

  if (hoursSinceActive <= 24 * 7) {
    return {
      state: 'Active',
      title: '✦ Active & Ready',
      description: 'Đang khỏe mạnh và chăm chỉ bảo vệ các repositories của bạn.',
      recommendedPose: 'idle',
      badgeColor: '#00f0ff'
    };
  }

  if (hoursSinceActive <= 24 * 30) {
    return {
      state: 'Resting',
      title: '😴 Resting & Cozy',
      description: 'Đang ngủ đông êm đềm bên cạnh các dòng code.',
      recommendedPose: 'sleepy',
      badgeColor: '#ffa800'
    };
  }

  return {
    state: 'Hungry_for_code',
    title: '🍖 Hungry for Commits',
    description: 'Đã hơn 30 ngày chưa có commit mới. Hãy push 1 commit để đánh thức bé nhé!',
    recommendedPose: 'happy',
    badgeColor: '#ff2a85'
  };
}
