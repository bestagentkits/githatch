// ============================================================================
// GitHoot Gacha Hatch Reveal Ritual Modal (src/client/components/GachaRevealModal.tsx)
// ============================================================================

import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const stopConfetti = launchConfettiBurst(canvasRef.current, getRarityColor(guardian.rarity_tier));
      return stopConfetti;
    }
  }, [isOpen, guardian.rarity_tier]);

  if (!isOpen) return null;

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
        className="githoot-modal-card"
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
          ★ ★ ★ {guardian.rarity_tier} HATCH ★ ★ ★
        </div>

        <h2 style={{
          fontFamily: "'Archivo', sans-serif",
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 900,
          color: '#ffffff',
          marginBottom: '8px'
        }}>
          {guardian.name} Đã Thức Tỉnh!
        </h2>

        <p style={{ fontSize: '13px', color: '#8b9bb4', marginBottom: '20px' }}>
          Linh thú hộ mệnh hệ <strong>{guardian.element}</strong> bảo vệ các dự án mã nguồn mở của <strong>@{username}</strong>.
        </p>

        {/* Character Portrait (Responsive max 220px) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <img
            src={guardian.hero_image_url}
            alt={guardian.name}
            style={{
              width: 'clamp(160px, 40vw, 220px)',
              height: 'clamp(160px, 40vw, 220px)',
              objectFit: 'cover',
              borderRadius: '16px',
              border: `2px solid ${getRarityColor(guardian.rarity_tier)}`,
              boxShadow: `0 0 30px ${getRarityGlow(guardian.rarity_tier)}`
            }}
          />
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
