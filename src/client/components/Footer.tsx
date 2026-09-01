// ============================================================================
// GitHoot Global Footer Component (src/client/components/Footer.tsx)
// Implements 4-column link inventory and verified credit per accepted contract.
// ============================================================================

import React from 'react';
import type { EarlyAccessStatus, PublicConfig } from '../../server/types';

export interface FooterProps {
  quota?: EarlyAccessStatus | null;
  quotaLoading?: boolean;
  config?: PublicConfig | null;
  configLoading?: boolean;
  configError?: boolean;
  onRouteChange?: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  quota,
  quotaLoading,
  config,
  configLoading,
  configError,
  onRouteChange
}) => {
  const handleNavClick = (e: React.MouseEvent, route: string) => {
    if (onRouteChange) {
      e.preventDefault();
      onRouteChange(route);
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: isReduced ? 'auto' : 'smooth' });
    }
  };
  return (
    <footer style={{
      background: '#05070B',
      padding: '64px 0 32px',
      borderTop: '1px solid rgba(0, 240, 255, 0.15)',
      width: '100%'
    }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 24px' }}>
        
        {/* Masthead Tagline per contract §6:271 */}
        <div style={{
          marginBottom: '36px',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontFamily: "'Archivo', sans-serif", fontSize: '18px', fontWeight: 900, color: '#fff' }}>
            🦉 GitHoot
          </span>
          <span style={{ color: '#8b9bb4', fontSize: '14px' }}>
            — A developer discovery network disguised as a fantasy companion game.
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '36px',
          marginBottom: '48px'
        }}>
          
          {/* Col 1: GitHoot */}
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              color: '#00f0ff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px'
            }}>
              GitHoot
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px', padding: 0, margin: 0 }}>
              <li>
                <a href="/" onClick={(e) => handleNavClick(e, '/')} style={footerLinkStyle}>
                  Home
                </a>
              </li>
              <li>
                <a href="/explore" onClick={(e) => handleNavClick(e, '/explore')} style={footerLinkStyle}>
                  Explore Guardians
                </a>
              </li>
              <li>
                <a href="/design" onClick={(e) => handleNavClick(e, '/design')} style={footerLinkStyle}>
                  Design Studio
                </a>
              </li>
              <li>
                <a href="/docs" onClick={(e) => handleNavClick(e, '/docs')} style={footerLinkStyle}>
                  Docs & Architecture
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: For Developers */}
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              color: '#00f0ff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px'
            }}>
              For Developers
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px', padding: 0, margin: 0 }}>
              <li>
                <a href="/design-overview.html" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  Design System Overview <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#53627a' }}>(large static page)</span>
                </a>
              </li>
              <li>
                <a href="/health" style={footerLinkStyle}>
                  Service Health
                </a>
              </li>
              <li>
                <a href="/octocat" onClick={(e) => handleNavClick(e, '/octocat')} style={footerLinkStyle}>
                  Example Profile (@octocat)
                </a>
              </li>
              <li>
                <a href="/badge/octocat.svg" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  README Badge (Example)
                </a>
              </li>
              <li>
                <a href="/og/octocat.png" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  Share Card (Example)
                </a>
              </li>
            </ul>

            {/* Plain non-link text inventory per contract §9:454 */}
            <div style={{
              marginTop: '16px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#53627a',
              lineHeight: 1.6
            }}>
              Reference docs in the repository: docs/prd.md · docs/system-architecture.md · docs/design-guidelines.md · docs/roadmap.md
            </div>
          </div>

          {/* Col 3: From the Creator */}
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              color: '#00f0ff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px'
            }}>
              From the Creator
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#8b9bb4', marginBottom: '10px' }}>
              Zuey · @goon_nguyen
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px', padding: 0, margin: 0 }}>
              <li>
                <a href="https://agentkit.best" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  AgentKit.best
                </a>
              </li>
              <li>
                <a href="https://nextlevelbuilder.io" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  NextLevelBuilder.io
                </a>
              </li>
              <li>
                <a href="https://goclaw.sh" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  GoClaw.sh
                </a>
              </li>
              <li>
                <a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  UI UX Pro Max Skill
                </a>
              </li>
              <li>
                <a href="https://github.com/bestagentkits/githatch" target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                  Source on GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Status & Privacy */}
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 800,
              color: '#00f0ff',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '16px'
            }}>
              Status & Privacy
            </div>
            <p style={footerTextStyle}>
              Pre-launch. No Guardians hatched yet.
            </p>
            <p style={footerTextStyle}>
              {quotaLoading ? (
                <span style={{ color: '#8b9bb4' }}>Checking Early Access status...</span>
              ) : quota?.degraded || quota?.remaining === null ? (
                <span style={{ color: '#ffa800' }}>Early Access: status unavailable</span>
              ) : quota ? (
                `Early Access: ${quota.remaining}/${quota.total} slots left.`
              ) : (
                <span style={{ color: '#ffa800' }}>Early Access: status unavailable</span>
              )}
            </p>
            <p style={footerTextStyle}>
              {configLoading ? (
                'Checking telemetry status...'
              ) : configError ? (
                <span style={{ color: '#ffa800' }}>Telemetry status unavailable</span>
              ) : config?.posthog_configured ? (
                <span style={{ color: '#00ff88' }}>PostHog telemetry configured (zero-cookie proxy).</span>
              ) : (
                'No analytics key configured — this page sets no tracking cookies and contacts no telemetry hosts.'
              )}
            </p>
          </div>

        </div>

        {/* Verbatim Credit Line */}
        <div style={{
          textAlign: 'center',
          paddingTop: '32px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: '#53627a'
        }}>
          Made with ❤️ by <a href="https://agentkit.best" target="_blank" rel="noopener noreferrer" style={{ color: '#00f0ff', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 4px' }}>AgentKit.best</a>
        </div>
      </div>
    </footer>
  );
};

const footerLinkStyle: React.CSSProperties = {
  color: '#8b9bb4',
  textDecoration: 'none',
  fontSize: '13px',
  transition: 'color 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px' // Standard 44px mobile touch target
};

const footerTextStyle: React.CSSProperties = {
  color: '#53627a',
  fontSize: '12px',
  lineHeight: 1.6,
  marginBottom: '8px'
};
