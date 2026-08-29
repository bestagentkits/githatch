// ============================================================================
// GitHoot Global Navigation Bar (src/client/components/Navbar.tsx)
// ============================================================================

import React, { useState } from 'react';
import type { EarlyAccessStatus } from '../../server/types';

export interface NavbarProps {
  quota: EarlyAccessStatus | null;
  activeRoute: string;
  onRouteChange: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  quota,
  activeRoute,
  onRouteChange
}) => {
  const [searchVal, setSearchVal] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      window.location.pathname = `/${encodeURIComponent(searchVal.trim())}`;
    }
  };

  return (
    <header className="githoot-header" style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'rgba(7, 9, 14, 0.88)', backdropFilter: 'blur(16px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Brand Logo */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onRouteChange('/'); }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: '20px', fontFamily: "'Archivo', sans-serif" }}
        >
          <span style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #00f0ff, #ff2a85)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 0 16px rgba(0,240,255,0.4)' }}>🦉</span>
          <span>GitHoot</span>
        </a>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onRouteChange('/')}
            style={getNavLinkStyle(activeRoute === '/')}
          >
            Home
          </button>
          <button
            onClick={() => onRouteChange('/explore')}
            style={getNavLinkStyle(activeRoute === '/explore')}
          >
            Explore
          </button>
          <button
            onClick={() => onRouteChange('/design')}
            style={getNavLinkStyle(activeRoute === '/design')}
          >
            Design Studio
          </button>
          <button
            onClick={() => onRouteChange('/docs')}
            style={getNavLinkStyle(activeRoute === '/docs')}
          >
            Docs & Architecture
          </button>
        </nav>
      </div>

      {/* Right Section: Early Access Slot Badge + Search Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {quota && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,240,255,0.08)', border: '1px solid #00f0ff', padding: '6px 14px', borderRadius: '9999px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#00f0ff' }}>
            <span style={{ width: '8px', height: '8px', background: '#00f0ff', borderRadius: '50%', boxShadow: '0 0 8px #00f0ff', animation: 'pulse 1.5s infinite' }} />
            <span>Early Access: {quota.remaining}/{quota.total} slots left</span>
          </div>
        )}

        {/* Quick Search Form */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="GitHub username..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            style={{
              background: '#0d111a',
              border: '1px solid rgba(0,240,255,0.25)',
              borderRadius: '6px 0 0 6px',
              padding: '6px 12px',
              color: '#fff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              outline: 'none',
              width: '140px'
            }}
          />
          <button
            type="submit"
            style={{
              background: '#00f0ff',
              border: '1px solid #00f0ff',
              borderRadius: '0 6px 6px 0',
              padding: '6px 12px',
              color: '#000',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Hatch →
          </button>
        </form>
      </div>
    </header>
  );
};

function getNavLinkStyle(active: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: active ? '#00f0ff' : '#8b9bb4',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '4px',
    transition: 'color 0.15s',
    borderBottom: active ? '2px solid #00f0ff' : '2px solid transparent'
  };
}
