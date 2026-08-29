// ============================================================================
// GitHoot Interactive Companion Showcase with Real Spritesheet Canvas Engine
// (src/client/components/InteractiveCompanionShowcase.tsx)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const { playWobbleSound } = useEggAudio();

  const poses = [
    { id: 'idle', label: 'Idle', icon: '✦', col: 1, row: 0 },
    { id: 'happy', label: 'Happy', icon: '😊', col: 2, row: 0 },
    { id: 'sleepy', label: 'Sleepy', icon: '😴', col: 3, row: 0 },
    { id: 'proud', label: 'Proud', icon: '👑', col: 0, row: 1 },
    { id: 'angry', label: 'Combat', icon: '⚔️', col: 1, row: 1 },
    { id: 'work', label: 'Work', icon: '💻', col: 2, row: 1 },
    { id: 'celebrate', label: 'Celebrate', icon: '🎉', col: 3, row: 1 }
  ];

  // Draw current frame onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const activePose = poses.find(p => p.id === currentPose) || poses[0]!;

    const img = new Image();
    const sheetSrc = `/assets/sample-pets/${archetype.id}-spritesheet.png`;
    img.src = sheetSrc;
    img.onload = () => {
      imageRef.current = img;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Source: 256x256 sub-region
      const srcX = activePose.col * 256;
      const srcY = activePose.row * 256;
      ctx.drawImage(img, srcX, srcY, 256, 256, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      // Fallback to static hero image
      const fallbackImg = new Image();
      fallbackImg.src = archetype.companionImageUrl;
      fallbackImg.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
      };
    };
  }, [archetype.id, currentPose, archetype.companionImageUrl]);

  const handlePoseChange = (poseId: string) => {
    setCurrentPose(poseId);
    playWobbleSound();
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
      {/* Visual Canvas Container with Spritesheet Engine */}
      <div style={{
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #1c2637 0%, #07090e 100%)',
        marginBottom: '16px',
        border: `1px solid ${archetype.color.primary}44`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '220px'
      }}>
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          style={{
            width: '100%',
            maxWidth: '240px',
            aspectRatio: '1/1',
            display: 'block',
            imageRendering: 'pixelated',
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
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
          Spritesheet Frame: [{currentPose}]
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
          CLICK ĐỂ ĐỔI KHUNG HÌNH (SPRITESHEET):
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
