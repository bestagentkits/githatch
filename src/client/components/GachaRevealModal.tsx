// ============================================================================
// GitHoot Gacha Hatch Reveal Ritual Modal (src/client/components/GachaRevealModal.tsx)
// ============================================================================

import React, { useEffect, useRef } from 'react';
import type { GuardianSummary } from '../../server/types';
import { track } from '../lib/analytics';
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
          boxShadow: `0 0 60px ${getRarityGlow(guardian.rarity_tier)}, 0 20px 60px rgba(0,0,0,0.85)`
        }}
      >
        {/* Hologram Rarity Header Pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: getRarityGradient(guardian.rarity_tier),
          color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 900,
          padding: '6px 20px',
          borderRadius: '9999px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: '14px',
          boxShadow: `0 0 20px ${getRarityGlow(guardian.rarity_tier)}`
        }}>
          <span>✦ ✦ ✦</span>
          <span>{guardian.rarity_tier} HATCH</span>
          <span>✦ ✦ ✦</span>
        </div>

        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          fontWeight: 700,
          color: '#00f0ff',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '4px'
        }}>
          Ritual Complete · Genesis Awakening
        </div>

        <h2 style={{
          fontFamily: "'Archivo', sans-serif",
          fontSize: 'clamp(24px, 5vw, 36px)',
          fontWeight: 900,
          color: '#ffffff',
          margin: '0 0 8px 0',
          textShadow: '0 0 24px rgba(255,255,255,0.3)'
        }}>
          {guardian.name}
        </h2>

        <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '0 auto 20px auto', maxWidth: '460px', lineHeight: 1.5 }}>
          Living Guardian bound to protect <strong style={{ color: '#00f0ff' }}>@{username}</strong>'s open-source realm.
        </p>

        {/* Grand Floating Pedestal Stage */}
        <div className="guardian-stage">
          <div
            className="guardian-pedestal"
            style={{ '--pedestal-glow': getRarityGlow(guardian.rarity_tier) } as React.CSSProperties}
          >
            <img
              src={guardian.hero_image_url}
              alt={guardian.name}
              className="guardian-hero-sprite"
            />
          </div>

          {/* Elemental & Progression Badges */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 42, 133, 0.12)',
              border: '1px solid rgba(255, 42, 133, 0.35)',
              color: '#ff2a85'
            }}>
              🔥 {guardian.element}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '6px',
              background: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              color: '#00f0ff'
            }}>
              LVL {guardian.level}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '6px',
              background: 'rgba(0, 255, 136, 0.12)',
              border: '1px solid rgba(0, 255, 136, 0.35)',
              color: '#00ff88'
            }}>
              ⚡ {guardian.energy_state}
            </span>
          </div>
        </div>

        {/* Social Share Embedded Section */}
        <div style={{ marginBottom: '24px' }}>
          <SocialSharePanel username={username} guardian={guardian} />
        </div>

        <div>
          <button
            onClick={onClose}
            className="btn-touch"
            style={{
              background: '#00f0ff',
              color: '#000',
              border: 'none',
              padding: '14px 32px',
              borderRadius: '10px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(0,240,255,0.4)',
              width: '100%',
              maxWidth: '360px',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
          >
            View Official Profile →
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
