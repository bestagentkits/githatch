// ============================================================================
// GitHoot Public Profile Page (src/client/pages/PublicProfilePage.tsx)
// ============================================================================

import React, { useEffect, useState } from 'react';
import type { ResolvedProfile, EarlyAccessStatus } from '../../server/types';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';

export const PublicProfilePage: React.FC<{ username: string }> = ({ username }) => {
  const [profile, setProfile] = useState<ResolvedProfile | null>(null);
  const [quota, setQuota] = useState<EarlyAccessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profileRes, quotaRes] = await Promise.all([
          fetch(`/api/profile/${encodeURIComponent(username)}`),
          fetch('/api/early-access/status')
        ]);

        if (!profileRes.ok) {
          throw new Error('User not found on GitHub');
        }

        const profileData = (await profileRes.json()) as ResolvedProfile;
        const quotaData = (await quotaRes.json()) as EarlyAccessStatus;

        setProfile(profileData);
        setQuota(quotaData);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load profile';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [username]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090e', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
        <div>✦ Scanning GitHub Realm for @{username}... ✦</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#07090e', color: '#ff2a85', fontFamily: "'JetBrains Mono', monospace" }}>
        <h2>⚠️ {error || 'User not found'}</h2>
        <a href="/" style={{ marginTop: '16px', color: '#00f0ff' }}>← Back to GitHoot.com</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07090e', color: '#f0f6fc', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      {/* Top Navigation */}
      <header style={{ borderBottom: '1px solid rgba(0,240,255,0.12)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: '20px', fontFamily: "'Archivo', sans-serif" }}>
          <span style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #00f0ff, #ff2a85)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🦉</span>
          <span>GitHoot</span>
        </a>

        {quota && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,240,255,0.08)', border: '1px solid #00f0ff', padding: '6px 16px', borderRadius: '9999px', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: '#00f0ff' }}>
            <span style={{ width: '8px', height: '8px', background: '#00f0ff', borderRadius: '50%', boxShadow: '0 0 8px #00f0ff' }} />
            <span>Early Access: {quota.remaining}/{quota.total} slots left</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1100px', margin: '48px auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '48px', alignItems: 'center' }}>
          
          {/* Left Column: Interactive Egg Canvas */}
          <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <EggSpritesheetPlayer archetypeId={profile.egg_archetype_id} />
          </div>

          {/* Right Column: Developer Snapshot & Claim Action */}
          <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            
            {/* Dev Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <img src={profile.avatar_url} alt={profile.login} style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid #00f0ff' }} />
              <div>
                <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '24px', fontWeight: 900, margin: 0 }}>
                  {profile.name || profile.login}
                </h1>
                <div style={{ color: '#8b9bb4', fontSize: '14px' }}>@{profile.login}</div>
              </div>
            </div>

            {profile.bio && (
              <p style={{ fontSize: '14px', color: '#8b9bb4', marginBottom: '24px', lineHeight: 1.5 }}>
                {profile.bio}
              </p>
            )}

            {/* Dev Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 800, color: '#00f0ff' }}>
                  {profile.public_repos}
                </div>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Public Repos</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 800, color: '#00f0ff' }}>
                  {profile.followers}
                </div>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Followers</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: 800, color: '#ffa800' }}>
                  {profile.top_languages[0] || 'Polyglot'}
                </div>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Top Language</div>
              </div>

              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', fontWeight: 800, color: '#ff2a85' }}>
                  {profile.estimated_rarity}
                </div>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Rarity</div>
              </div>
            </div>

            {/* Claim CTA */}
            <div>
              <a
                href={`/auth/github?claim_username=${encodeURIComponent(profile.login)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#00f0ff',
                  color: '#000',
                  padding: '16px',
                  borderRadius: '8px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '15px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  boxShadow: '0 0 24px rgba(0,240,255,0.35)',
                  transition: 'transform 0.15s'
                }}
              >
                🚀 Claim & Hatch My Guardian Free
              </a>
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#53627a', marginTop: '10px' }}>
                ✓ Only the owner of @{profile.login} can claim this companion.
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};
