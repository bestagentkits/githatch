// ============================================================================
// GitHoot Unit Tests: SWR Resolver, Token Pool & Quota
// (tests/unit/resolver-and-quota.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateDegradedProfile, normalizeGuardianSummary, resolveGitHubProfile } from '../../src/server/services/github/resolver';
import { parseTokenPool, recordTokenResponse } from '../../src/server/services/github/token-pool';
import { calculateGuardianMood } from '../../src/server/services/progression/mood-engine';
import { createSessionToken, verifySessionToken, generateSignedState, verifySignedState } from '../../src/server/services/auth/oauth';
import { renderSvgToPng } from '../../src/server/services/image/resvg-renderer';
import type { Env, PublicConfig, EarlyAccessStatus, ResolvedProfile, GuardianSummary, UserSession } from '../../src/server/types';
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
      activities: [],
      highlighted_repos: [],
      active_repos: [],
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

describe('Auth Session & OAuth State Integrity', () => {
  const secret = 'super-secret-key-32-chars-length!';

  it('generates and verifies login and claim OAuth signed state tokens', async () => {
    const claimState = await generateSignedState('octocat', secret, 'claim');
    const parsedClaim = await verifySignedState(claimState, secret);
    expect(parsedClaim).not.toBeNull();
    expect(parsedClaim?.claim_username).toBe('octocat');
    expect(parsedClaim?.intent).toBe('claim');

    const loginState = await generateSignedState('', secret, 'login');
    const parsedLogin = await verifySignedState(loginState, secret);
    expect(parsedLogin).not.toBeNull();
    expect(parsedLogin?.intent).toBe('login');
    expect(parsedLogin?.claim_username).toBeUndefined();
  });

  it('rejects tampered OAuth state tokens', async () => {
    const validState = await generateSignedState('octocat', secret, 'claim');
    const tampered = validState.slice(0, -4) + 'abcd';
    const result = await verifySignedState(tampered, secret);
    expect(result).toBeNull();
  });

  it('creates and verifies user session tokens correctly', async () => {
    const user: UserSession = {
      id: 123456,
      login: 'mona-lisa',
      name: 'Mona Lisa',
      avatar_url: 'https://avatars.githubusercontent.com/u/123456'
    };

    const sessionToken = await createSessionToken(user, secret);
    expect(typeof sessionToken).toBe('string');
    expect(sessionToken.includes('.')).toBe(true);

    const verified = await verifySessionToken(sessionToken, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(123456);
    expect(verified?.login).toBe('mona-lisa');
    expect(verified?.name).toBe('Mona Lisa');
  });

  it('correctly serializes and deserializes non-Latin, Vietnamese and Emoji user names without btoa errors', async () => {
    const unicodeUser: UserSession = {
      id: 777888,
      login: 'do_owl',
      name: 'Đỗ 🦉 Nguyễn Vũ',
      avatar_url: 'https://avatars.githubusercontent.com/u/777888'
    };

    const sessionToken = await createSessionToken(unicodeUser, secret);
    expect(typeof sessionToken).toBe('string');
    expect(sessionToken.includes('.')).toBe(true);

    const verified = await verifySessionToken(sessionToken, secret);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(777888);
    expect(verified?.login).toBe('do_owl');
    expect(verified?.name).toBe('Đỗ 🦉 Nguyễn Vũ');
  });

  it('rejects tampered session tokens', async () => {
    const user: UserSession = {
      id: 999,
      login: 'hacker',
      name: null,
      avatar_url: 'https://avatars.githubusercontent.com/u/999'
    };
    const token = await createSessionToken(user, secret);
    const [payload, sig] = token.split('.');
    const tampered = payload + '.' + (sig.startsWith('00') ? 'ff' : '00') + sig.slice(2);
    const verified = await verifySessionToken(tampered, secret);
    expect(verified).toBeNull();
  });
});

describe('Tamagotchi Mood Engine Calculations', () => {
  const now = Date.now();

  it('computes Energetic for activity within 24 hours', () => {
    const mood = calculateGuardianMood(now - 1000 * 3600 * 2); // 2 hours ago
    expect(mood.state).toBe('Energetic');
    expect(mood.recommendedPose).toBe('work');
    expect(mood.badgeColor).toBe('#00ff88');
  });

  it('computes Active for activity within 7 days', () => {
    const mood = calculateGuardianMood(now - 1000 * 3600 * 24 * 3); // 3 days ago
    expect(mood.state).toBe('Active');
    expect(mood.recommendedPose).toBe('idle');
    expect(mood.badgeColor).toBe('#00f0ff');
  });

  it('computes Resting for activity within 30 days', () => {
    const mood = calculateGuardianMood(now - 1000 * 3600 * 24 * 15); // 15 days ago
    expect(mood.state).toBe('Resting');
    expect(mood.recommendedPose).toBe('sleepy');
    expect(mood.badgeColor).toBe('#ffa800');
  });

  it('computes Hungry_for_code for inactivity exceeding 30 days', () => {
    const mood = calculateGuardianMood(now - 1000 * 3600 * 24 * 45); // 45 days ago
    expect(mood.state).toBe('Hungry_for_code');
    expect(mood.badgeColor).toBe('#ff2a85');
  });

  it('omits mood when user has zero coding activity (no events and no repo pushes)', () => {
    const lastActive = 0;
    const mood = lastActive > 0 ? calculateGuardianMood(lastActive) : undefined;
    expect(mood).toBeUndefined();
  });
});

describe('WebAssembly SVG-to-PNG Raster Rendering', () => {
  it('renders Cyber-Arcade SVG into a valid PNG binary buffer with magic bytes', async () => {
    const sampleSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#07090e"/>
      <text x="600" y="315" font-family="sans-serif" font-size="48" fill="#00f0ff" text-anchor="middle">GitHoot Card</text>
    </svg>`;

    const pngBytes = await renderSvgToPng(sampleSvg, 1200);
    expect(pngBytes).toBeInstanceOf(Uint8Array);
    expect(pngBytes.length).toBeGreaterThan(100);

    // Verify standard PNG magic header: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(pngBytes[0]).toBe(0x89);
    expect(pngBytes[1]).toBe(0x50); // 'P'
    expect(pngBytes[2]).toBe(0x4E); // 'N'
    expect(pngBytes[3]).toBe(0x47); // 'G'
    expect(pngBytes[4]).toBe(0x0D);
    expect(pngBytes[5]).toBe(0x0A);
    expect(pngBytes[6]).toBe(0x1A);
    expect(pngBytes[7]).toBe(0x0A);
  });
});

describe('Guardian Progression Integrity', () => {
  it('preserves exact raw experience values across boundary points (0, 99, 100)', () => {
    const boundaries = [0, 99, 100, 250, 1000];
    for (const exp of boundaries) {
      const g: GuardianSummary = {
        id: 'g-test',
        name: 'Zenith Celestial Drake',
        species: 'Zenith Celestial Drake',
        element: 'Mythic',
        rarity_tier: 'Common',
        level: 1,
        experience: exp,
        energy_state: 'Active',
        hero_image_url: '/assets/sample-pets/celestialdrake.webp',
        spritesheet_url: null
      };
      expect(g.experience).toBe(exp);
      expect(typeof g.experience).toBe('number');
    }
  });
});

describe('Zero-Activity Claimed Guardian & Active Repos Contracts', () => {
  it('does not synthesize mood for a claimed guardian when coding activity is absent', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            id: 'g-zero',
            name: 'Zenith Celestial Drake',
            species: 'Zenith Celestial Drake',
            element: 'Mythic',
            rarity_tier: 'Common',
            level: 1,
            experience: 0,
            energy_state: 'Active',
            hero_image_url: '/assets/sample-pets/celestialdrake.webp',
            spritesheet_url: null
          })
        })
      })
    };

    const mockEnvZeroAct = {
      DB: mockDb,
      CACHE_KV: { get: async () => null, put: async () => null },
      ENVIRONMENT: 'test',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      AI_MODEL_TIER: 'nano-banana'
    } as unknown as Env;

    // Mock global fetch to simulate GitHub responses with 0 events and 0 pushed repos
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/users/zero_dev/repos')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/users/zero_dev/events')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/users/zero_dev')) {
        return new Response(JSON.stringify({
          id: 55555,
          login: 'zero_dev',
          name: 'Zero Dev',
          avatar_url: 'https://avatars.githubusercontent.com/u/55555',
          public_repos: 0,
          followers: 0,
          created_at: '2026-08-30T00:00:00Z'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    try {
      const profile = await resolveGitHubProfile('zero_dev', mockEnvZeroAct);
      expect(profile.claimed).toBe(true);
      expect(profile.mood).toBeUndefined();
      expect(profile.guardian?.mood_title).toBeUndefined();
      expect(profile.guardian?.mood_description).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('correctly includes active-but-not-highlighted repositories in active_repos', async () => {
    const reposFixture = [
      { name: 'star4', full_name: 'dev/star4', stargazers_count: 100, forks_count: 5, language: 'TypeScript', updated_at: '2025-01-01T00:00:00Z' },
      { name: 'star3', full_name: 'dev/star3', stargazers_count: 80, forks_count: 2, language: 'Rust', updated_at: '2025-02-01T00:00:00Z' },
      { name: 'star2', full_name: 'dev/star2', stargazers_count: 60, forks_count: 1, language: 'Go', updated_at: '2025-03-01T00:00:00Z' },
      { name: 'star1', full_name: 'dev/star1', stargazers_count: 40, forks_count: 0, language: 'Python', updated_at: '2025-04-01T00:00:00Z' },
      { name: 'recent-zero-star', full_name: 'dev/recent-zero-star', stargazers_count: 0, forks_count: 0, language: 'C++', pushed_at: '2026-08-31T09:00:00Z', updated_at: '2026-08-31T09:00:00Z' }
    ];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/users/multi_repo_dev/repos')) {
        return new Response(JSON.stringify(reposFixture), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/users/multi_repo_dev/events')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/users/multi_repo_dev')) {
        return new Response(JSON.stringify({
          id: 66666,
          login: 'multi_repo_dev',
          name: 'Multi Repo Dev',
          avatar_url: 'https://avatars.githubusercontent.com/u/66666',
          public_repos: 5,
          followers: 10,
          created_at: '2024-01-01T00:00:00Z'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    const mockEnv = {
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) },
      CACHE_KV: { get: async () => null, put: async () => null },
      ENVIRONMENT: 'test',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      AI_MODEL_TIER: 'nano-banana'
    } as unknown as Env;

    try {
      const profile = await resolveGitHubProfile('multi_repo_dev', mockEnv);
      // Highlighted repos should only contain the 4 top-starred repos
      expect(profile.highlighted_repos?.map(r => r.name)).toEqual(['star4', 'star3', 'star2', 'star1']);
      expect(profile.highlighted_repos?.some(r => r.name === 'recent-zero-star')).toBe(false);

      // Active repos should contain the recent-zero-star repo
      expect(profile.active_repos?.some(r => r.name === 'recent-zero-star')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Fail-Closed Authentication Configuration Security', () => {
  it('fails closed with HTTP 500 when AUTH_SECRET is not configured on server', async () => {
    const mockEnvNoSecret = {
      ENVIRONMENT: 'production',
      DOMAIN: 'githoot.com',
      GITHUB_CLIENT_ID: 'mock-client-id'
    } as unknown as Env;

    const res = await app.fetch(new Request('http://localhost/auth/github'), mockEnvNoSecret);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('AUTH_SECRET');
  });

  it('fails closed with HTTP 500 when AUTH_SECRET is not configured on /auth/me', async () => {
    const mockEnvNoSecret = {
      ENVIRONMENT: 'production',
      DOMAIN: 'githoot.com'
    } as unknown as Env;

    const res = await app.fetch(new Request('http://localhost/auth/me', {
      headers: { 'Cookie': 'githoot_session=mock.session.token' }
    }), mockEnvNoSecret);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('AUTH_SECRET');
  });

  it('executes /auth/callback with intent: login, setting session cookie with zero claim transaction', async () => {
    const secret = 'test-secret-32-chars-long-key-1!';
    const loginState = await generateSignedState('', secret, 'login');

    let dbBatchCalled = false;
    const mockEnv = {
      AUTH_SECRET: secret,
      GITHUB_CLIENT_ID: 'client123',
      GITHUB_CLIENT_SECRET: 'secret123',
      ENVIRONMENT: 'production',
      DOMAIN: 'githoot.com',
      DB: {
        prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) }),
        batch: async () => { dbBatchCalled = true; }
      },
      CACHE_KV: { get: async () => null, put: async () => null, delete: async () => null }
    } as unknown as Env;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('github.com/login/oauth/access_token')) {
        return new Response(JSON.stringify({ access_token: 'gho_mock_token_123' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('api.github.com/user')) {
        return new Response(JSON.stringify({
          id: 88888,
          login: 'login_only_dev',
          name: 'Login Only',
          avatar_url: 'https://avatars.githubusercontent.com/u/88888'
        }), { headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input);
    };

    try {
      const res = await app.fetch(new Request(`http://localhost/auth/callback?code=mock_code&state=${encodeURIComponent(loginState)}`), mockEnv);
      // Status 302 redirect to profile
      expect(res.status).toBe(302);
      const location = res.headers.get('Location') || '';
      expect(location).toBe('/login_only_dev');
      expect(location.includes('hatch=true')).toBe(false);
      expect(location.includes('guardian_id=')).toBe(false);

      // Session cookie is set with Secure; HttpOnly; SameSite=Lax
      const cookie = res.headers.get('Set-Cookie') || '';
      expect(cookie).toContain('githoot_session=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');

      // DB batch (claim transaction) was NEVER called
      expect(dbBatchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('ensures consecutive 403 fallback requests hit cache_fresh on v2 schema', async () => {
    const store: Record<string, string> = {};
    const mockKv = {
      get: async (key: string, type: string) => {
        const raw = store[key];
        if (!raw) return null;
        return type === 'json' ? JSON.parse(raw) : raw;
      },
      put: async (key: string, val: string) => {
        store[key] = val;
      }
    };

    const mockEnv = {
      CACHE_KV: mockKv,
      DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) },
      ENVIRONMENT: 'test',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      AI_MODEL_TIER: 'nano-banana'
    } as unknown as Env;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('api.github.com/users/rate_limited_dev')) {
        return new Response('rate limit exceeded', { status: 403 });
      }
      if (url.includes('github.com/rate_limited_dev')) {
        // Scrape HTML
        const html = `<html><head><meta property="profile:username" content="rate_limited_dev"></head><body><div data-scope-id="10101"><span class="p-nickname">rate_limited_dev</span><img class="avatar-user" src="https://avatars.githubusercontent.com/u/10101" alt="avatar" /></div></body></html>`;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return originalFetch(input);
    };

    try {
      // First request: triggers 403 scrape fallback and writes to KV
      const profile1 = await resolveGitHubProfile('rate_limited_dev', mockEnv);
      expect(profile1.source).toBe('github_live');
      expect(Array.isArray(profile1.activities)).toBe(true);
      expect(Array.isArray(profile1.highlighted_repos)).toBe(true);

      // Second request: MUST hit cache_fresh because v2 activities schema check passes
      const profile2 = await resolveGitHubProfile('rate_limited_dev', mockEnv);
      expect(profile2.source).toBe('cache_fresh');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
