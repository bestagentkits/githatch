// ============================================================================
// GitHoot Discovery & Explore Page (src/client/pages/ExplorePage.tsx)
// ============================================================================

import React, { useState } from 'react';
import { EGG_MANIFEST, type EggArchetype } from '../assets/eggs/manifest';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';

export const ExplorePage: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<string>('All');
  const [selectedArchetype, setSelectedArchetype] = useState<EggArchetype>(EGG_MANIFEST['ember-core']!);
  const [searchVal, setSearchVal] = useState('');

  const languages = ['All', 'Rust & Go', 'TypeScript & Web', 'Python & AI', 'Open Source', 'Low-level C/C++', 'Security'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      window.location.pathname = `/${encodeURIComponent(searchVal.trim())}`;
    }
  };

  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            ✦ Companion Archetype Directory ✦
          </div>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '36px', fontWeight: 900, marginBottom: '12px' }}>
            Khám Phá 8 Đại Diện Linh Thú GitHoot
          </h1>
          <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '640px', margin: '0 auto' }}>
            Mỗi hệ nguyên tố được tôi luyện từ những phong cách viết mã và công nghệ đặc trưng của lập trình viên.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} style={{ maxWidth: '480px', margin: '0 auto 36px', display: 'flex', gap: '8px', background: '#0d111a', padding: '6px', borderRadius: '10px', border: '1px solid rgba(0,240,255,0.3)' }}>
          <input
            type="text"
            placeholder="Tra cứu GitHub username bất kỳ..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '8px 12px', outline: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}
          />
          <button
            type="submit"
            style={{ background: '#00f0ff', color: '#000', border: 'none', padding: '8px 18px', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
          >
            Tra cứu →
          </button>
        </form>

        {/* Detail Showcase Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '32px', marginBottom: '48px', background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '20px', padding: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          
          {/* Egg Interactive Preview */}
          <div style={{ background: '#141b27', borderRadius: '16px', border: `2px solid ${selectedArchetype.color.primary}`, padding: '20px', textAlign: 'center', boxShadow: `0 0 24px ${selectedArchetype.color.glow}` }}>
            <EggSpritesheetPlayer archetypeId={selectedArchetype.id} />
          </div>

          {/* Archetype Lore & Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ background: selectedArchetype.color.primary, color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '4px 12px', borderRadius: '9999px', textTransform: 'uppercase' }}>
                Hệ {selectedArchetype.element}
              </span>
              <span style={{ color: '#8b9bb4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                Archetype #{selectedArchetype.id}
              </span>
            </div>

            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '28px', fontWeight: 900, marginBottom: '12px' }}>
              {selectedArchetype.name}
            </h2>

            <p style={{ fontSize: '15px', color: '#f0f6fc', lineHeight: 1.6, marginBottom: '20px' }}>
              {selectedArchetype.description}
            </p>

            {/* Trait Matrix */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Nguyên tố chủ đạo</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: selectedArchetype.color.primary, marginTop: '2px' }}>
                  {selectedArchetype.element}
                </div>
              </div>
              <div style={{ background: '#141b27', padding: '12px 16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#53627a', textTransform: 'uppercase', fontWeight: 700 }}>Màu phát sáng</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: selectedArchetype.color.particle, marginTop: '2px' }}>
                  {selectedArchetype.color.primary}
                </div>
              </div>
            </div>

            <a
              href={`/octocat`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: selectedArchetype.color.primary,
                color: '#000',
                padding: '12px 24px',
                borderRadius: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                maxWidth: '280px',
                boxShadow: `0 0 16px ${selectedArchetype.color.glow}`
              }}
            >
              Xem Thử Trứng Mẫu →
            </a>
          </div>

        </div>

        {/* Archetypes Selector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {Object.values(EGG_MANIFEST).map(egg => (
            <div
              key={egg.id}
              onClick={() => setSelectedArchetype(egg)}
              style={{
                background: selectedArchetype.id === egg.id ? '#1c2637' : '#0d111a',
                border: selectedArchetype.id === egg.id ? `2px solid ${egg.color.primary}` : '1px solid rgba(0,240,255,0.12)',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: selectedArchetype.id === egg.id ? `0 0 20px ${egg.color.glow}` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: egg.color.primary }}>
                  Hệ {egg.element}
                </span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: egg.color.primary }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{egg.name}</h3>
              <p style={{ fontSize: '12px', color: '#8b9bb4', lineHeight: 1.4 }}>{egg.description}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
