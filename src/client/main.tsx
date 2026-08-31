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
import { HatchWaitPage } from './pages/HatchWaitPage';
import { GachaRevealModal } from './components/GachaRevealModal';
import { CheckoutModal } from './components/CheckoutModal';
import type { GuardianSummary, EarlyAccessStatus, ResolvedProfile } from '../server/types';

function App() {
  const [currentRoute, setCurrentRoute] = useState<string>('/');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [hatchGuardianId, setHatchGuardianId] = useState<string | null>(null);
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
    } else if (path.startsWith('/hatch/wait/')) {
      const user = path.replace('/hatch/wait/', '');
      setCurrentRoute('/hatch/wait');
      setProfileUsername(user);
      setHatchGuardianId(params.get('guardian_id') || '');
    } else if (path.startsWith('/hatch/reveal/')) {
      const user = path.replace('/hatch/reveal/', '');
      setCurrentRoute('/hatch/reveal');
      setProfileUsername(user);
      setHatchGuardianId(params.get('guardian_id') || '');
    } else {
      // User Profile Route: /:username
      const rawUser = path.replace(/^\//, '');
      if (!rawUser.includes('.')) {
        setCurrentRoute('/profile');
        setProfileUsername(rawUser);
      }
    }

    if (params.get('checkout') === 'true') {
      setCheckoutOpen(true);
    }
  }, []);

  const handleRouteChange = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
  };

  const handleHatchReady = async () => {
    if (!profileUsername) return;
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(profileUsername)}`);
      if (res.ok) {
        const data = (await res.json()) as ResolvedProfile;
        if (data.guardian) {
          setGuardian(data.guardian);
          setHatchOpen(true);
        }
      }
    } catch {
      // Fallback open
      setHatchOpen(true);
    }
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
      case '/hatch/wait':
      case '/hatch/reveal':
        return profileUsername ? (
          <HatchWaitPage
            username={profileUsername}
            guardianId={hatchGuardianId || ''}
            onReady={handleHatchReady}
          />
        ) : (
          <HomePage onRouteChange={handleRouteChange} />
        );
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
          onClose={() => {
            setHatchOpen(false);
            if (profileUsername) {
              handleRouteChange(`/${encodeURIComponent(profileUsername)}`);
            }
          }}
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
