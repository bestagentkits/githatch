// ============================================================================
// GitHoot Global Navigation Bar (src/client/components/Navbar.tsx)
// Implements accessible navigation, mobile drawer & persistent quota per contract.
// ============================================================================

import React, { useState, useEffect } from 'react';
import type { EarlyAccessStatus, UserSession } from '../../server/types';
import { track } from '../lib/analytics';
export interface NavbarProps {
  quota: EarlyAccessStatus | null;
  quotaLoading?: boolean;
  activeRoute: string;
  onRouteChange: (route: string) => void;
}
export const Navbar: React.FC<NavbarProps> = ({
  quota,
  quotaLoading,
  activeRoute,
  onRouteChange
}) => {
  const [searchVal, setSearchVal] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.authenticated && data.user) {
          setUserSession(data.user);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchVal.trim().replace(/^@/, '');
    if (clean) {
      track('profile_lookup_submitted', {
        cta_source: 'navbar',
        input_length: clean.length
      });
      window.location.pathname = `/${encodeURIComponent(clean)}`;
    }
  };

  const handleNav = (route: string) => {
    onRouteChange(route);
    setMobileMenuOpen(false);
  };

  return (
    <header className="githoot-header">
      <div className="nav-inner">
        <div className="nav-brand-wrap">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); handleNav('/'); }}
            className="brand"
          >
            <div className="brand-icon">🦉</div>
            <span>GitHoot</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav" aria-label="Desktop primary navigation">
            <ul className="nav-links">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/')}
                  className={`nav-link ${activeRoute === '/' ? 'active' : ''}`}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/explore')}
                  className={`nav-link ${activeRoute === '/explore' ? 'active' : ''}`}
                >
                  Explore
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/design')}
                  className={`nav-link ${activeRoute === '/design' ? 'active' : ''}`}
                >
                  Design Studio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/docs')}
                  className={`nav-link ${activeRoute === '/docs' ? 'active' : ''}`}
                >
                  Docs & Architecture
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* Right Section: Quota Pill + Search Input + Mobile Menu Toggle */}
        <div className="nav-right">
          {quotaLoading ? (
            <div className="quota-pill" id="nav-quota-pill" aria-busy="true">
              <span className="quota-dot" style={{ animation: 'pulse 1s infinite' }} />
              <span style={{ opacity: 0.7 }}>Early Access: checking slots...</span>
            </div>
          ) : quota ? (
            <div className="quota-pill" id="nav-quota-pill">
              <span className="quota-dot" />
              <span>
                {quota.degraded || quota.remaining === null
                  ? 'Early Access status unavailable'
                  : `Early Access: ${quota.remaining}/${quota.total} slots left`}
              </span>
            </div>
          ) : null}

          {/* Quick Search Form */}
          <form onSubmit={handleSearchSubmit} className="nav-search">
            <label htmlFor="nav-header-search" className="sr-only">GitHub username for lookup</label>
            <input
              type="text"
              id="nav-header-search"
              placeholder="username..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              aria-label="GitHub username for lookup"
            />
            <button type="submit">
              Preview
            </button>
          </form>
          {/* Authentication State: Profile or Login Button */}
          {userSession ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleNav(`/${userSession.login}`)}
                className="btn-touch"
                title={`Logged in as @${userSession.login}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid #00f0ff',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  color: '#ffffff',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(0, 240, 255, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <img
                  src={userSession.avatar_url}
                  alt={userSession.login}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #00f0ff' }}
                />
                <span>@{userSession.login}</span>
              </button>

              <a
                href="/auth/logout"
                title="Sign out"
                style={{
                  color: '#8b9bb4',
                  fontSize: '14px',
                  padding: '6px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'color 0.15s'
                }}
              >
                🚪
              </a>
            </div>
          ) : (
            <a
              href="/auth/github"
              className="btn-touch"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #00f0ff, #0099ff)',
                color: '#000000',
                padding: '8px 16px',
                borderRadius: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 0 16px rgba(0, 240, 255, 0.35)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>⚡</span>
              <span>Login</span>
            </a>
          )}

          {/* Mobile Menu Button (>= 44x44px touch target) */}
          <button
            type="button"
            className="mobile-menu-btn"
            id="mobile-menu-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Persistent mobile quota line under brand row (Contract S0) */}
        <div className="mobile-quota-row">
          {quotaLoading ? (
            <div className="quota-pill" aria-busy="true">
              <span className="quota-dot" style={{ animation: 'pulse 1s infinite' }} />
              <span style={{ opacity: 0.7 }}>Early Access: checking slots...</span>
            </div>
          ) : quota ? (
            <div className="quota-pill">
              <span className="quota-dot" />
              <span>
                {quota.degraded || quota.remaining === null
                  ? 'Early Access status unavailable'
                  : `Early Access: ${quota.remaining}/${quota.total} slots left`}
              </span>
            </div>
          ) : null}
        </div>

      {/* Mobile Drawer Disclosure Panel */}
      <div className={`mobile-nav-panel ${mobileMenuOpen ? 'open' : ''}`} id="mobile-nav-panel">
        <nav aria-label="Mobile navigation">
          <ul className="mobile-nav-list">
            <li>
              <button
                type="button"
                className={`mobile-nav-link ${activeRoute === '/' ? 'active' : ''}`}
                onClick={() => handleNav('/')}
              >
                Home
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`mobile-nav-link ${activeRoute === '/explore' ? 'active' : ''}`}
                onClick={() => handleNav('/explore')}
              >
                Explore Guardians
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`mobile-nav-link ${activeRoute === '/design' ? 'active' : ''}`}
                onClick={() => handleNav('/design')}
              >
                Design Studio
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`mobile-nav-link ${activeRoute === '/docs' ? 'active' : ''}`}
                onClick={() => handleNav('/docs')}
              >
                Docs & Architecture
              </button>
            </li>
            {userSession ? (
              <>
                <li>
                  <button
                    type="button"
                    className={`mobile-nav-link ${activeRoute === `/${userSession.login}` ? 'active' : ''}`}
                    onClick={() => handleNav(`/${userSession.login}`)}
                    style={{ color: '#00f0ff', fontWeight: 800 }}
                  >
                    👤 My Guardian (@{userSession.login})
                  </button>
                </li>
                <li>
                  <a
                    href="/auth/logout"
                    className="mobile-nav-link"
                    style={{ color: '#ff2a85' }}
                  >
                    🚪 Sign Out
                  </a>
                </li>
              </>
            ) : (
              <li>
                <a
                  href="/auth/github"
                  className="mobile-nav-link"
                  style={{ color: '#00f0ff', fontWeight: 800 }}
                >
                  ⚡ Login with GitHub
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};
