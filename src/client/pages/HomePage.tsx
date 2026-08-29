// ============================================================================
// GitHoot High-Impact Homepage (src/client/pages/HomePage.tsx)
// ============================================================================

import React, { useState } from 'react';
import { EGG_MANIFEST } from '../assets/eggs/manifest';
import { EggSpritesheetPlayer } from '../components/EggSpritesheetPlayer';
import { InteractiveCompanionShowcase } from '../components/InteractiveCompanionShowcase';

export const HomePage: React.FC<{ onRouteChange: (route: string) => void }> = ({ onRouteChange }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [selectedEggId, setSelectedEggId] = useState('neon-byte');

  const popularDevs = [
    { login: 'octocat', name: 'The Octocat', lang: 'TypeScript', archetype: 'neon-byte', rarity: 'Legendary' },
    { login: 'torvalds', name: 'Linus Torvalds', lang: 'C', archetype: 'rust-dynamo', rarity: 'Mythic' },
    { login: 'antirez', name: 'Salvatore Sanfilippo', lang: 'C', archetype: 'ember-core', rarity: 'Legendary' },
    { login: 'rich-harris', name: 'Rich Harris', lang: 'JavaScript', archetype: 'solar-flare', rarity: 'Epic' },
    { login: 'yyx990803', name: 'Evan You', lang: 'TypeScript', archetype: 'neon-byte', rarity: 'Mythic' }
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      window.location.pathname = `/${encodeURIComponent(usernameInput.trim())}`;
    }
  };

  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      
      {/* 1. HERO SECTION */}
      <section style={{ padding: 'clamp(48px, 8vw, 96px) 24px 64px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: 'radial-gradient(circle at 50% 20%, #141b27 0%, #07090e 70%)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          
          {/* Eyebrow Chip */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 240, 255, 0.08)', border: '1px solid #00f0ff', padding: '6px 18px', borderRadius: '9999px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '24px', boxShadow: '0 0 20px rgba(0,240,255,0.2)' }}>
            <span>✦</span>
            <span>Edge-First Gamified Developer Identity on Cloudflare</span>
            <span>✦</span>
          </div>

          {/* Main Headline */}
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(32px, 6vw, 64px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '20px', color: '#ffffff' }}>
            Biến Hoạt Động GitHub Thành <br />
            <span style={{ background: 'linear-gradient(90deg, #00f0ff, #ff2a85, #ffa800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Linh Thú Hộ Mệnh Sống Động
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 'clamp(15px, 2.5vw, 18px)', color: '#8b9bb4', maxWidth: '720px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            Khám phá hạt giống Trứng huyền bí độc bản cho bất kỳ tài khoản GitHub nào, mở khóa biểu cảm Spritesheet sinh bởi <strong>Gemini Nano Banana 2</strong> và lan truyền thẻ chia sẻ động lên X & LinkedIn.
          </p>

          {/* Interactive Search Bar */}
          <form onSubmit={handleSearchSubmit} style={{ maxWidth: '560px', margin: '0 auto 20px', display: 'flex', gap: '8px', background: '#0d111a', padding: '6px', borderRadius: '12px', border: '2px solid #00f0ff', boxShadow: '0 0 32px rgba(0, 240, 255, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '12px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace", fontSize: '15px' }}>
              github.com/
            </div>
            <input
              type="text"
              placeholder="nhập username (vd: octocat)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '15px',
                fontWeight: 700,
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#00f0ff',
                border: 'none',
                color: '#000',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                fontWeight: 900,
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(0,240,255,0.4)',
                transition: 'transform 0.15s'
              }}
            >
              Hatch 🚀
            </button>
          </form>

          {/* Quick Clickable Popular Dev Tags */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#53627a', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>Thử nhanh:</span>
            {popularDevs.map(dev => (
              <a
                key={dev.login}
                href={`/${dev.login}`}
                style={{ color: '#00f0ff', textDecoration: 'none', background: 'rgba(0,240,255,0.06)', padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(0,240,255,0.15)' }}
              >
                @{dev.login}
              </a>
            ))}
          </div>

        </div>
      </section>

      {/* 2. EGG SHOWCASE TEASER */}
      <section style={{ padding: '64px 24px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: '#0a0d14' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ✦ Live Canvas Simulator ✦
            </div>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
              8 Loại Trứng AI Độc Bản (0đ Chi Phí Máy Chủ)
            </h2>
            <p style={{ fontSize: '14px', color: '#8b9bb4' }}>
              Mỗi hệ ngôn ngữ lập trình được liên kết với một nguyên tố huyền bí. Click thử để tương tác trực tiếp:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '36px', alignItems: 'center', background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '20px', padding: '36px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            
            {/* Interactive Player */}
            <div style={{ background: '#141b27', borderRadius: '16px', border: '1px solid rgba(0,240,255,0.2)', padding: '16px' }}>
              <EggSpritesheetPlayer archetypeId={selectedEggId} />
            </div>

            {/* Archetypes Selector Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {Object.values(EGG_MANIFEST).map(egg => (
                <div
                  key={egg.id}
                  onClick={() => setSelectedEggId(egg.id)}
                  style={{
                    background: selectedEggId === egg.id ? '#1c2637' : '#141b27',
                    border: selectedEggId === egg.id ? `2px solid ${egg.color.primary}` : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedEggId === egg.id ? `0 0 16px ${egg.color.glow}` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: egg.color.primary }}>
                      {egg.element}
                    </span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: egg.color.primary }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#fff' }}>{egg.name}</div>
                  <div style={{ fontSize: '11px', color: '#8b9bb4', marginTop: '4px', lineHeight: 1.4 }}>{egg.description}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 3. GEMINI NANO BANANA COMPANIONS INTERACTIVE GALLERY */}
      <section style={{ padding: '80px 24px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: '#07090e' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#ff2a85', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
              ✦ Gemini Nano Banana 2 Interactive Studio ✦
            </div>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '32px', fontWeight: 900, marginBottom: '12px' }}>
              8 Vị Linh Thú Tương Tác Sống Động
            </h2>
            <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '640px', margin: '0 auto' }}>
              Tất cả ảnh dưới đây được sinh trực tiếp từ <strong>Gemini Nano Banana 2</strong>. Click vào các nút biểu cảm dưới mỗi thẻ bài để tương tác thời gian thực!
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            {Object.values(EGG_MANIFEST).map(pet => (
              <InteractiveCompanionShowcase key={pet.id} archetype={pet} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS WORKFLOW */}
      <section style={{ padding: '80px 24px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: '#0a0d14' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00ff88', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ✦ Zero Over-Engineering ✦
            </div>
            <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
              Quy Trình 4 Bước Hoạt Động Của GitHoot
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            
            <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: 900, color: '#00f0ff', marginBottom: '12px' }}>01</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Tra Cứu Kháng Nghẽn</h3>
              <p style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Hệ thống nạp profile từ KV Cache và xoay vòng Token Pool, tự động chuyển sang Degraded Seed Mode khi GitHub API nghẽn.
              </p>
            </div>

            <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: 900, color: '#ff2a85', marginBottom: '12px' }}>02</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>OAuth Claim An Toàn</h3>
              <p style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Xác thực tài khoản chính chủ qua GitHub numeric ID và khóa 1 trong 100 suất Early Access miễn phí trong D1 SQLite.
              </p>
            </div>

            <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: 900, color: '#ffa800', marginBottom: '12px' }}>03</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Gemini Nano Banana 2</h3>
              <p style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Sinh lưới 4x2 gồm ảnh Hero và 7 biểu cảm; thuật toán WASM tự động cắt tách biên và khử viền xanh lưu vào R2 CDN.
              </p>
            </div>

            <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '24px', fontWeight: 900, color: '#00ff88', marginBottom: '12px' }}>04</div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Gacha Reveal & Share</h3>
              <p style={{ fontSize: '13px', color: '#8b9bb4', lineHeight: 1.5 }}>
                Trải nghiệm nghi thức mở trứng Gacha với âm thanh fanfare, thẻ OpenGraph động và badge SVG nhúng GitHub README.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. RARITY TIERS GACHA ODDS */}
      <section style={{ padding: '64px 24px', borderBottom: '1px solid rgba(0,240,255,0.12)', background: '#07090e' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#ffa800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            ✦ Gacha Drop Mechanics ✦
          </div>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '32px', fontWeight: 900, marginBottom: '32px' }}>
            Bảng Tỷ Lệ Độ Hiếm (Rarity Tiers)
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#0d111a', border: '1px solid #00ff88', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 900, color: '#00ff88' }}>60%</div>
              <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>Common</div>
            </div>
            <div style={{ background: '#0d111a', border: '1px solid #00f0ff', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 900, color: '#00f0ff' }}>25%</div>
              <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>Rare</div>
            </div>
            <div style={{ background: '#0d111a', border: '1px solid #7928ca', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 900, color: '#7928ca' }}>10%</div>
              <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>Epic</div>
            </div>
            <div style={{ background: '#0d111a', border: '1px solid #ff2a85', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 900, color: '#ff2a85' }}>4%</div>
              <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>Legendary</div>
            </div>
            <div style={{ background: '#0d111a', border: '1px solid #e2b340', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 900, color: '#e2b340' }}>1%</div>
              <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>Mythic</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer style={{ padding: '48px 24px', textAlign: 'center', color: '#53627a', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
        <div>🦉 GitHoot.com • Gamified Developer Identity & Viral Gacha Hatch on Cloudflare Edge</div>
        <div style={{ marginTop: '8px' }}>Deployed globally with Cloudflare Pages, D1 SQLite, R2 CDN & Gemini Nano Banana 2</div>
      </footer>

    </div>
  );
};
