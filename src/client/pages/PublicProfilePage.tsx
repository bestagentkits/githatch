// ============================================================================
// GitHoot Public Profile Page (src/client/pages/PublicProfilePage.tsx)
// ============================================================================

import React, { useEffect, useState, useRef } from 'react';
import type { ResolvedProfile } from '../../server/types';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';
import { SocialSharePanel } from '../components/SocialSharePanel';
import { track } from '../lib/analytics';

function getRarityGlowColor(tier?: string): string {
  switch (tier) {
    case 'Rare': return '#3b82f6';
    case 'Epic': return '#ff2a85';
    case 'Legendary': return '#ffa800';
    case 'Mythic': return '#a855f7';
    case 'Common':
    default: return '#00f0ff';
  }
}

export const PublicProfilePage: React.FC<{ username: string }> = ({ username }) => {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eggCardRef = useRef<HTMLDivElement | null>(null);
  const eggTrackedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const profileRes = await fetch(`/api/profile/${encodeURIComponent(username)}`);

        if (profileRes.status === 404) {
          throw new Error(`GitHub user "@${username}" not found.`);
        }

        if (!profileRes.ok) {
          const errData = (await profileRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Failed to load profile');
        }

        const profileData = (await profileRes.json()) as ResolvedProfile;
        if (!isMounted) return;
        setProfile(profileData);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load profile';
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [username]);

  // Track egg_viewed ONLY when real profile egg card becomes >=50% visible (Contract §7)
  useEffect(() => {
    if (!profile || loading || profile.claimed || eggTrackedRef.current) return;
    const node = eggCardRef.current || (document.querySelector('.githoot-card') as HTMLElement | null);
    if (!node) return;

    const checkVisibility = () => {
      if (eggTrackedRef.current) return;
      const rect = node.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const visibleHeight = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0));
      const ratio = rect.height > 0 ? visibleHeight / rect.height : 0;

      if (ratio >= 0.5 && !eggTrackedRef.current) {
        eggTrackedRef.current = true;
        track('egg_viewed', {
          archetype_id: profile.egg_archetype_id,
          rarity_tier: profile.estimated_rarity
        });
      }
    };

    // Immediate check if card is already >=50% in initial viewport
    checkVisibility();

    const hasObserver = typeof IntersectionObserver !== 'undefined';
    if (!hasObserver) {
      window.addEventListener('scroll', checkVisibility, { passive: true });
      return () => window.removeEventListener('scroll', checkVisibility);
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !eggTrackedRef.current) {
          eggTrackedRef.current = true;
          track('egg_viewed', {
            archetype_id: profile.egg_archetype_id,
            rarity_tier: profile.estimated_rarity
          });
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(node);
    window.addEventListener('scroll', checkVisibility, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkVisibility);
    };
  }, [profile, loading]);
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090e', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace", padding: '24px', textAlign: 'center' }}>
        <div>✦ Scanning GitHub Realm for @{username}... ✦</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07090e', color: '#ff2a85', fontFamily: "'JetBrains Mono', monospace", padding: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(20px, 4vw, 28px)' }}>⚠️ {error || 'User not found'}</h2>
        <a href="/" style={{ marginTop: '16px', color: '#00f0ff', textDecoration: 'none', borderBottom: '1px solid #00f0ff', paddingBottom: '2px' }}>← Back to GitHoot.com</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', background: '#07090e', color: '#f0f6fc', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      {/* Main Responsive Container */}
      <main className="githoot-container" style={{ margin: 'clamp(20px, 4vw, 40px) auto' }}>
        
        {/* Top Realm Status Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          padding: '12px 16px',
          background: 'rgba(16, 22, 38, 0.6)',
          border: '1px solid rgba(0, 240, 255, 0.15)',
          borderRadius: '12px',
          backdropFilter: 'blur(8px)'
        }}>
          <a
            href="/"
            style={{
              color: '#00f0ff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>←</span>
            <span>Return to Realm Portal</span>
          </a>

          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#8b9bb4',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: profile.claimed ? '#00ff88' : '#ffa800', boxShadow: profile.claimed ? '0 0 8px #00ff88' : '0 0 8px #ffa800' }} />
            <span>{profile.claimed ? 'GUARDIAN BOUND' : 'GENESIS EGG WAITING'}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ color: '#00f0ff' }}>SEED: 0x{profile.dna_seed.slice(0, 8)}</span>
          </div>
        </div>

        <div className="githoot-main-grid">
          
          {/* Left Column: Interactive Egg or Hatched Living Guardian */}
          <div
            ref={eggCardRef}
            className="githoot-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '380px',
              border: profile.claimed && profile.guardian ? `2px solid ${getRarityGlowColor(profile.guardian.rarity_tier)}` : '1px solid rgba(0, 240, 255, 0.2)',
              boxShadow: profile.claimed && profile.guardian ? `0 0 40px ${getRarityGlowColor(profile.guardian.rarity_tier)}33` : '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            {profile.claimed && profile.guardian ? (
              <div className="guardian-stage" style={{ width: '100%' }}>
                {/* Rarity & Genesis Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(0, 240, 255, 0.08)',
                  border: `1px solid ${getRarityGlowColor(profile.guardian.rarity_tier)}`,
                  color: getRarityGlowColor(profile.guardian.rarity_tier),
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 16px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: '12px'
                }}>
                  ✦ {profile.guardian.rarity_tier} GUARDIAN ✦
                </div>

                {/* Floating Pedestal & Hero Sprite */}
                <div
                  className="guardian-pedestal"
                  style={{ '--pedestal-glow': getRarityGlowColor(profile.guardian.rarity_tier) } as React.CSSProperties}
                >
                  <img
                    src={profile.guardian.hero_image_url}
                    alt={profile.guardian.name}
                    className="guardian-hero-sprite"
                  />
                </div>

                {/* Guardian Title */}
                <h2 style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontSize: 'clamp(22px, 3.5vw, 28px)',
                  fontWeight: 900,
                  color: '#ffffff',
                  margin: '0 0 6px 0',
                  textAlign: 'center'
                }}>
                  {profile.guardian.name}
                </h2>

                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  color: '#8b9bb4',
                  textAlign: 'center',
                  marginBottom: '14px'
                }}>
                  Species: <span style={{ color: '#00f0ff', fontWeight: 700 }}>{profile.guardian.species}</span>
                </div>

                {/* Status Badges Row */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
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
                    🔥 {profile.guardian.element}
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
                    LVL {profile.guardian.level}
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
                    ⚡ {profile.guardian.energy_state}
                  </span>
                </div>

                {/* XP Progression Bar */}
                <div style={{
                  width: '100%',
                  maxWidth: '320px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '9999px',
                  padding: '3px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    width: `${Math.max(5, Math.min(100, profile.guardian.experience))}%`,
                    height: '6px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, #00f0ff, #ff2a85)',
                    boxShadow: '0 0 8px rgba(0, 240, 255, 0.5)'
                  }} />
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  color: '#53627a',
                  marginTop: '6px',
                  textAlign: 'center'
                }}>
                  EXPERIENCE: {profile.guardian.experience} / 100 EXP · SHIELDING {profile.public_repos} REPOS
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <EggSpritesheetPlayer archetypeId={profile.egg_archetype_id} />
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: '#8b9bb4',
                  marginTop: '12px',
                  textAlign: 'center'
                }}>
                  Genesis Drop Odds: <span style={{ color: '#00f0ff' }}>60% Common · 25% Rare · 10% Epic · 4% Legendary · 1% Mythic</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Developer Snapshot & Claim Action */}
          <div className="githoot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            
            <div>
              {/* Dev Info Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <img
                  src={profile.avatar_url}
                  alt={profile.login}
                  style={{
                    width: 'clamp(52px, 12vw, 68px)',
                    height: 'clamp(52px, 12vw, 68px)',
                    borderRadius: '50%',
                    border: '2px solid #00f0ff',
                    boxShadow: '0 0 16px rgba(0, 240, 255, 0.35)',
                    flexShrink: 0
                  }}
                />
                <div style={{ overflow: 'hidden' }}>
                  <h1 style={{
                    fontFamily: "'Archivo', sans-serif",
                    fontSize: 'clamp(20px, 4vw, 26px)',
                    fontWeight: 900,
                    margin: 0,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}>
                    {profile.name || profile.login}
                  </h1>
                  <a
                    href={`https://github.com/${encodeURIComponent(profile.login)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#00f0ff',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '13px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '2px'
                    }}
                  >
                    <span>@{profile.login}</span>
                    <span style={{ fontSize: '10px' }}>↗</span>
                  </a>
                </div>
              </div>

              {profile.bio && (
                <p style={{ fontSize: '13px', color: '#c8d6e5', marginBottom: '20px', lineHeight: 1.6 }}>
                  {profile.bio}
                </p>
              )}

              {/* Dev Stats Grid */}
              <div className="githoot-stats-grid" style={{ marginBottom: '24px' }}>
                <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#00f0ff' }}>
                    {profile.public_repos}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Public Repos</div>
                </div>

                <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#00f0ff' }}>
                    {profile.followers}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Followers</div>
                </div>

                <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 800, color: '#ffa800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.top_languages[0] || 'Polyglot'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Primary Stack</div>
                </div>

                <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: '10px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 800, color: '#ff2a85' }}>
                    {profile.estimated_rarity}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Genesis Rarity</div>
                </div>
              </div>
            </div>

            {/* Claim CTA or Owner Bound Banner & Share Panel */}
            {profile.claimed && profile.guardian ? (
              <div>
                <div className="claimed-owner-badge">
                  <span style={{ fontSize: '14px' }}>🛡️</span>
                  <span>Verified Owner · Bound to GitHub #{profile.github_user_id}</span>
                </div>
                <SocialSharePanel username={profile.login} guardian={profile.guardian} />
              </div>
            ) : (
              <div>
                <a
                  href={`/auth/github?claim_username=${encodeURIComponent(profile.login)}`}
                  className="btn-touch"
                  onClick={() => {
                    track('claim_started', { archetype_id: profile.egg_archetype_id });
                  }}
                  style={{
                    width: '100%',
                    background: '#00f0ff',
                    color: '#000',
                    padding: '14px 20px',
                    borderRadius: '10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 'clamp(13px, 2.5vw, 15px)',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 0 28px rgba(0,240,255,0.4)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    textAlign: 'center',
                    display: 'block',
                    boxSizing: 'border-box'
                  }}
                >
                  🚀 Claim & Awaken Guardian Free
                </a>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#8b9bb4', marginTop: '10px' }}>
                  ✓ Free forever · Only the owner of @{profile.login} can claim this companion.
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};
