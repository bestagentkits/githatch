// ============================================================================
// GitHoot Interactive Companion Showcase Component
// (src/client/components/InteractiveCompanionShowcase.tsx)
// ============================================================================

import React, { useState } from 'react';
import type { EggArchetype } from '../assets/eggs/manifest';
import { useEggAudio } from '../hooks/useEggAudio';

export interface InteractiveCompanionProps {
  archetype: EggArchetype;
  defaultPose?: string;
}

export const InteractiveCompanionShowcase: React.FC<InteractiveCompanionProps> = ({
  archetype,
  defaultPose = 'idle'
}) => {
  const [currentPose, setCurrentPose] = useState<string>(defaultPose);
  const [isHovered, setIsHovered] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const { playWobbleSound } = useEggAudio();

  const poses = [
    { id: 'idle', label: 'Idle', icon: '✦' },
    { id: 'happy', label: 'Happy', icon: '😊' },
    { id: 'sleepy', label: 'Sleepy', icon: '😴' },
    { id: 'proud', label: 'Proud', icon: '👑' },
    { id: 'angry', label: 'Combat', icon: '⚔️' },
    { id: 'work', label: 'Work', icon: '💻' },
    { id: 'celebrate', label: 'Celebrate', icon: '🎉' }
  ];

  const handlePoseChange = (poseId: string) => {
    setCurrentPose(poseId);
    setBouncing(true);
    playWobbleSound();
    setTimeout(() => setBouncing(false), 250);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: '#0d111a',
        border: isHovered ? `2px solid ${archetype.color.primary}` : `1px solid ${archetype.color.primary}33`,
        borderRadius: '16px',
        padding: '20px',
        boxShadow: isHovered ? `0 0 30px ${archetype.color.glow}, 0 12px 32px rgba(0,0,0,0.8)` : '0 4px 20px rgba(0,0,0,0.5)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {/* Visual Image Container with Glow Aura */}
      <div style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #1c2637 0%, #07090e 100%)',
        marginBottom: '16px',
        border: `1px solid ${archetype.color.primary}44`
      }}>
        <img
          src={archetype.companionImageUrl}
          alt={archetype.species}
          style={{
            width: '100%',
            aspectRatio: '1/1',
            objectFit: 'cover',
            display: 'block',
            transform: bouncing ? 'scale(1.06)' : isHovered ? 'scale(1.02)' : 'scale(1)',
            filter: currentPose === 'sleepy' ? 'brightness(0.85) contrast(0.95)' : currentPose === 'angry' ? 'contrast(1.2) saturate(1.3)' : 'none',
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease'
          }}
        />

        {/* Floating Active Pose Pill */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(7, 9, 14, 0.85)',
          border: `1px solid ${archetype.color.primary}`,
          color: archetype.color.primary,
          padding: '3px 10px',
          borderRadius: '9999px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 800,
          backdropFilter: 'blur(8px)',
          textTransform: 'uppercase'
        }}>
          Pose: [{currentPose}]
        </div>

        {/* Element Tag */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: archetype.color.primary,
          color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 900,
          padding: '3px 8px',
          borderRadius: '9999px',
          textTransform: 'uppercase'
        }}>
          {archetype.element.split('/')[0]}
        </div>
      </div>

      {/* Title & Info */}
      <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>
        {archetype.species}
      </h3>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: archetype.color.primary, marginBottom: '8px' }}>
        {archetype.element}
      </div>
      <p style={{ fontSize: '12px', color: '#8b9bb4', lineHeight: 1.4, margin: '0 0 16px', flex: 1 }}>
        {archetype.description}
      </p>

      {/* Interactive Emotion Bar */}
      <div>
        <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: '#53627a', marginBottom: '6px', fontWeight: 700 }}>
          CLICK ĐỂ THAY ĐỔI BIỂU CẢM (SPRITESHEET):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {poses.map(p => (
            <button
              key={p.id}
              onClick={() => handlePoseChange(p.id)}
              style={{
                background: currentPose === p.id ? archetype.color.primary : '#141b27',
                color: currentPose === p.id ? '#000' : '#8b9bb4',
                border: currentPose === p.id ? `1px solid ${archetype.color.primary}` : '1px solid rgba(255,255,255,0.06)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
