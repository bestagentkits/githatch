// ============================================================================
// GitHoot Design System & Spritesheet Studio (src/client/pages/DesignSystemPage.tsx)
// Option 1 Cyber-Arcade tokens, typography and studio in English.
// ============================================================================

import React, { useState } from 'react';
import type { GuardianSummary } from '../../server/types';
import { PetSpritesheetPlayer } from '../components/PetSpritesheetPlayer';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';

export const DesignSystemPage: React.FC = () => {
  const samplePets: GuardianSummary[] = [
    {
      id: 'emberfox',
      name: 'Ignis Emberfox',
      species: 'Ignis Emberfox',
      element: 'Fire / Rust & Go',
      rarity_tier: 'Legendary',
      level: 1,
      experience: 420,
      energy_state: 'Energetic',
      hero_image_url: '/assets/sample-pets/emberfox.jpg',
      spritesheet_url: '/assets/sample-pets/emberfox.jpg'
    },
    {
      id: 'neonbyte',
      name: 'Aether Neon Byte',
      species: 'Aether Neon Byte',
      element: 'Cyber / TypeScript & Web',
      rarity_tier: 'Epic',
      level: 1,
      experience: 650,
      energy_state: 'Active',
      hero_image_url: '/assets/sample-pets/neonbyte.jpg',
      spritesheet_url: '/assets/sample-pets/neonbyte.jpg'
    },
    {
      id: 'abyssal',
      name: 'Nox Abyssal Pearl',
      species: 'Nox Abyssal Pearl',
      element: 'Water / Python & AI',
      rarity_tier: 'Mythic',
      level: 1,
      experience: 990,
      energy_state: 'Active',
      hero_image_url: '/assets/sample-pets/abyssal.jpg',
      spritesheet_url: '/assets/sample-pets/abyssal.jpg'
    },
    {
      id: 'verdant',
      name: 'Sylvan Verdant Golem',
      species: 'Sylvan Verdant Golem',
      element: 'Nature / Open Source Maintainer',
      rarity_tier: 'Rare',
      level: 1,
      experience: 300,
      energy_state: 'Resting',
      hero_image_url: '/assets/sample-pets/verdant.jpg',
      spritesheet_url: '/assets/sample-pets/verdant.jpg'
    }
  ];

  const [selectedPet, setSelectedPet] = useState<GuardianSummary>(samplePets[0]!);

  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div className="eyebrow" style={{ marginBottom: '12px' }}>
            <span>✦</span>
            <span>OPTION 1: CYBER-ARCADE FANTASY ✦ DESIGN TOKENS</span>
            <span>✦</span>
          </div>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, marginBottom: '12px' }}>
            Design System & Sprite Studio
          </h1>
          <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Live laboratory for visual design tokens, typography scales, pure CSS egg rendering, and Gemini Nano Banana 2 multi-pose companion animations.
          </p>
        </div>

        {/* Studio Grid: Pet Player + Egg Simulator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '48px' }}>
          
          {/* Pet Spritesheet Studio */}
          <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#00f0ff' }}>
              1. Gemini Nano Banana 2 Sprite Engine
            </h3>
            <PetSpritesheetPlayer guardian={selectedPet} interactive={true} />

            {/* Pet Thumbnails Switcher */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#53627a', marginBottom: '8px' }}>
                Select sample Gemini-generated archetype:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {samplePets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPet(p)}
                    style={{
                      background: selectedPet.id === p.id ? '#1c2637' : '#141b27',
                      border: selectedPet.id === p.id ? '2px solid #00f0ff' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '4px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <img src={p.hero_image_url} alt={p.name} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '4px' }} />
                    <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", marginTop: '4px', color: '#8b9bb4' }}>
                      {p.name.split(' ')[1]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Egg Simulator */}
          <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#ff2a85' }}>
              2. Pure CSS Egg Simulator
            </h3>
            <EggSpritesheetPlayer archetypeId="neon-byte" />
            <div style={{ fontSize: '12px', color: '#8b9bb4', marginTop: '16px', textAlign: 'center', maxWidth: '340px' }}>
              Zero AI and zero image asset download. Tap or click egg to trigger Web Audio sound synthesis and CSS fracture lines.
            </div>
          </div>

        </div>

        {/* Color Palette Tokens Grid */}
        <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px' }}>
          <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>
            Color Tokens (Cyber-Arcade Standard 60/30/10)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#07090e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ height: '36px', background: '#07090e', border: '1px solid #333', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>--bg-base</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>#07090E</div>
            </div>
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ height: '36px', background: '#00f0ff', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>--accent-cyan</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>#00F0FF</div>
            </div>
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ height: '36px', background: '#ff2a85', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>--accent-magenta</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>#FF2A85</div>
            </div>
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ height: '36px', background: '#ffa800', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>--accent-amber</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>#FFA800</div>
            </div>
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ height: '36px', background: '#00ff88', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700 }}>--accent-green</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8b9bb4' }}>#00FF88</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
