// ============================================================================
// GitHoot Architecture & API Documentation Page (src/client/pages/DocsPage.tsx)
// ============================================================================

import React from 'react';

export const DocsPage: React.FC = () => {
  return (
    <div style={{ background: '#07090e', color: '#f0f6fc', minHeight: '100vh', fontFamily: "'Schibsted Grotesk', sans-serif", padding: '48px 24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 800, color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            ✦ Engineering Specifications & Contracts ✦
          </div>
          <h1 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '36px', fontWeight: 900, marginBottom: '12px' }}>
            Kiến Trúc Kỹ Thuật & API Reference
          </h1>
          <p style={{ color: '#8b9bb4', fontSize: '15px', maxWidth: '780px', lineHeight: 1.6 }}>
            Tài liệu đặc tả kiến trúc Edge-first trên Cloudflare, cơ chế kháng nghẽn GitHub API (SWR + Token Pool), pipeline sinh ảnh AI Gemini Nano Banana 2 và toàn bộ danh mục API endpoints.
          </p>
        </div>

        {/* 1. Architecture Highlights */}
        <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '22px', fontWeight: 900, marginBottom: '16px', color: '#00f0ff' }}>
            1. Kiến Trúc Kháng Nghẽn (Anti-Throttling Architecture)
          </h2>
          <p style={{ color: '#8b9bb4', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
            GitHub REST API giới hạn 5.000 req/giờ đối với Personal Access Tokens (PAT) và 60 req/giờ đối với IP unauthenticated. Để phục vụ hàng trăm nghìn lượt xem cùng lúc, GitHoot sử dụng kiến trúc phân tầng:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#141b27', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#00ff88', marginBottom: '4px' }}>Stale-While-Revalidate KV</div>
              <div style={{ fontSize: '12px', color: '#8b9bb4' }}>Lưu trữ dữ liệu profile trong Cloudflare KV. Cache fresh &lt; 1h trả về trong &lt; 20ms; cache stale &lt; 24h trả về ngay và sync ngầm.</div>
            </div>
            <div style={{ background: '#141b27', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#00f0ff', marginBottom: '4px' }}>Rotating Token Pool</div>
              <div style={{ fontSize: '12px', color: '#8b9bb4' }}>Tự động xoay vòng danh sách GitHub PATs và GitHub App installation tokens, kiểm tra x-ratelimit-remaining theo thời gian thực.</div>
            </div>
            <div style={{ background: '#141b27', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#ff2a85', marginBottom: '4px' }}>Degraded Seed Fallback</div>
              <div style={{ fontSize: '12px', color: '#8b9bb4' }}>Khi toàn bộ API bị rate limit (429/403), tự động tính toán hạt giống DNA từ SHA-256(username) để render Trứng mà không bị gián đoạn.</div>
            </div>
          </div>
        </div>

        {/* 2. API Endpoints Explorer */}
        <div style={{ background: '#0d111a', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '16px', padding: '32px', marginBottom: '36px' }}>
          <h2 style={{ fontFamily: "'Archivo', sans-serif", fontSize: '22px', fontWeight: 900, marginBottom: '20px', color: '#ff2a85' }}>
            2. Danh Mục API Endpoints Sẵn Sàng
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Endpoint 1 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/api/profile/:username</code>
              </div>
              <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0' }}>Trả về thông tin profile GitHub, hạt giống DNA xác định, loại Trứng tương ứng và trạng thái đã Claim.</p>
            </div>

            {/* Endpoint 2 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/api/early-access/status</code>
              </div>
              <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0' }}>Kiểm tra số lượng 100 slot Early Access miễn phí còn lại theo thời gian thực từ D1 Database.</p>
            </div>

            {/* Endpoint 3 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/badge/:username.svg</code>
              </div>
              <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0' }}>Sinh Dynamic SVG Badge nhúng trực tiếp vào file GitHub README.md của lập trình viên.</p>
            </div>

            {/* Endpoint 4 */}
            <div style={{ background: '#141b27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: '#00ff88', color: '#000', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>GET</span>
                <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#00f0ff' }}>/og/:username</code>
              </div>
              <p style={{ fontSize: '12px', color: '#8b9bb4', margin: '4px 0' }}>Sinh thẻ OpenGraph động (1200x630) hiển thị ảnh Linh thú, độ hiếm và thống kê repo phục vụ chia sẻ lên X/LinkedIn.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
