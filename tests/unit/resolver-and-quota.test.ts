// ============================================================================
// GitHoot Unit Tests: SWR Resolver, Token Pool & Quota
// (tests/unit/resolver-and-quota.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateDegradedProfile, normalizeGuardianSummary, resolveGitHubProfile } from '../../src/server/services/github/resolver';
import { parseTokenPool, recordTokenResponse } from '../../src/server/services/github/token-pool';
import { calculateGuardianMood } from '../../src/server/services/progression/mood-engine';
import type { Env, PublicConfig, EarlyAccessStatus, ResolvedProfile, GuardianSummary } from '../../src/server/types';
import app from '../../src/server/index';
import { getEarlyAccessStatus } from '../../src/server/services/claim/quota';
describe('SWR Resolver & Degraded Seed Fallback', () => {
  it('generates a valid degraded profile from username alone when GitHub is throttled', async () => {
    const degraded = await generateDegradedProfile('torvalds');

    expect(degraded.login).toBe('torvalds');
    expect(degraded.source).toBe('degraded_seed');
    expect(degraded.claimed).toBe(false);
    expect(degraded.dna_seed.length).toBe(64); // SHA-256 length
    expect(degraded.egg_archetype_id).toBeDefined();
    expect(degraded.estimated_rarity).toBeDefined();
  });
});

describe('Token Pool Manager', () => {
  it('parses JSON array and comma-separated tokens correctly', () => {
    const mockEnvJson: Env = {
      GITHUB_TOKENS: '["ghp_token1", "ghp_token2"]'
    } as Env;
    expect(parseTokenPool(mockEnvJson)).toEqual(['ghp_token1', 'ghp_token2']);

    const mockEnvCsv: Env = {
      GITHUB_TOKENS: 'ghp_tokenA, ghp_tokenB'
    } as Env;
    expect(parseTokenPool(mockEnvCsv)).toEqual(['ghp_tokenA', 'ghp_tokenB']);
  });

  it('handles escaped quotes, bearer prefix, and newline-separated tokens', () => {
    const mockEnvEscaped: Env = {
      GITHUB_TOKENS: '"[\"Bearer ghp_token1\", \"ghp_token2\"]"'
    } as Env;
    expect(parseTokenPool(mockEnvEscaped)).toEqual(['ghp_token1', 'ghp_token2']);

    const mockEnvNewlines: Env = {
      GITHUB_TOKENS: 'Bearer ghp_alpha\nBearer ghp_beta\r\nghp_gamma'
    } as Env;
    expect(parseTokenPool(mockEnvNewlines)).toEqual(['ghp_alpha', 'ghp_beta', 'ghp_gamma']);
  });

  it('records rate limit response headers correctly', () => {
    const headers = new Headers({
      'x-ratelimit-remaining': '4950',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
    });

    expect(() => recordTokenResponse('ghp_test_token', headers)).not.toThrow();
  });
});

describe('Tamagotchi Mood Engine', () => {
  it('returns Energetic for activity within 24 hours', () => {
    const now = Date.now();
    const mood = calculateGuardianMood(now - 1000 * 3600 * 4); // 4h ago
    expect(mood.state).toBe('Energetic');
    expect(mood.recommendedPose).toBe('work');
  });

  it('returns Active for activity within 7 days', () => {
    const now = Date.now();
    const mood = calculateGuardianMood(now - 1000 * 3600 * 48); // 2 days ago
    expect(mood.state).toBe('Active');
    expect(mood.recommendedPose).toBe('idle');
  });

  it('returns Resting for activity within 30 days', () => {
    const now = Date.now();
    const mood = calculateGuardianMood(now - 1000 * 3600 * 24 * 15); // 15 days ago
    expect(mood.state).toBe('Resting');
    expect(mood.recommendedPose).toBe('sleepy');
  });

  it('returns Hungry_for_code for activity older than 30 days', () => {
    const now = Date.now();
    const mood = calculateGuardianMood(now - 1000 * 3600 * 24 * 45); // 45 days ago
    expect(mood.state).toBe('Hungry_for_code');
  });
});

