// ============================================================================
// GitHoot Unit Tests: SWR Resolver, Token Pool & Quota
// (tests/unit/resolver-and-quota.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateDegradedProfile } from '../../src/server/services/github/resolver';
import { parseTokenPool, recordTokenResponse } from '../../src/server/services/github/token-pool';
import { calculateGuardianMood } from '../../src/server/services/progression/mood-engine';
import type { Env, PublicConfig, EarlyAccessStatus } from '../../src/server/types';
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
});
