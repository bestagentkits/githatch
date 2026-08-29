// ============================================================================
// GitHoot React Client Entrypoint & Router (src/client/main.tsx)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/responsive.css';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { DocsPage } from './pages/DocsPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { GachaRevealModal } from './components/GachaRevealModal';
import { CheckoutModal } from './components/CheckoutModal';
import type { GuardianSummary, EarlyAccessStatus } from '../server/types';

function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [quota, setQuota] = useState<EarlyAccessStatus | null>(null);
  const [hatchOpen, setHatchOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guardian, setGuardian] = useState<GuardianSummary | null>(null);

  useEffect(() => {
    // 1. Fetch live early access status for Navbar
    fetch('/api/early-access/status')
      .then(res => res.json())
      .then(data => setQuota(data as EarlyAccessStatus))
      .catch(() => {});

    // 2. Parse Route from window.location
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    const params = new URLSearchParams(window.location.search);

    if (path === '/' || path === '') {
      setCurrentRoute('/');
    } else if (path === '/explore') {
      setCurrentRoute('/explore');
    } else if (path === '/design') {
      setCurrentRoute('/design');
    } else if (path === '/docs') {
      setCurrentRoute('/docs');
    } else {
      // User Profile Route: /:username
      const rawUser = path.replace(/^\//, '');
      if (!rawUser.includes('.')) {
        setCurrentRoute('/profile');
        setProfileUsername(rawUser);
      }
    }

    // Check modal triggers
    if (params.get('hatch') === 'true') {
      const gId = params.get('guardian_id') || 'demo';
      setGuardian({
        id: gId,
        name: 'Ignis Emberfox',
        species: 'Ignis Emberfox',
        element: 'Fire',
        rarity_tier: 'Legendary',
        level: 1,
        experience: 420,
        energy_state: 'Active',
        hero_image_url: '/assets/sample-pets/emberfox.jpg',
        spritesheet_url: '/assets/sample-pets/emberfox.jpg'
      });
      setHatchOpen(true);
    }

    if (params.get('checkout') === 'true') {
      setCheckoutOpen(true);
    }
  }, []);

  const handleRouteChange = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
  };

  const renderActivePage = () => {
    switch (currentRoute) {
      case '/':
        return <HomePage onRouteChange={handleRouteChange} />;
      case '/explore':
        return <ExplorePage />;
      case '/design':
        return <DesignSystemPage />;
      case '/docs':
        return <DocsPage />;
      case '/profile':
        return profileUsername ? <PublicProfilePage username={profileUsername} /> : <HomePage onRouteChange={handleRouteChange} />;
      default:
        return <HomePage onRouteChange={handleRouteChange} />;
    }
  };

  return (
    <>
      <Navbar quota={quota} activeRoute={currentRoute} onRouteChange={handleRouteChange} />
      {renderActivePage()}

      {guardian && profileUsername && (
        <GachaRevealModal
          username={profileUsername}
          guardian={guardian}
          isOpen={hatchOpen}
          onClose={() => setHatchOpen(false)}
        />
      )}

      {profileUsername && (
        <CheckoutModal
          username={profileUsername}
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
        />
      )}
    </>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
