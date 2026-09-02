// ============================================================================
// GitHoot React Client Entrypoint & Router (src/client/main.tsx)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/responsive.css';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import type { EarlyAccessStatus, GuardianSummary, PublicConfig, ResolvedProfile } from '../server/types';
import { track } from './lib/analytics';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { GalleryPage } from './pages/GalleryPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { DocsPage } from './pages/DocsPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { HatchWaitPage } from './pages/HatchWaitPage';
import { GachaRevealModal } from './components/GachaRevealModal';
import { CheckoutModal } from './components/CheckoutModal';
interface RouteState {
  route: string;
  profileUsername: string | null;
}

function parsePath(pathStr: string): RouteState {
  const path = pathStr.replace(/\/$/, '') || '/';
  if (path === '/' || path === '') {
    return { route: '/', profileUsername: null };
  }
  if (path === '/explore') {
    return { route: '/explore', profileUsername: null };
  }
  if (path === '/gallery') {
    return { route: '/gallery', profileUsername: null };
  }
  if (path === '/design') {
    return { route: '/design', profileUsername: null };
  }
  if (path === '/docs') {
    return { route: '/docs', profileUsername: null };
  }
  if (path.startsWith('/hatch/wait/')) {
    const user = path.replace('/hatch/wait/', '');
    return { route: '/hatch/wait', profileUsername: user };
  }
  if (path.startsWith('/hatch/reveal/')) {
    const user = path.replace('/hatch/reveal/', '');
    return { route: '/hatch/reveal', profileUsername: user };
  }

  // Profile Route: /:username
  const rawUser = path.replace(/^\//, '');
  if (!rawUser.includes('.')) {
    return { route: '/profile', profileUsername: rawUser };
  }

  return { route: '/', profileUsername: null };
}

function App() {
  const [routeState, setRouteState] = useState<RouteState>(() => parsePath(window.location.pathname));
  const [quotaState, setQuotaState] = useState<{ data: EarlyAccessStatus | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false
  });
  const [configState, setConfigState] = useState<{ data: PublicConfig | null; loading: boolean; error: boolean }>({
    data: null,
    loading: true,
    error: false
  });
  const [hatchOpen, setHatchOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guardian, setGuardian] = useState<GuardianSummary | null>(null);

  const resolveRoute = useCallback((path: string) => {
    setRouteState(parsePath(path));
  }, []);

  const handleRouteChange = useCallback((route: string) => {
    window.history.pushState({}, '', route);
    resolveRoute(route);
  }, [resolveRoute]);

  useEffect(() => {
    // 1. Fetch live early access status
    fetch('/api/early-access/status')
      .then((res) => {
        if (!res.ok) throw new Error('Status HTTP ' + res.status);
        return res.json();
      })
      .then((data) => {
        setQuotaState({ data: data as EarlyAccessStatus, loading: false, error: false });
      })
      .catch(() => {
        // Explicit degraded state on network / server failure (never synthesize fake numbers)
        setQuotaState({
          data: {
            total: 100,
            claimed: null,
            remaining: null,
            is_free: true,
            user_has_claimed: false,
            degraded: true
          },
          loading: false,
          error: true
        });
      });

    // 2. Fetch public client configuration
    fetch('/api/config')
      .then((res) => {
        if (!res.ok) throw new Error('Config HTTP ' + res.status);
        return res.json();
      })
      .then((data) => {
        setConfigState({ data: data as PublicConfig, loading: false, error: false });
      })
      .catch(() => {
        setConfigState({
          data: null,
          loading: false,
          error: true
        });
      });

    // 3. Handle modal query triggers (?hatch=true / ?checkout=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get('hatch') === 'true') {
      const gId = params.get('guardian_id');
      const isFreeParam = params.get('is_free');
      const usernameMatch = window.location.pathname.replace(/^\//, '').split('/')[0];
      if (gId && usernameMatch && usernameMatch !== 'explore' && usernameMatch !== 'design' && usernameMatch !== 'docs') {
        fetch(`/api/profile/${encodeURIComponent(usernameMatch)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((profileData: ResolvedProfile | null) => {
            if (profileData && profileData.claimed && profileData.guardian && profileData.guardian.id === gId) {
              setGuardian(profileData.guardian);
              setHatchOpen(true);
              const claimStorageKey = `githoot_claim_${gId}`;
              if (!sessionStorage.getItem(claimStorageKey)) {
                sessionStorage.setItem(claimStorageKey, '1');
                track('claim_completed', {
                  archetype_id: profileData.egg_archetype_id,
                  rarity_tier: profileData.guardian.rarity_tier,
                  slot_is_free: isFreeParam === '0' ? false : true
                });
              }
              window.history.replaceState({}, '', window.location.pathname);
            }
          })
          .catch(() => {
            // Ignore fetch errors; no fake guardian rendered
          });
      }
    }
    if (params.get('checkout') === 'true') {
      setCheckoutOpen(true);
    }

    // 4. Browser history (back/forward navigation)
    const handlePopState = () => {
      resolveRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resolveRoute]);

  const handleHatchReady = async () => {
    if (!routeState.profileUsername) return;
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(routeState.profileUsername)}`);
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
    switch (routeState.route) {
      case '/':
        return (
          <HomePage
            quota={quotaState.data}
            quotaLoading={quotaState.loading}
            config={configState.data}
            configLoading={configState.loading}
            configError={configState.error}
            onRouteChange={handleRouteChange}
          />
        );
      case '/explore':
        return <ExplorePage />;
      case '/gallery':
        return <GalleryPage onRouteChange={handleRouteChange} />;
      case '/design':
        return <DesignSystemPage />;
      case '/docs':
        return <DocsPage />;
      case '/hatch/wait':
      case '/hatch/reveal':
        return routeState.profileUsername ? (
          <HatchWaitPage
            username={routeState.profileUsername}
            guardianId=""
            onReady={handleHatchReady}
          />
        ) : (
          <HomePage onRouteChange={handleRouteChange} />
        );
      case '/profile':
        return routeState.profileUsername ? (
          <PublicProfilePage username={routeState.profileUsername} />
        ) : (
          <HomePage
            quota={quotaState.data}
            quotaLoading={quotaState.loading}
            config={configState.data}
            configLoading={configState.loading}
            configError={configState.error}
            onRouteChange={handleRouteChange}
          />
        );
      default:
        return (
          <HomePage
            quota={quotaState.data}
            quotaLoading={quotaState.loading}
            config={configState.data}
            configLoading={configState.loading}
            configError={configState.error}
            onRouteChange={handleRouteChange}
          />
        );
    }
  };

  return (
    <>
      <Navbar
        quota={quotaState.data}
        quotaLoading={quotaState.loading}
        activeRoute={routeState.route === '/profile' && routeState.profileUsername ? `/${routeState.profileUsername}` : routeState.route}
        onRouteChange={handleRouteChange}
      />
      {renderActivePage()}
      <Footer
        quota={quotaState.data}
        quotaLoading={quotaState.loading}
        config={configState.data}
        configLoading={configState.loading}
        configError={configState.error}
        onRouteChange={handleRouteChange}
      />

      {guardian && routeState.profileUsername && (
        <GachaRevealModal
          username={routeState.profileUsername}
          guardian={guardian}
          isOpen={hatchOpen}
          onClose={() => {
            setHatchOpen(false);
            if (routeState.profileUsername) {
              handleRouteChange(`/${encodeURIComponent(routeState.profileUsername)}`);
            }
          }}
        />
      )}

      {routeState.profileUsername && (
        <CheckoutModal
          username={routeState.profileUsername}
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
