// ============================================================================
// GitHoot Pet Spritesheet & Emotion Player (src/client/components/PetSpritesheetPlayer.tsx)
// ============================================================================

import React, { useState } from 'react';
import type { GuardianSummary } from '../../server/types';

export interface PetPlayerProps {
  guardian: GuardianSummary;
  interactive?: boolean;
}

export type PetPose = 'idle' | 'happy' | 'sleepy' | 'proud' | 'angry' | 'work' | 'celebrate';

export const PetSpritesheetPlayer: React.FC<PetPlayerProps> = ({
  guardian,
  interactive = true
}) => {
  const [currentPose, setCurrentPose] = useState<PetPose>('idle');
  const [bouncing, setBouncing] = useState(false);

  const handlePoseClick = (pose: PetPose) => {
    setCurrentPose(pose);
    setBouncing(true);
    setTimeout(() => setBouncing(false), 300);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      background: '#0d111a',
      border: '1px solid rgba(0, 240, 255, 0.2)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
    }}>
      {/* Hero Pet Visual Box */}
      <div style={{
        position: 'relative',
        width: '260px',
        height: '260px',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #1c2637 0%, #07090e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid #00f0ff',
        boxShadow: '0 0 24px rgba(0, 240, 255, 0.35)'
      }}>
        <img
          src={guardian.hero_image_url || ''}
          alt={guardian.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: bouncing ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        />

        {/* Dynamic Pose Pill */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          background: 'rgba(7, 9, 14, 0.85)',
          border: '1px solid #00f0ff',
          color: '#00f0ff',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase'
        }}>
          Pose: [{currentPose}]
        </div>
      </div>

      {/* Interactive Emotion Bar */}
      {interactive && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          justifyContent: 'center',
          maxWidth: '320px'
        }}>
          <button
            onClick={() => handlePoseClick('idle')}
            style={getPoseBtnStyle(currentPose === 'idle')}
          >
            Idle
          </button>
          <button
            onClick={() => handlePoseClick('happy')}
            style={getPoseBtnStyle(currentPose === 'happy')}
          >
            😊 Happy
          </button>
          <button
            onClick={() => handlePoseClick('sleepy')}
            style={getPoseBtnStyle(currentPose === 'sleepy')}
          >
            😴 Sleepy
          </button>
          <button
            onClick={() => handlePoseClick('proud')}
            style={getPoseBtnStyle(currentPose === 'proud')}
          >
            👑 Proud
          </button>
          <button
            onClick={() => handlePoseClick('angry')}
            style={getPoseBtnStyle(currentPose === 'angry')}
          >
            ⚔️ Combat
          </button>
          <button
            onClick={() => handlePoseClick('work')}
            style={getPoseBtnStyle(currentPose === 'work')}
          >
            💻 Work/Code
          </button>
          <button
            onClick={() => handlePoseClick('celebrate')}
            style={{
              ...getPoseBtnStyle(currentPose === 'celebrate'),
              background: '#00f0ff',
              color: '#000',
              fontWeight: 800
            }}
          >
            🎉 Celebrate
          </button>
        </div>
      )}
    </div>
  );
};

function getPoseBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#1c2637' : '#141b27',
    border: active ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.08)',
    color: active ? '#00f0ff' : '#8b9bb4',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s'
  };
}
