// ============================================================================
// GitHoot 1-Click Social Share Panel (src/client/components/SocialSharePanel.tsx)
// ============================================================================

import React, { useState } from 'react';
import type { GuardianSummary } from '../../server/types';
import { track } from '../lib/analytics';

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

  const twitterText = `I just unlocked ${guardian.species} [${guardian.rarity_tier}] (${guardian.element}) on @GitHoot! 🔥 Protecting my open-source repos. Preview yours:`;
  const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(profileUrl)}`;
  const linkedInIntentUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
  const facebookIntentUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`;
  const handleCopyBadge = async () => {
    track('share_clicked', { network: 'badge' });
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
      background: 'linear-gradient(180deg, #101624 0%, #0a0e18 100%)',
      border: '1px solid rgba(0, 240, 255, 0.25)',
      borderRadius: '16px',
      padding: 'clamp(16px, 3vw, 24px)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      color: '#f0f6fc',
      fontFamily: "'Schibsted Grotesk', sans-serif",
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <h3 style={{
        fontFamily: "'Archivo', sans-serif",
        fontSize: 'clamp(15px, 2.5vw, 17px)',
        fontWeight: 800,
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <span>🚀</span>
        <span>Share & Showcase Guardian</span>
      </h3>

      {/* Share Buttons Row */}
      {/* Share Buttons Row (3-button Cyber-Arcade layout) */}
      <div className="githoot-share-grid" style={{ marginBottom: '16px' }}>
        <a
          href={twitterIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-touch"
          onClick={() => track('share_clicked', { network: 'x' })}
          style={{
            background: '#000000',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            padding: '12px 14px',
            borderRadius: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 900 }}>𝕏</span>
          <span>Share to X</span>
        </a>

        <a
          href={linkedInIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-touch"
          onClick={() => track('share_clicked', { network: 'linkedin' })}
          style={{
            background: '#0a66c2',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '12px 14px',
            borderRadius: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(10,102,194,0.35)'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 900, background: '#fff', color: '#0a66c2', padding: '1px 4px', borderRadius: '3px' }}>in</span>
          <span>LinkedIn</span>
        </a>

        <a
          href={facebookIntentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-touch"
          onClick={() => track('share_clicked', { network: 'facebook' })}
          style={{
            background: '#1877f2',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            padding: '12px 14px',
            borderRadius: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.15s ease',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(24,119,242,0.35)'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 900, background: '#fff', color: '#1877f2', width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>f</span>
          <span>Facebook</span>
        </a>
      </div>


      {/* README Badge Box */}
      <div style={{
        background: '#06080d',
        border: '1px solid rgba(0, 240, 255, 0.2)',
        borderRadius: '10px',
        padding: '12px 14px',
        textAlign: 'left'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#00f0ff', fontWeight: 700, letterSpacing: '0.05em' }}>
            Dynamic GitHub README Badge:
          </span>
          <button
            type="button"
            onClick={handleCopyBadge}
            style={{
              background: copied ? '#00ff88' : '#141d2c',
              color: copied ? '#000' : '#00f0ff',
              border: '1px solid #00f0ff',
              padding: '6px 14px',
              borderRadius: '6px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: '32px',
              transition: 'all 0.15s ease'
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
          background: '#030508',
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
          userSelect: 'all'
        }}>
          {badgeMarkdown}
        </code>
      </div>
    </div>
  );
};
