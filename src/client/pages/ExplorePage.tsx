// ============================================================================
// GitHoot Discovery & Explore Page (src/client/pages/ExplorePage.tsx)
// Interactive companion archetypes directory in English.
// ============================================================================

import React, { useState } from 'react';
import { EGG_MANIFEST, type EggArchetype } from '../assets/eggs/manifest';

export const ExplorePage: React.FC = () => {
  const [selectedArchetype, setSelectedArchetype] = useState<EggArchetype>(EGG_MANIFEST['neon-byte']!);
  const [searchVal, setSearchVal] = useState('');
  const [wobbleState, setWobbleState] = useState(false);

  const archetypesList = Object.values(EGG_MANIFEST);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchVal.trim().replace(/^@/, '');
    if (clean) {
      window.location.pathname = `/${encodeURIComponent(clean)}`;
    }
  };

  const triggerEggWobble = () => {
    setWobbleState(true);
    setTimeout(() => setWobbleState(false), 300);
  };

  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: '12px' }}>
            <span>✦</span>
            <span>COMPANION ARCHETYPE DIRECTORY</span>
            <span>✦</span>
          </div>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, marginBottom: '12px' }}>
            Explore 8 GitHoot Guardian Elements
          </h1>
          <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Every elemental archetype is forged from developer coding affinities, programming language stacks, and open-source contribution patterns.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ maxWidth: '480px', margin: '0 auto 40px', display: 'flex', gap: '8px', background: '#0d111a', padding: '6px', borderRadius: '10px', border: '1px solid rgba(0,240,255,0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <label htmlFor="explore-search-input" className="sr-only">Look up any GitHub username</label>
          <span style={{ display: 'flex', alignItems: 'center', paddingLeft: '10px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace", fontSize: '14px' }}>
            githoot.com/
          </span>
          <input
            type="text"
            id="explore-search-input"
            placeholder="octocat..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '14px',
              fontWeight: 700,
              outline: 'none',
              minWidth: 0
            }}
          />
          <button
            type="submit"
            style={{
              background: '#00f0ff',
              border: 'none',
              color: '#000',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              fontWeight: 800,
              padding: '8px 18px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Preview
          </button>
        </form>

        {/* Detail Showcase Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          marginBottom: '48px',
          background: '#0d111a',
          border: '1px solid rgba(0,240,255,0.15)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          alignItems: 'center'
        }}>
          {/* Egg Interactive Canvas Simulator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div
              className="pure-css-egg"
              onClick={triggerEggWobble}
              style={{
                '--egg-primary': selectedArchetype.color.primary,
                '--egg-glow': selectedArchetype.color.glow,
                width: '120px',
                height: '160px',
                transform: wobbleState ? 'scale(1.1) rotate(8deg)' : 'scale(1) rotate(0deg)'
              } as React.CSSProperties}
            >
              <div className="crack" />
            </div>
            <div style={{ marginTop: '16px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>
              Click to wobble (0 bytes CSS)
            </div>
          </div>

          {/* Archetype Description & Traits */}
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, color: selectedArchetype.color.primary, marginBottom: '6px' }}>
              {selectedArchetype.element.toUpperCase()}
            </div>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '28px', fontWeight: 900, marginBottom: '12px', color: '#fff' }}>
              {selectedArchetype.name}
            </h2>
            <p style={{ color: '#8b9bb4', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
              {selectedArchetype.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#53627a', textTransform: 'uppercase' }}>Companion Species</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{selectedArchetype.species}</div>
              </div>
              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#53627a', textTransform: 'uppercase' }}>Element Affinity</div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px', color: selectedArchetype.color.primary }}>{selectedArchetype.element.split('/')[0]}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href="/octocat"
                style={{
                  background: 'rgba(0,240,255,0.1)',
                  border: '1px solid #00f0ff',
                  color: '#00f0ff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700
                }}
              >
                Preview @octocat ➔
              </a>
            </div>
          </div>
        </div>

        {/* Archetypes Selector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }} role="tablist" aria-label="Archetype list">
          {archetypesList.map((arch) => (
            <button
              key={arch.id}
              type="button"
              role="tab"
              aria-selected={selectedArchetype.id === arch.id}
              aria-label={`${arch.name} — ${arch.element}`}
              onClick={() => setSelectedArchetype(arch)}
              style={{
                background: selectedArchetype.id === arch.id ? '#1c2637' : '#0d111a',
                border: selectedArchetype.id === arch.id ? `2px solid ${arch.color.primary}` : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '18px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: selectedArchetype.id === arch.id ? `0 0 20px ${arch.color.glow}` : 'none',
                fontFamily: 'inherit',
                color: 'inherit'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: arch.color.primary }}>
                  {arch.element}
                </span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: arch.color.primary, boxShadow: `0 0 6px ${arch.color.primary}` }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>
                {arch.name}
              </div>
              <div style={{ fontSize: '12px', color: '#8b9bb4', lineHeight: 1.4 }}>
                {arch.description}
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};
