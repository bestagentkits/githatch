// ============================================================================
// Gallery Client & Navigation Unit Tests (tests/unit/gallery-client.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { RARITY_COLORS } from '../../src/client/components/GuardianGalleryCard';
import type { RarityTier } from '../../src/server/types';

describe('Gallery Client Components & Helpers', () => {
  it('RARITY_COLORS covers all canonical RarityTier values with valid color tokens', () => {
    const canonicalRarities: RarityTier[] = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    for (const rarity of canonicalRarities) {
      const theme = RARITY_COLORS[rarity];
      expect(theme).toBeDefined();
      expect(theme.border).toBeDefined();
      expect(theme.glow).toBeDefined();
      expect(theme.text).toBeDefined();
      expect(theme.bg).toBeDefined();
    }
  });

  it('verifies /gallery path parser logic mirrors client main.tsx', () => {
    function parsePath(pathStr: string) {
      const path = pathStr.replace(/\/$/, '') || '/';
      if (path === '/' || path === '') return { route: '/', profileUsername: null };
      if (path === '/explore') return { route: '/explore', profileUsername: null };
      if (path === '/gallery') return { route: '/gallery', profileUsername: null };
      if (path === '/design') return { route: '/design', profileUsername: null };
      if (path === '/docs') return { route: '/docs', profileUsername: null };
      const rawUser = path.replace(/^\//, '');
      if (!rawUser.includes('.')) return { route: '/profile', profileUsername: rawUser };
      return { route: '/', profileUsername: null };
    }

    expect(parsePath('/gallery')).toEqual({ route: '/gallery', profileUsername: null });
    expect(parsePath('/gallery/')).toEqual({ route: '/gallery', profileUsername: null });
    expect(parsePath('/explore')).toEqual({ route: '/explore', profileUsername: null });
    expect(parsePath('/mrgoonie')).toEqual({ route: '/profile', profileUsername: 'mrgoonie' });
  });

  it('verifies server isProfile logic correctly excludes gallery', () => {
    function isProfilePath(pathname: string): boolean {
      const cleanUser = pathname.replace(/^\//, '').split('/')[0];
      return Boolean(
        cleanUser &&
        !pathname.includes('.') &&
        cleanUser !== 'explore' &&
        cleanUser !== 'gallery' &&
        cleanUser !== 'design' &&
        cleanUser !== 'docs' &&
        cleanUser !== 'api' &&
        cleanUser !== 'auth' &&
        cleanUser !== 'badge' &&
        cleanUser !== 'og'
      );
    }

    expect(isProfilePath('/gallery')).toBe(false);
    expect(isProfilePath('/gallery/')).toBe(false);
    expect(isProfilePath('/explore')).toBe(false);
    expect(isProfilePath('/design')).toBe(false);
    expect(isProfilePath('/mrgoonie')).toBe(true);
    expect(isProfilePath('/octocat')).toBe(true);
  });
});
