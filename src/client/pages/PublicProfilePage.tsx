// ============================================================================
// GitHoot Public Profile Page (src/client/pages/PublicProfilePage.tsx)
// ============================================================================

import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { ResolvedProfile } from '../../server/types';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';
import { PetSpritesheetPlayer } from '../components/PetSpritesheetPlayer';
import { SocialSharePanel } from '../components/SocialSharePanel';
import { track } from '../lib/analytics';
import { calculateLevelProgression, getActivityExp, LevelProgression } from '../utils/progression';
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

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 3600));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  } catch {
    return 'recently';
  }
}

function getLangColor(lang: string | null): string {
  switch (lang) {
    case 'TypeScript': return '#3178c6';
    case 'JavaScript': return '#f7df1e';
    case 'Python': return '#3776ab';
    case 'Rust': return '#dea584';
    case 'Go': return '#00add8';
    case 'HTML': return '#e34f26';
    case 'CSS': return '#563d7c';
    case 'C++': return '#f34b7d';
    case 'C': return '#555555';
    case 'PHP': return '#4f5d95';
    case 'Java': return '#b07219';
    case 'Swift': return '#f05138';
    default: return '#00f0ff';
  }
}

export const PublicProfilePage: React.FC<{ username: string }> = ({ username }) => {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoTab, setRepoTab] = useState<'highlighted' | 'active'>('highlighted');
  const [sessionLogin, setSessionLogin] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState<boolean>(false);
  const eggCardRef = useRef<HTMLDivElement | null>(null);
  const eggTrackedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.authenticated && data.user) {
          setSessionLogin(String(data.user.login).toLowerCase());
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const progression: LevelProgression | null = useMemo(() => {
    if (!profile?.guardian) return null;
    if (profile.guardian.progression) return profile.guardian.progression;
    return calculateLevelProgression(profile.guardian.experience || 0);
  }, [profile?.guardian]);
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
              justifyContent: 'flex-start',
              alignItems: 'center',
              minHeight: '380px',
              border: profile.claimed && profile.guardian ? `2px solid ${getRarityGlowColor(profile.guardian.rarity_tier)}` : '1px solid rgba(0, 240, 255, 0.2)',
              boxShadow: profile.claimed && profile.guardian ? `0 0 40px ${getRarityGlowColor(profile.guardian.rarity_tier)}33` : '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            {profile.claimed && profile.guardian ? (
              <div className="guardian-stage" style={{ width: '100%' }}>
                {/* Rarity & Status Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: profile.guardian.status === 'ASSET_READY' ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 168, 0, 0.08)',
                  border: `1px solid ${profile.guardian.status === 'ASSET_READY' ? getRarityGlowColor(profile.guardian.rarity_tier) : '#ffa800'}`,
                  color: profile.guardian.status === 'ASSET_READY' ? getRarityGlowColor(profile.guardian.rarity_tier) : '#ffa800',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 16px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  marginBottom: '12px'
                }}>
                  {profile.guardian.status === 'ASSET_READY'
                    ? `✦ ${profile.guardian.rarity_tier} GUARDIAN ✦`
                    : '✦ HATCHING IN PROGRESS ✦'}
                </div>

                {/* Floating Pedestal & Animated Spritesheet Companion */}
                <div
                  className="guardian-pedestal"
                  style={{
                    '--pedestal-glow': getRarityGlowColor(profile.guardian.rarity_tier),
                    minHeight: '310px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%'
                  } as React.CSSProperties}
                >
                  <PetSpritesheetPlayer
                    guardian={profile.guardian}
                    interactive={true}
                    showControls={true}
                    initialPose="idle"
                  />
                </div>
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
                  Species: <span style={{ color: '#00f0ff', fontWeight: 700 }}>{profile.guardian.species_name || profile.guardian.species}</span>
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
                    LVL {progression?.level || profile.guardian.level || 1}
                  </span>
                  <span
                    title={profile.mood?.description || 'Hoạt động GitHub'}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '4px 12px',
                      borderRadius: '6px',
                      background: 'rgba(0, 255, 136, 0.12)',
                      border: `1px solid ${profile.mood?.badgeColor || '#00f0ff'}`,
                      color: profile.mood?.badgeColor || '#00f0ff',
                      cursor: 'help'
                    }}
                  >
                    {profile.mood?.title || '✦ Activity Syncing'}
                  </span>
                </div>

                {/* Mood Description Note */}
                <p style={{
                  fontFamily: "'Schibsted Grotesk', sans-serif",
                  fontSize: '11px',
                  color: '#8b9bb4',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  margin: '0 auto 12px auto',
                  maxWidth: '320px',
                  lineHeight: 1.4
                }}>
                  "{profile.mood?.description || 'Chưa có hoạt động GitHub gần đây. Hãy push một commit để cập nhật tâm trạng bé nhé!'}"
                </p>

                {/* Cyber-Arcade Level Progress Bar & EXP Progression */}
                {progression && (
                  <div style={{
                    width: '100%',
                    maxWidth: '360px',
                    margin: '0 auto 16px auto',
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(0, 240, 255, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    boxSizing: 'border-box'
                  }}>
                    {/* Level & EXP Ratio Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '12px',
                          fontWeight: 900,
                          color: '#00f0ff',
                          letterSpacing: '0.05em'
                        }}>
                          LVL {progression.level}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: '#8b9bb4',
                          fontFamily: "'JetBrains Mono', monospace",
                          background: 'rgba(255, 255, 255, 0.06)',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          Next: Lv.{progression.level + 1}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00ff88' }}>
                        {progression.expInLevel.toLocaleString()} / {progression.levelExpSpan.toLocaleString()} EXP
                        <span style={{ color: '#8b9bb4', marginLeft: '4px', fontSize: '10px', fontWeight: 600 }}>
                          ({Math.round(progression.progressPercent)}%)
                        </span>
                      </div>
                    </div>

                    {/* Glowing Neon Progress Bar Track */}
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(255, 255, 255, 0.12)'
                    }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, progression.progressPercent))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #00f0ff 0%, #00ff88 65%, #ffa800 100%)',
                        borderRadius: '9999px',
                        boxShadow: '0 0 14px rgba(0, 240, 255, 0.7)',
                        transition: 'width 0.5s ease-out'
                      }} />
                    </div>

                    {/* Total Lifetime EXP & EXP to Next Level */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '8px',
                      fontSize: '10px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#8b9bb4'
                    }}>
                      <span>Total: <strong style={{ color: '#ffffff' }}>{progression.currentExp.toLocaleString()} EXP</strong></span>
                      <span style={{ color: '#ffa800', fontWeight: 700 }}>+{progression.expToNextLevel.toLocaleString()} to Lv.{progression.level + 1}</span>
                    </div>
                  </div>
                )}

                {/* Companion Realm Attributes Matrix (Matching Developer Stats 4-Grid) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  width: '100%',
                  maxWidth: '360px',
                  margin: '0 auto 6px auto',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    background: '#141b27',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: '#00f0ff' }}>
                      {progression?.currentExp.toLocaleString() || 0}
                    </div>
                    <div style={{ fontSize: '9px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
                      Accumulated EXP
                    </div>
                  </div>

                  <div style={{
                    background: '#141b27',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: '#00ff88' }}>
                      {profile.guardian.energy_state || 'Active'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
                      Energy State
                    </div>
                  </div>

                  <div style={{
                    background: '#141b27',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 800, color: '#ff2a85', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile.guardian.rarity_tier || 'Genesis'}
                    </div>
                    <div style={{ fontSize: '9px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
                      Rarity Tier
                    </div>
                  </div>

                  <div style={{
                    background: '#141b27',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: '#ffa800' }}>
                      {profile.public_repos} Repos
                    </div>
                    <div style={{ fontSize: '9px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginTop: '2px' }}>
                      Guarded Codebases
                    </div>
                  </div>
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

              {/* Private-inclusive aggregate counts (owner-consented, numbers only, never names) */}
              {profile.aggregate_stats && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0,240,255,0.08), rgba(255,42,133,0.06))',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span>🔒</span>
                    <span style={{ fontFamily: "'Archivo', sans-serif", fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>Full Activity (incl. private)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#00ff88' }}>
                        {profile.aggregate_stats.contributions_last_year.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Contributions · Last Year</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#a855f7' }}>
                        {profile.aggregate_stats.owned_repositories_total.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8b9bb4', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Owned Repos · incl. Private</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace", marginTop: '10px' }}>
                    Owner-authorized · Synced {formatRelativeTime(profile.aggregate_stats.refreshed_at)}
                  </div>
                  {sessionLogin && profile && sessionLogin === profile.login.toLowerCase() && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <a
                        href="/auth/github"
                        style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#00f0ff', textDecoration: 'none', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '6px', padding: '5px 10px' }}
                      >
                        🔄 Refresh
                      </a>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={async () => {
                          if (!confirm('Remove your published private-inclusive stats from GitHoot? This deletes the stored counts. You can re-add them by signing in again.')) return;
                          setRemoving(true);
                          try {
                            const res = await fetch('/api/auth/aggregate-stats/delete', { method: 'DELETE', credentials: 'same-origin' });
                            if (res.ok) { window.location.reload(); return; }
                            alert('Could not remove your stats right now. Please try again.');
                          } catch {
                            alert('Could not remove your stats right now. Please try again.');
                          }
                          setRemoving(false);
                        }}
                        style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#ff2a85', background: 'transparent', border: '1px solid rgba(255,42,133,0.35)', borderRadius: '6px', padding: '5px 10px', cursor: removing ? 'wait' : 'pointer', opacity: removing ? 0.5 : 1 }}
                      >
                        {removing ? '… Removing' : '🗑 Remove my stats'}
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                <div style={{ textAlign: 'left', fontSize: '10px', color: '#53627a', marginTop: '10px', lineHeight: 1.5, background: 'rgba(255,168,0,0.06)', border: '1px solid rgba(255,168,0,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
                  ⚠️ Sign-in requests GitHub's classic <strong style={{ color: '#ffa800' }}>repo</strong> permission — full read/write access to your public &amp; private repositories. GitHoot uses the token once to compute two public counts (contributions last year + owned repo total incl. private), stores <strong>no token and no private repo names/details</strong>, then <strong>attempts to revoke it immediately</strong> (you can also revoke anytime in GitHub settings). Exact totals can reveal the volume of your private work.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dossier Bottom Row: Highlighted Repositories & Live Realm Activities */}
        <div className="dossier-full-grid">
          
          {/* Highlighted & Active Repositories Card */}
          <div className="githoot-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📁</span>
                  <span>Highlighted & Active Repositories</span>
                </h3>
                <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0 0 0' }}>
                  Codebases and open-source projects maintained by @{profile.login}
                </p>
              </div>

              {/* Sub-Tabs: Highlighted vs Active */}
              <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setRepoTab('highlighted')}
                  style={{
                    background: repoTab === 'highlighted' ? '#00f0ff' : 'transparent',
                    color: repoTab === 'highlighted' ? '#000' : '#8b9bb4',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🌟 Top Starred ({profile.highlighted_repos?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRepoTab('active')}
                  style={{
                    background: repoTab === 'active' ? '#00f0ff' : 'transparent',
                    color: repoTab === 'active' ? '#000' : '#8b9bb4',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ⚡ Recently Active ({profile.active_repos?.length || 0})
                </button>
              </div>
            </div>

            {((repoTab === 'highlighted' ? profile.highlighted_repos : profile.active_repos) || profile.highlighted_repos || []).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {((repoTab === 'highlighted' ? profile.highlighted_repos : profile.active_repos) || []).map((repo) => (
                  <a
                    key={repo.full_name}
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="repo-item-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 800, color: '#00f0ff', wordBreak: 'break-all' }}>
                          {repo.is_private ? '🔒 ' : ''}{repo.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {repo.stargazers_count > 0 && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#ff2a85', fontWeight: 700 }}>
                              ★ {repo.stargazers_count}
                            </span>
                          )}
                          {repo.forks_count > 0 && (
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>
                              ⑂ {repo.forks_count}
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: '12px', color: '#c8d6e5', margin: '0 0 10px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {repo.description || 'Open-source repository guarded on GitHoot.'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace" }}>
                      {repo.language ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#8b9bb4' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getLangColor(repo.language) }} />
                          <span>{repo.language}</span>
                        </span>
                      ) : <span />}
                      {repo.updated_at && (
                        <span>{formatRelativeTime(repo.updated_at)}</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#8b9bb4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                ✦ Repositories protected under the Guardian shield ✦
              </div>
            )}
          </div>

          {/* Live Realm Activities Feed Card */}
          <div className="githoot-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span>
                  <span>Recent Realm Activities</span>
                </h3>
                <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0 0 0' }}>
                  Live GitHub activity stream fueling companion mood & growth
                </p>
              </div>
            </div>

            {profile.activities && profile.activities.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {profile.activities.map((act) => {
                  const getActIcon = (type: string) => {
                    switch (type) {
                      case 'PushEvent': return '🚀';
                      case 'PullRequestEvent': return '🔀';
                      case 'IssuesEvent': return '⚠️';
                      case 'CreateEvent': return '🌿';
                      case 'ReleaseEvent': return '📦';
                      case 'WatchEvent': return '⭐';
                      case 'ForkEvent': return '🍴';
                      default: return '✦';
                    }
                  };

                  return (
                    <div key={act.id} className="activity-timeline-entry">
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(0, 240, 255, 0.1)',
                        border: '1px solid rgba(0, 240, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        flexShrink: 0
                      }}>
                        {getActIcon(act.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                          <a
                            href={act.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#00f0ff',
                              textDecoration: 'none',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {act.repo}
                          </a>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#00ff88',
                              background: 'rgba(0, 255, 136, 0.1)',
                              border: '1px solid rgba(0, 255, 136, 0.25)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              letterSpacing: '0.04em'
                            }}>
                              +{act.exp_gain || getActivityExp(act.type)} EXP
                            </span>
                            <span style={{ fontSize: '11px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                              {formatRelativeTime(act.created_at)}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#c8d6e5', marginTop: '2px', lineHeight: 1.4 }}>
                          {act.summary}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8b9bb4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                😴 No public events in the last 90 days. Push a commit to wake the guardian!
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};