describe('Public Config & Quota Endpoint Contracts', () => {
  it('returns full public configuration with all 8 contract fields from /api/config', async () => {
    const mockEnv = {
      ENVIRONMENT: 'production',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      POSTHOG_API_KEY: 'ph_test_key'
    } as unknown as Env;

    const res = await app.request('/api/config', {}, mockEnv);
    expect(res.status).toBe(200);

    const config = (await res.json()) as PublicConfig;
    expect(config.quota_total).toBe(100);
    expect(config.free_until).toBe(100);
    expect(config.charge_after_usd).toBe(0.99);
    expect(config.analytics_enabled).toBe(true);
    expect(config.posthog_configured).toBe(true);
    expect(config.environment).toBe('production');
    expect(config.domain).toBe('githoot.com');
    expect(config.cdn_domain).toBe('cdn.githoot.com');
  });

  it('returns degraded: true and claimed: null, remaining: null on database failure', async () => {
    const mockEnvBrokenDb = {
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      DB: {
        prepare: () => {
          throw new Error('D1 connection broken');
        }
      }
    } as unknown as Env;

    const res = await app.request('/api/early-access/status', {}, mockEnvBrokenDb);
    expect(res.status).toBe(200);

    const status = (await res.json()) as EarlyAccessStatus;
    expect(status.degraded).toBe(true);
    expect(status.claimed).toBeNull();
    expect(status.remaining).toBeNull();
    expect(status.total).toBe(100);
  });

  it('returns degraded: false and exact claimed/remaining numbers on healthy database', async () => {
    const mockEnvHealthyDb = {
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      DB: {
        prepare: () => ({
          first: async () => ({ count: 42 })
        })
      }
    } as unknown as Env;

    const status = await getEarlyAccessStatus(mockEnvHealthyDb);
    expect(status.degraded).toBe(false);
    expect(status.claimed).toBe(42);
    expect(status.remaining).toBe(58);
    expect(status.total).toBe(100);
    expect(status.is_free).toBe(true);
  });

  it('normalizes sample pet heroUrl to canonical transparent .webp matching species', () => {
    const rawGuardian: GuardianSummary = {
      id: 'test-guardian-id',
      name: 'Zenith Celestial Drake',
      species: 'Zenith Celestial Drake',
      element: 'Mythic',
      rarity_tier: 'Common',
      level: 1,
      experience: 0,
      energy_state: 'Active',
      hero_image_url: '/assets/sample-pets/verdant.jpg',
      spritesheet_url: null
    };

    const normalized = normalizeGuardianSummary(rawGuardian);
    expect(normalized).toBeDefined();
    expect(normalized?.hero_image_url).toBe('/assets/sample-pets/celestialdrake.webp');
    expect(normalized?.species).toBe('Zenith Celestial Drake');
  });

  it('normalizes all 8 canonical species correctly from legacy paths', () => {
    const speciesList: Array<[string, string]> = [
      ['Ignis Emberfox', 'emberfox'],
      ['Aether Neon Byte', 'neonbyte'],
      ['Nox Abyssal Pearl', 'abyssal'],
      ['Sylvan Verdant Golem', 'verdant'],
      ['Helios Solar Griffin', 'solargriffin'],
      ['Astral Void Stalker', 'voidstalker'],
      ['Ferrum Rust Golem', 'rustgolem'],
      ['Zenith Celestial Drake', 'celestialdrake']
    ];

    for (const [species, slug] of speciesList) {
      const g: GuardianSummary = {
        id: 'g-test',
        name: species,
        species,
        element: 'Fire',
        rarity_tier: 'Legendary',
        level: 1,
        experience: 0,
        energy_state: 'Active',
        hero_image_url: `/assets/sample-pets/${slug}.jpg`,
        spritesheet_url: null
      };
      const res = normalizeGuardianSummary(g);
      expect(res?.hero_image_url).toBe(`/assets/sample-pets/${slug}.webp`);
    }
  });
  it('normalizes legacy sample pet heroUrl on KV fresh and stale cache hits', async () => {
    const cachedProfileWithLegacyJpg: ResolvedProfile = {
      github_user_id: 6857382,
      login: 'mrgoonie',
      name: 'Duy',
      bio: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/6857382',
      public_repos: 122,
      followers: 942,
      total_stars: 0,
      top_languages: ['TypeScript'],
      dna_seed: 'seed123',
      egg_archetype_id: 'celestial-echo',
      estimated_rarity: 'Common',
      claimed: true,
      guardian: {
        id: 'g-1',
        name: 'Zenith Celestial Drake',
        species: 'Zenith Celestial Drake',
        element: 'Mythic',
        rarity_tier: 'Common',
        level: 1,
        experience: 0,
        energy_state: 'Active',
        hero_image_url: '/assets/sample-pets/verdant.jpg',
        spritesheet_url: null
      },
      source: 'github_live',
      last_synced_at: Date.now()
    };

    const mockEnvKvCached = {
      CACHE_KV: {
        get: async () => ({
          timestamp: Date.now() - 5000,
          data: cachedProfileWithLegacyJpg
        }),
        put: async () => {}
      }
    } as unknown as Env;

    const profile = await resolveGitHubProfile('mrgoonie', mockEnvKvCached);
    expect(profile.source).toBe('cache_fresh');
    expect(profile.guardian?.hero_image_url).toBe('/assets/sample-pets/celestialdrake.webp');
  });
});
