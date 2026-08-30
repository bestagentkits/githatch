// ============================================================================
// GitHoot Global Navigation Bar (src/client/components/Navbar.tsx)
// Implements accessible navigation, mobile drawer & persistent quota per contract.
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchVal.trim().replace(/^@/, '');
    if (clean) {
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
          {quota && (
            <div className="quota-pill" id="nav-quota-pill">
              <span className="quota-dot" />
              <span>
                {quota.degraded || quota.remaining === null
                  ? 'Early Access status unavailable'
                  : `Early Access: ${quota.remaining}/${quota.total} slots left`}
              </span>
            </div>
          )}

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
      {quota && (
        <div className="mobile-quota-row">
          <div className="quota-pill">
            <span className="quota-dot" />
            <span>
              {quota.degraded || quota.remaining === null
                ? 'Early Access status unavailable'
                : `Early Access: ${quota.remaining}/${quota.total} slots left`}
            </span>
          </div>
        </div>
      )}

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
          </ul>
        </nav>
      </div>
    </header>
  );
};
