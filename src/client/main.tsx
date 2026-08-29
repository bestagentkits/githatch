// ============================================================================
// GitHoot React Client Entrypoint (src/client/main.tsx)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { GachaRevealModal } from './components/GachaRevealModal';
import { CheckoutModal } from './components/CheckoutModal';
import type { GuardianSummary } from '../server/types';

function App() {
  const [username, setUsername] = useState('octocat');
  const [hatchOpen, setHatchOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [guardian, setGuardian] = useState<GuardianSummary | null>(null);

  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '').trim();
    const params = new URLSearchParams(window.location.search);

    if (path && !path.includes('.')) {
      setUsername(path);
    } else if (params.get('username')) {
      setUsername(params.get('username')!);
    }

    if (params.get('hatch') === 'true') {
      const gId = params.get('guardian_id') || 'demo';
      setGuardian({
        id: gId,
        name: 'Ignis Emberfox',
        species: 'Ignis Emberfox',
        element: 'Fire',
        rarity_tier: 'Legendary',
        level: 1,
        experience: 0,
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

  return (
    <>
      <PublicProfilePage username={username} />

      {guardian && (
        <GachaRevealModal
          username={username}
          guardian={guardian}
          isOpen={hatchOpen}
          onClose={() => setHatchOpen(false)}
        />
      )}

      <CheckoutModal
        username={username}
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
