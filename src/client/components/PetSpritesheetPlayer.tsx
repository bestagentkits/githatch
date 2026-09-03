// ============================================================================
// GitHoot Pet Spritesheet & Emotion Player (src/client/components/PetSpritesheetPlayer.tsx)
// Authentic Canvas & CSS Spritesheet Engine with Continuous Idle Motion Loop
// and Interactive Emotion States (Idle, Happy, Sad, Excited, Angry, Surprised, Sleep)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import type { GuardianSummary } from '../../server/types';

export interface PetPlayerProps {
  guardian: GuardianSummary;
  interactive?: boolean;
  showControls?: boolean;
  initialPose?: PetEmotion;
  onPoseChange?: (pose: PetEmotion) => void;
}

export type PetEmotion = 'idle' | 'happy' | 'sad' | 'excited' | 'angry' | 'surprised' | 'sleep';

export interface EmotionConfig {
  id: PetEmotion;
  label: string;
  icon: string;
  col: number;
  row: number;
  color: string;
  description: string;
}

export const PET_EMOTIONS: EmotionConfig[] = [
  { id: 'idle', label: 'Idle', icon: '✦', col: 1, row: 0, color: '#00f0ff', description: 'Chuyển động thở & bồng bềnh tự nhiên' },
  { id: 'happy', label: 'Happy', icon: '😊', col: 2, row: 0, color: '#00ff88', description: 'Hân hoan vui mừng cùng bạn' },
  { id: 'sad', label: 'Sad', icon: '🥺', col: 0, row: 0, color: '#60a5fa', description: 'U buồn cần thêm commit mới' },
  { id: 'excited', label: 'Excited', icon: '⚡', col: 1, row: 1, color: '#ffa800', description: 'Sôi nổi bừng sáng năng lượng' },
  { id: 'angry', label: 'Combat', icon: '⚔️', col: 1, row: 1, color: '#ff2a85', description: 'Tức giận sẵn sàng nghênh chiến' },
  { id: 'surprised', label: 'Shock', icon: '😲', col: 0, row: 1, color: '#e879f9', description: 'Ngạc nhiên sửng sốt' },
  { id: 'sleep', label: 'Sleep', icon: '😴', col: 3, row: 0, color: '#a855f7', description: 'Say giấc ngủ đông êm đềm' }
];

export const PetSpritesheetPlayer: React.FC<PetPlayerProps> = ({
  guardian,
  interactive = true,
  showControls = true,
  initialPose = 'idle',
  onPoseChange
}) => {
  const [currentPose, setCurrentPose] = useState<PetEmotion>(initialPose);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteImageRef = useRef<HTMLImageElement | null>(null);

  const activeEmotion = PET_EMOTIONS.find(e => e.id === currentPose) || PET_EMOTIONS[0];

  // Resolve sheet and hero sources
  const speciesSlug = (guardian.species || 'celestialdrake').toLowerCase().replace(/[^a-z0-9]/g, '');
  const spritesheetUrl = guardian.spritesheet_url || `/assets/sample-pets/${speciesSlug}-spritesheet.png`;
  const heroUrl = guardian.hero_image_url || `/assets/sample-pets/${speciesSlug}.webp`;

  // Preload and draw the active frame onto the canvas
  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = spritesheetUrl;

    img.onload = () => {
      if (isCancelled) return;
      spriteImageRef.current = img;
      setImageLoaded(true);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spritesheet frame sub-region (256x256)
      const srcX = activeEmotion.col * 256;
      const srcY = activeEmotion.row * 256;

      // Draw centered onto 256x256 canvas
      ctx.drawImage(img, srcX, srcY, 256, 256, 0, 0, canvas.width, canvas.height);
    };

    img.onerror = () => {
      if (isCancelled) return;
      // Fallback: draw static hero image
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.src = heroUrl;
      fallbackImg.onload = () => {
        if (isCancelled) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(fallbackImg, 0, 0, canvas.width, canvas.height);
        setImageLoaded(true);
      };
    };

    return () => {
      isCancelled = true;
    };
  }, [spritesheetUrl, heroUrl, activeEmotion.col, activeEmotion.row]);

  const handlePoseSelect = (emotion: PetEmotion) => {
    if (emotion === currentPose) return;
    setCurrentPose(emotion);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 350);
    if (onPoseChange) {
      onPoseChange(emotion);
    }
  };

  // Determine dynamic motion class based on pose
  const getMotionAnimation = () => {
    switch (currentPose) {
      case 'idle':
        return 'githoot-motion-idle';
      case 'happy':
        return 'githoot-motion-happy';
      case 'excited':
        return 'githoot-motion-excited';
      case 'angry':
        return 'githoot-motion-angry';
      case 'surprised':
        return 'githoot-motion-surprised';
      case 'sleep':
        return 'githoot-motion-sleep';
      case 'sad':
        return 'githoot-motion-sad';
      default:
        return 'githoot-motion-idle';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%'
    }}>
      {/* Visual Canvas Box with Organic Cyber-Arcade Idle Loop */}
      <div style={{
        position: 'relative',
        width: '256px',
        height: '256px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className={`guardian-hero-sprite ${getMotionAnimation()} ${isTransitioning ? 'githoot-pose-pulse' : ''}`}
          style={{
            width: '256px',
            height: '256px',
            imageRendering: 'pixelated',
            filter: currentPose === 'sleep'
              ? 'drop-shadow(0 0 16px rgba(168, 85, 247, 0.45)) brightness(0.9)'
              : currentPose === 'angry'
              ? 'drop-shadow(0 0 20px rgba(255, 42, 133, 0.6))'
              : currentPose === 'excited'
              ? 'drop-shadow(0 0 22px rgba(255, 168, 0, 0.65))'
              : `drop-shadow(0 0 18px ${activeEmotion.color}55)`,
            transition: 'filter 0.3s ease-out'
          }}
        />

        {/* Emotion Pill Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '2px',
          background: 'rgba(7, 9, 14, 0.85)',
          border: `1px solid ${activeEmotion.color}`,
          color: activeEmotion.color,
          padding: '2px 10px',
          borderRadius: '9999px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          backdropFilter: 'blur(6px)',
          boxShadow: `0 0 10px ${activeEmotion.color}44`,
          pointerEvents: 'none'
        }}>
          {activeEmotion.icon} {activeEmotion.label}
        </div>
      </div>

      {/* Interactive Emotion Switcher Toolbar */}
      {interactive && showControls && (
        <div style={{
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          maxWidth: '340px'
        }}>
          <div style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: '#8b9bb4',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700
          }}>
            ✦ Companion Emotion States ✦
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {PET_EMOTIONS.map(emotion => {
              const isActive = emotion.id === currentPose;
              return (
                <button
                  key={emotion.id}
                  type="button"
                  onClick={() => handlePoseSelect(emotion.id)}
                  title={emotion.description}
                  style={{
                    background: isActive ? `${emotion.color}22` : 'transparent',
                    border: isActive ? `1px solid ${emotion.color}` : '1px solid transparent',
                    color: isActive ? emotion.color : '#8b9bb4',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: isActive ? `0 0 8px ${emotion.color}33` : 'none'
                  }}
                >
                  <span>{emotion.icon}</span>
                  <span>{emotion.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
