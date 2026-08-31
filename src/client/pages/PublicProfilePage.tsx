// ============================================================================
// GitHoot Public Profile Page (src/client/pages/PublicProfilePage.tsx)
// ============================================================================

import React, { useEffect, useState } from 'react';
import type { ResolvedProfile } from '../../server/types';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';

export const PublicProfilePage: React.FC<{ username: string }> = ({ username }) => {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <main className="githoot-container" style={{ margin: 'clamp(24px, 5vw, 48px) auto' }}>
        <div className="githoot-main-grid">
          
          {/* Left Column: Interactive Egg Canvas */}
          <div className="githoot-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '320px' }}>
            <EggSpritesheetPlayer archetypeId={profile.egg_archetype_id} />
          </div>

          {/* Right Column: Developer Snapshot & Claim Action */}
          <div className="githoot-card">
            
            {/* Dev Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <img src={profile.avatar_url} alt={profile.login} style={{ width: 'clamp(48px, 12vw, 64px)', height: 'clamp(48px, 12vw, 64px)', borderRadius: '50%', border: '2px solid #00f0ff', flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 900, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {profile.name || profile.login}
                </h1>
                <div style={{ color: '#8b9bb4', fontSize: '13px' }}>@{profile.login}</div>
              </div>
            </div>

            {profile.bio && (
              <p style={{ fontSize: '13px', color: '#8b9bb4', marginBottom: '20px', lineHeight: 1.5 }}>
                {profile.bio}
              </p>
            )}

            {/* Dev Stats Grid */}
            <div className="githoot-stats-grid" style={{ marginBottom: '24px' }}>
              <div style={{ background: '#141b27', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#00f0ff' }}>
                  {profile.public_repos}
                </div>
                <div style={{ fontSize: '10px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Public Repos</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: '#00f0ff' }}>
                  {profile.followers}
                </div>
                <div style={{ fontSize: '10px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Followers</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 800, color: '#ffa800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.top_languages?.[0] || 'Polyglot'}
                </div>
                <div style={{ fontSize: '10px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Top Language</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 14px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(14px, 2.5vw, 16px)', fontWeight: 800, color: '#ff2a85' }}>
                  {profile.estimated_rarity}
                </div>
                <div style={{ fontSize: '10px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Rarity</div>
              </div>
            </div>

            {/* Claim CTA Button (Touch Standard >= 48px) */}
            <div>
              <a
                href={`/auth/github?claim_username=${encodeURIComponent(profile.login)}`}
                className="btn-touch"
                style={{
                  width: '100%',
                  background: '#00f0ff',
                  color: '#000',
                  padding: '14px 20px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 'clamp(13px, 2.5vw, 15px)',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 0 24px rgba(0,240,255,0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  textAlign: 'center'
                }}
              >
                🚀 Claim & Hatch My Guardian Free
              </a>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#53627a', marginTop: '10px' }}>
                ✓ Only the owner of @{profile.login} can claim this companion.
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};
