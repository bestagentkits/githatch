// ============================================================================
// GitHoot Gacha Hatch Reveal Ritual Modal (src/client/components/GachaRevealModal.tsx)
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import type { GuardianSummary } from '../../server/types';
import { launchConfettiBurst } from '../utils/particles';
import { SocialSharePanel } from './SocialSharePanel';

export interface GachaRevealModalProps {
  username: string;
  guardian: GuardianSummary;
  isOpen: boolean;
  onClose: () => void;
}

export const GachaRevealModal: React.FC<GachaRevealModalProps> = ({
  username,
  guardian,
  isOpen,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentFrame, setCurrentFrame] = useState<number>(16);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const stripUrl = guardian.spritesheet_url || '';

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const stopConfetti = launchConfettiBurst(canvasRef.current, getRarityColor(guardian.rarity_tier));
      return stopConfetti;
    }
  }, [isOpen, guardian.rarity_tier]);

  useEffect(() => {
    if (isOpen && stripUrl) {
      playLanding(1.1);
    }
  }, [isOpen, stripUrl]);

  const playLanding = (duration = 1.1) => {
    setIsPlaying(false);
    setIsShaking(false);
    setCurrentFrame(1);

    setTimeout(() => {
      setIsPlaying(true);
      // Synchronize seismic shock at ~45% timeline (Frame 7: Three-Point Landing)
      setTimeout(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 560);
      }, duration * 1000 * 0.45);

      // Settle at Frame 16
      setTimeout(() => {
        setIsPlaying(false);
        setCurrentFrame(16);
      }, duration * 1000);
    }, 50);
  };

  const handleScrub = (frameIndex: number) => {
    setIsPlaying(false);
    setCurrentFrame(frameIndex);
    if (frameIndex === 7 || frameIndex === 8) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
  };

  if (!isOpen) return null;

  // Formula: -(k - 1) * 256px
  const bgPositionX = -((currentFrame - 1) * 256);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'radial-gradient(circle at center, rgba(27, 10, 42, 0.95) 0%, rgba(5, 6, 8, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px',
      overflowY: 'auto'
    }}>
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2001
        }}
      />

      {/* Main Reveal Card */}
      <div
        className={`githoot-modal-card shake-box ${isShaking ? 'active-shake' : ''}`}
        style={{
          border: `2px solid ${getRarityColor(guardian.rarity_tier)}`,
          boxShadow: `0 0 50px ${getRarityGlow(guardian.rarity_tier)}`
        }}
      >
        {/* Hologram Rarity Header */}
        <div style={{
          display: 'inline-block',
          background: getRarityGradient(guardian.rarity_tier),
          color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 900,
          padding: '6px 18px',
          borderRadius: '9999px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
        }}>
          ★ ★ ★ {guardian.rarity_tier} HATCH REVEALED ★ ★ ★
        </div>

        <h2 style={{
          fontFamily: "'Archivo', sans-serif",
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 900,
          color: '#ffffff',
          marginBottom: '4px'
        }}>
          {guardian.species_name || guardian.name} Đã Thức Tỉnh!
        </h2>

        <p style={{ fontSize: '13px', color: '#8b9bb4', marginBottom: '16px' }}>
          Linh thú hộ mệnh hệ <strong>{guardian.element}</strong> bảo vệ các dự án mã nguồn mở của <strong>@{username}</strong>.
        </p>

        {/* 16-Frame Landing Player Viewport */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '256px',
            height: '256px',
            borderRadius: '12px',
            border: '2px solid #00f0ff',
            boxShadow: '0 0 24px rgba(0, 240, 255, 0.35)',
            background: 'radial-gradient(circle at 50% 80%, rgba(0,240,255,0.12), #07090e 70%)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {stripUrl ? (
              <div
                className={`landing-sprite-frame ${isPlaying ? 'play' : ''}`}
                style={{
                  backgroundImage: `url(${stripUrl})`,
                  backgroundPosition: isPlaying ? undefined : `${bgPositionX}px 0`
                }}
              />
            ) : (
              <img
                src={guardian.hero_image_url || ''}
                alt={guardian.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            )}
          </div>

          {/* Scrubber Controls */}
          {stripUrl && (
            <div style={{ width: '100%', maxWidth: '340px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4', marginBottom: '4px' }}>
                <span>FRAME: {currentFrame}/16</span>
                <span style={{ color: currentFrame === 7 ? '#ff2a85' : '#00f0ff' }}>
                  {currentFrame === 7 ? '⚡ TIẾP ĐẤT 3 ĐIỂM' : currentFrame === 16 ? '👑 THẾ ANH HÙNG' : 'HẠ CÁNH'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                value={currentFrame}
                onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#00f0ff', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  onClick={() => playLanding(1.1)}
                  style={{
                    background: 'rgba(0,240,255,0.1)',
                    border: '1px solid #00f0ff',
                    color: '#00f0ff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ▶ Replay (1.1s)
                </button>
                <button
                  onClick={() => playLanding(4.4)}
                  style={{
                    background: '#141b27',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f0f6fc',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🐌 Slow-Mo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Social Share Embedded Section */}
        <SocialSharePanel username={username} guardian={guardian} />

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={onClose}
            className="btn-touch"
            style={{
              background: '#00f0ff',
              color: '#000',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0,240,255,0.35)',
              width: '100%',
              maxWidth: '320px'
            }}
          >
            Vào Trang Profile Chính Thức →
          </button>
        </div>
      </div>
    </div>
  );
};

function getRarityColor(tier: string): string {
  switch (tier) {
    case 'Mythic': return '#e2b340';
    case 'Legendary': return '#ff2a85';
    case 'Epic': return '#7928ca';
    case 'Rare': return '#00f0ff';
    default: return '#00ff88';
  }
}

function getRarityGlow(tier: string): string {
  switch (tier) {
    case 'Mythic': return 'rgba(226, 179, 64, 0.4)';
    case 'Legendary': return 'rgba(255, 42, 133, 0.4)';
    case 'Epic': return 'rgba(121, 40, 202, 0.4)';
    case 'Rare': return 'rgba(0, 240, 255, 0.4)';
    default: return 'rgba(0, 255, 136, 0.3)';
  }
}

function getRarityGradient(tier: string): string {
  switch (tier) {
    case 'Mythic': return 'linear-gradient(90deg, #e2b340, #ff0080, #00f0ff)';
    case 'Legendary': return 'linear-gradient(90deg, #ff2a85, #ffa800)';
    case 'Epic': return 'linear-gradient(90deg, #7928ca, #00f0ff)';
    case 'Rare': return 'linear-gradient(90deg, #00f0ff, #00ff88)';
    default: return 'linear-gradient(90deg, #00ff88, #50e3c2)';
  }
}
