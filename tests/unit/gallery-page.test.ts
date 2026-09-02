// ============================================================================
// Gallery Page & Card Component Unit Tests (tests/unit/gallery-page.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GuardianGalleryCard, RARITY_COLORS } from '../../src/client/components/GuardianGalleryCard';
import { GalleryPage } from '../../src/client/pages/GalleryPage';
import type { GalleryItem } from '../../src/server/types';

describe('GuardianGalleryCard Component Rendering', () => {
  const sampleItem: GalleryItem = {
    id: 'g-test-1',
    name: 'Aether Neonbyte',
    species: 'neonbyte',
    species_name: 'Aether Neonbyte',
    element: 'Cyber',
    rarity_tier: 'Epic',
    level: 14,
    experience: 4280,
    energy_state: 'Active',
    hero_image_url: 'https://cdn.example.com/heroes/neonbyte.png',
    spritesheet_url: 'https://cdn.example.com/masters/strip.png',
    published_at: 1788300000000,
    owner: {
      login: 'mrgoonie',
      name: 'Hoang Anh',
      avatar_url: 'https://avatars.example.com/mrgoonie',
      total_stars: 42
    }
  };

  it('renders card with correct name, species, element, rarity and owner stats', () => {
    const onRouteChange = vi.fn();
    const html = renderToString(
      React.createElement(GuardianGalleryCard, { item: sampleItem, onRouteChange })
    );

    expect(html).toContain('Aether Neonbyte');
    expect(html).toContain('Cyber');
    expect(html).toContain('Epic');
    expect(html).toContain('LVL');
    expect(html).toContain('mrgoonie');
    expect(html).toContain('42');
    expect(html).toContain('https://cdn.example.com/heroes/neonbyte.png');
  });

  it('applies Epic rarity styling tokens', () => {
    const onRouteChange = vi.fn();
    const html = renderToString(
      React.createElement(GuardianGalleryCard, { item: sampleItem, onRouteChange })
    );
    const epicColors = RARITY_COLORS.Epic;

    expect(html).toContain(epicColors.text);
    expect(html).toContain(epicColors.border);
  });

  it('renders fallback when owner avatar is null', () => {
    const itemWithoutAvatar: GalleryItem = {
      ...sampleItem,
      owner: { ...sampleItem.owner, avatar_url: null }
    };
    const html = renderToString(
      React.createElement(GuardianGalleryCard, { item: itemWithoutAvatar, onRouteChange: vi.fn() })
    );

    expect(html).toContain('👤');
    expect(html).toContain('mrgoonie');
  });
});

describe('GalleryPage Server/Client Rendering & Shell', () => {
  it('renders page header, search input, filter selects, and live status', () => {
    const onRouteChange = vi.fn();
    const html = renderToString(
      React.createElement(GalleryPage, { onRouteChange })
    );

    expect(html).toContain('Gallery of Guardians');
    expect(html).toContain('Search by owner or guardian...');
    expect(html).toContain('All Elements');
    expect(html).toContain('All Rarities');
    expect(html).toContain('Newest First');
    expect(html).toContain('Oldest First');
    expect(html).toContain('role="status"');
    expect(html).toContain('Explore egg archetypes');
  });
});
