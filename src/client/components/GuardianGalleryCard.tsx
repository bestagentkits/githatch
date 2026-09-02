// ============================================================================
// GitHoot Guardian Gallery Card Component
// (src/client/components/GuardianGalleryCard.tsx)
// Option 1 Cyber-Arcade Fantasy Card with Lazy On-Demand Sprite Animation
// ============================================================================

import React, { useState, useEffect } from 'react';
import type { GalleryItem, RarityTier } from '../../server/types';

export interface GuardianGalleryCardProps {
  item: GalleryItem;
  onRouteChange: (route: string) => void;
}

export const RARITY_COLORS: Record<RarityTier, { border: string; glow: string; text: string; bg: string }> = {
  Common: {
    border: 'rgba(139, 155, 180, 0.4)',
    glow: 'rgba(139, 155, 180, 0.2)',
    text: '#8b9bb4',
    bg: 'rgba(139, 155, 180, 0.08)'
  },
  Rare: {
    border: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.35)',
    text: '#00f0ff',
    bg: 'rgba(0, 240, 255, 0.08)'
  },
  Epic: {
    border: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.35)',
    text: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.08)'
  },
  Legendary: {
    border: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.08)'
  },
  Mythic: {
    border: '#ff2a85',
    glow: 'rgba(255, 42, 133, 0.45)',
    text: '#ff2a85',
    bg: 'rgba(255, 42, 133, 0.1)'
  }
};

const ELEMENT_EMOJIS: Record<string, string> = {
  Fire: '🔥',
  Cyber: '⚡',
  Water: '💧',
  Nature: '🌿',
  Light: '✨',
  Void: '🌑',
  Metal: '⚙️',
  Cosmic: '🌌'
};

export const GuardianGalleryCard: React.FC<GuardianGalleryCardProps> = ({ item, onRouteChange }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  const rarityTheme = RARITY_COLORS[item.rarity_tier] || RARITY_COLORS.Common;
  const elementEmoji = ELEMENT_EMOJIS[item.element] || '✦';

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onRouteChange(`/${encodeURIComponent(item.owner.login)}`);
  };

  const showAnimatedSprite = isHovered && !prefersReducedMotion && Boolean(item.spritesheet_url);

  return (
    <article
      className="guardian-gallery-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      style={{
        background: '#0d111a',
        borderRadius: '16px',
        border: `1px solid ${isHovered ? rarityTheme.border : 'rgba(0, 240, 255, 0.15)'}`,
        boxShadow: isHovered
          ? `0 8px 32px ${rarityTheme.glow}, inset 0 0 16px ${rarityTheme.bg}`
          : '0 4px 20px rgba(0, 0, 0, 0.4)',
        transition: prefersReducedMotion ? 'none' : 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isHovered && !prefersReducedMotion ? 'translateY(-4px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer'
      }}
      onClick={handleCardClick}
    >
      {/* Top Header: Rarity Badge & Element Chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: rarityTheme.bg,
            border: `1px solid ${rarityTheme.border}`,
            color: rarityTheme.text,
            borderRadius: '9999px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
        >
          ✦ {item.rarity_tier}
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f0f6fc',
            borderRadius: '9999px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          {elementEmoji} {item.element}
        </span>
      </div>

      {/* Hero Media Stage */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.06) 0%, rgba(7, 9, 14, 0.8) 75%)',
          padding: '12px',
          overflow: 'hidden'
        }}
      >
        {showAnimatedSprite && item.spritesheet_url ? (
          <div
            className="gallery-sprite-anim"
            aria-label={`${item.name} animation`}
            style={{
              width: '180px',
              height: '180px',
              backgroundImage: `url(${item.spritesheet_url})`,
              backgroundSize: '2880px 180px', // 16 frames: 16 * 180 = 2880px
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
              animation: 'gallery-strip-play 1.1s steps(15) forwards'
            }}
          />
        ) : !imageError && item.hero_image_url ? (
          <img
            src={item.hero_image_url}
            alt={`${item.name}, ${item.rarity_tier} ${item.element} Guardian`}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              filter: `drop-shadow(0 0 16px ${rarityTheme.glow})`,
              transition: prefersReducedMotion ? 'none' : 'transform 0.3s ease'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              color: '#8b9bb4'
            }}
          >
            <span style={{ fontSize: '48px' }}>🦉</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
              {item.species}
            </span>
          </div>
        )}

        {/* Level Badge Float */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(7, 9, 14, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            backdropFilter: 'blur(8px)',
            borderRadius: '6px',
            padding: '2px 6px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 800,
            color: '#00f0ff'
          }}
        >
          LVL {item.level}
        </div>
      </div>

      {/* Card Info Details */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <h3
            style={{
              margin: '0 0 2px',
              fontFamily: "'Archivo', sans-serif",
              fontSize: '16px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {item.name}
          </h3>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#00f0ff',
              fontWeight: 700
            }}
          >
            {item.species_name || item.species}
          </div>
        </div>

        {/* Owner GitHub Details Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {item.owner.avatar_url ? (
              <img
                src={item.owner.avatar_url}
                alt={item.owner.login}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#1f293d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0
                }}
              >
                👤
              </div>
            )}
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                color: '#c8d6e5',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              @{item.owner.login}
            </span>
          </div>

          <div
            title={`${item.owner.total_stars} repository stars`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#f59e0b',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            <span>★</span>
            <span>{item.owner.total_stars}</span>
          </div>
        </div>
      </div>
    </article>
  );
};
