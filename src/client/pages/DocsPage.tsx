// ============================================================================
// GitHoot Architecture & API Documentation Page (src/client/pages/DocsPage.tsx)
// Technical specs in English with anchor IDs per the accepted contract.
// ============================================================================

import React from 'react';

export const DocsPage: React.FC = () => {
  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div className="eyebrow" style={{ marginBottom: '12px' }}>
            <span>✦</span>
            <span>ENGINEERING SPECIFICATIONS & CONTRACTS</span>
            <span>✦</span>
          </div>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, marginBottom: '16px' }}>
            Technical Architecture & API Reference
          </h1>
          <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '780px', lineHeight: 1.6 }}>
            Specification of GitHoot's Edge-first serverless architecture on Cloudflare, anti-throttling GitHub API resolver (SWR + Token Pool), Gemini Nano Banana 2 sprite pipeline, and public API endpoint contracts.
          </p>
        </div>

        {/* 1. Architecture Highlights */}
        <div id="architecture" style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '22px', fontWeight: 900, marginBottom: '16px', color: '#00f0ff' }}>
            1. Anti-Throttling Architecture & Edge SWR
          </h2>
          <p style={{ color: '#8b9bb4', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
            The GitHub REST API enforces strict rate limits (5,000 req/hr for authenticated PATs, 60 req/hr unauthenticated). To serve high concurrent visitor traffic with sub-30ms cache hits, GitHoot uses a multi-tier resolution pipeline:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#141b27', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#00ff88', marginBottom: '6px' }}>Stale-While-Revalidate KV</div>
              <div style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Cloudflare KV cache layer. Fresh cache (&lt; 1 hour) serves instantly in &lt; 20ms. Stale cache (&lt; 24 hours) serves immediately while syncing metadata in the background.
              </div>
            </div>
            <div style={{ background: '#141b27', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#00f0ff', marginBottom: '6px' }}>Rotating Token Pool</div>
              <div style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Dynamically rotates GitHub PATs and GitHub App installation tokens, monitoring <code>x-ratelimit-remaining</code> headers in real time to distribute outbound traffic.
              </div>
            </div>
            <div style={{ background: '#141b27', padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ff2a85', marginBottom: '6px' }}>Degraded Seed Fallback</div>
              <div style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                When all upstream tokens hit rate limits (429/403), the edge falls back to public profile scraping or deterministic SHA-256 seed hashing to render egg previews without interruption.
              </div>
            </div>
          </div>
        </div>

        {/* 2. API Endpoints Reference */}
        <div id="api-reference" style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '22px', fontWeight: 900, marginBottom: '20px', color: '#ff2a85' }}>
            2. Public Edge API Reference
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Endpoint 1 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/api/profile/:username</code>
              </div>
              <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '4px 0' }}>
                Resolves public GitHub profile metadata, deterministic DNA seed, corresponding egg archetype, and claim state.
              </p>
            </div>

            {/* Endpoint 2 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/api/early-access/status</code>
              </div>
              <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '4px 0' }}>
                Returns live 100-slot Genesis Early Access availability from D1 SQLite, with explicit <code>degraded: boolean</code> flag.
              </p>
            </div>

            {/* Endpoint 3 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/badge/:username.svg</code>
              </div>
              <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '4px 0' }}>
                Generates a live dynamic SVG badge embeddable directly into developer GitHub README.md profiles.
              </p>
            </div>

            {/* Endpoint 4 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/og/:username</code>
              </div>
              <p style={{ fontSize: '13px', color: '#8b9bb4', margin: '4px 0' }}>
                Generates dynamic OpenGraph cards (1200x630) with guardian artwork, elemental rarity tier, and repository statistics for X/LinkedIn sharing.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Determinism & Security Contract */}
        <div id="determinism" style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px' }}>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '22px', fontWeight: 900, marginBottom: '16px', color: '#ffa800' }}>
            3. Deterministic DNA & Integrity Contract
          </h2>
          <p style={{ color: '#8b9bb4', fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>
            Guardian traits are deterministically derived from:
          </p>
          <pre style={{
            background: '#141b27',
            padding: '16px',
            borderRadius: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            color: '#00f0ff',
            overflowX: 'auto',
            marginBottom: '16px',
            border: '1px solid rgba(0,240,255,0.2)'
          }}>
            const seedString = `githoot:dna:v1:$&#123;githubUserId || fallbackUsername || 'anon'&#125;`;
          </pre>
          <p style={{ color: '#8b9bb4', fontSize: '13px', lineHeight: 1.5 }}>
            SHA-256 slices determine archetype, rarity tier (Common 60%, Rare 25%, Epic 10%, Legendary 4%, Mythic 1%), markings, silhouette, and temperament. 1 GitHub ID = 1 Immutable Guardian.
          </p>
        </div>

      </div>
    </div>
  );
};
