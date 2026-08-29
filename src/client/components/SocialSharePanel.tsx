// ============================================================================
// GitHoot 1-Click Social Share Panel (src/client/components/SocialSharePanel.tsx)
// ============================================================================

import React, { useState } from 'react';
import type { GuardianSummary } from '../../server/types';

export interface SocialSharePanelProps {
  username: string;
  guardian: GuardianSummary;
}

export const SocialSharePanel: React.FC<SocialSharePanelProps> = ({
  username,
  guardian
}) => {
  const [copied, setCopied] = useState(false);

  const profileUrl = `https://githoot.com/${encodeURIComponent(username)}`;
  const badgeMarkdown = `[![GitHoot Guardian](https://githoot.com/badge/${encodeURIComponent(username)}.svg)](${profileUrl})`;

  const twitterText = `Vừa mở khóa được Linh thú ${guardian.species} bậc [${guardian.rarity_tier}] hệ ${guardian.element} trên @GitHoot! 🔥 Đang bảo hộ các dự án mã nguồn mở của tôi. Nhận nuôi miễn phí Linh thú của bạn tại đây:`;
  const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(profileUrl)}`;
  const linkedInIntentUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;

  const handleCopyBadge = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div style={{
      background: '#0d111a',
      border: '1px solid rgba(0, 240, 255, 0.2)',
      borderRadius: '16px',
      padding: 'clamp(16px, 3vw, 24px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      color: '#f0f6fc',
      fontFamily: "'Schibsted Grotesk', sans-serif",
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <h3 style={{ fontFamily: "'Archivo', sans-serif", fontSize: 'clamp(15px, 2.5vw, 18px)', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        <span>🚀</span>
        <span>Lan Truyền & Khoe Linh Thú Lên Mạng Xã Hội</span>
      </h3>

      {/* Share Buttons Row (Responsive 1-col on mobile, 2-col on tablet/desktop) */}
      <div className="githoot-share-grid" style={{ marginBottom: '20px' }}>
        <a
          href={twitterIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-touch"
          style={{
            background: '#000',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'transform 0.15s, border-color 0.15s',
            gap: '8px'
          }}
        >
          <span>𝕏</span>
          <span>Share to X</span>
        </a>

        <a
          href={linkedInIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-touch"
          style={{
            background: '#0a66c2',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'transform 0.15s',
            gap: '8px'
          }}
        >
          <span>in</span>
          <span>Share LinkedIn</span>
        </a>
      </div>

      {/* README Badge Box */}
      <div style={{
        background: '#07090e',
        border: '1px solid rgba(0, 240, 255, 0.15)',
        borderRadius: '8px',
        padding: '14px',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#00f0ff', fontWeight: 700 }}>
            Dynamic GitHub README Badge:
          </span>
          <button
            onClick={handleCopyBadge}
            style={{
              background: copied ? '#00ff88' : '#1c2637',
              color: copied ? '#000' : '#00f0ff',
              border: '1px solid #00f0ff',
              padding: '6px 14px',
              borderRadius: '4px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: '36px'
            }}
          >
            {copied ? '✓ Copied!' : 'Copy Markdown'}
          </button>
        </div>

        <code style={{
          display: 'block',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          color: '#8b9bb4',
          wordBreak: 'break-all',
          background: '#040508',
          padding: '8px',
          borderRadius: '4px',
          userSelect: 'all'
        }}>
          {badgeMarkdown}
        </code>
      </div>
    </div>
  );
};
