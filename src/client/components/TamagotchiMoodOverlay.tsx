// ============================================================================
// GitHoot Tamagotchi Mood State Overlay (src/client/components/TamagotchiMoodOverlay.tsx)
// ============================================================================

import React from 'react';
import type { EnergyState } from '../../server/types';

export interface TamagotchiOverlayProps {
  energyState: EnergyState;
  guardianName: string;
}

export const TamagotchiMoodOverlay: React.FC<TamagotchiOverlayProps> = ({
  energyState,
  guardianName
}) => {
  const moodConfig = getMoodDisplay(energyState);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(13, 17, 26, 0.85)',
      border: `1px solid ${moodConfig.color}`,
      padding: '10px 18px',
      borderRadius: '9999px',
      boxShadow: `0 0 16px ${moodConfig.glow}`,
      fontFamily: "'Schibsted Grotesk', sans-serif"
    }}>
      <span style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: moodConfig.color,
        boxShadow: `0 0 8px ${moodConfig.color}`,
        animation: 'pulse 1.5s infinite'
      }} />

      <div style={{ fontSize: '12px', color: '#f0f6fc', fontWeight: 600 }}>
        <strong style={{ color: moodConfig.color }}>{moodConfig.title}:</strong> {moodConfig.message(guardianName)}
      </div>
    </div>
  );
};

function getMoodDisplay(state: EnergyState) {
  switch (state) {
    case 'Energetic':
      return {
        title: '⚡ Energetic',
        color: '#00ff88',
        glow: 'rgba(0, 255, 136, 0.3)',
        message: (name: string) => `${name} đang tràn đầy cảm hứng từ các commit gần đây!`
      };
    case 'Active':
      return {
        title: '✦ Active',
        color: '#00f0ff',
        glow: 'rgba(0, 240, 255, 0.3)',
        message: (name: string) => `${name} đang tích cực bảo hộ các repositories của bạn.`
      };
    case 'Resting':
      return {
        title: '😴 Resting',
        color: '#ffa800',
        glow: 'rgba(255, 168, 0, 0.3)',
        message: (name: string) => `${name} đang ngủ đông ấm áp bên cạnh mã nguồn.`
      };
    default:
      return {
        title: '🍖 Hungry for Code',
        color: '#ff2a85',
        glow: 'rgba(255, 42, 133, 0.3)',
        message: (name: string) => `${name} đang chờ một commit mới để thức tỉnh!`
      };
  }
}
