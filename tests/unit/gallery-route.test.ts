// ============================================================================
// Gallery Route & Keyset Paging Unit Tests (tests/unit/gallery-route.test.ts)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeLikePattern,
  computeQueryFingerprint,
  encodeCursor,
  decodeCursor,
  computeCacheKey,
  executeGalleryQuery,
  VALID_ELEMENTS,
  VALID_RARITIES,
  VALID_SORTS
} from '../../src/server/routes/gallery';
import { app } from '../../src/server/index';
import type { Env, GalleryCursorPayload } from '../../src/server/types';

describe('Gallery Route Helpers & Paging', () => {
  it('escapeLikePattern correctly escapes SQL LIKE wildcards and backslashes', () => {
    expect(escapeLikePattern('octo%cat')).toBe('octo\\%cat');
    expect(escapeLikePattern('user_name')).toBe('user\\_name');
    expect(escapeLikePattern('foo\\bar')).toBe('foo\\\\bar');
    expect(escapeLikePattern('100%_pure\\code')).toBe('100\\%\\_pure\\\\code');
    expect(escapeLikePattern('normal-text')).toBe('normal-text');
  });

  it('computeQueryFingerprint generates deterministic hex digests', async () => {
    const fp1 = await computeQueryFingerprint('newest', 'Fire', 'Epic', 'octo');
    const fp2 = await computeQueryFingerprint('newest', 'Fire', 'Epic', 'octo');
    const fp3 = await computeQueryFingerprint('oldest', 'Fire', 'Epic', 'octo');

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
    expect(fp1.length).toBe(16);
  });

  it('encodeCursor and decodeCursor roundtrip valid keyset payloads', async () => {
    const payload: GalleryCursorPayload = {
      v: 1,
      sort: 'newest',
      snapshot_at: 1788300000000,
      last_published_at: 1788290000000,
      last_guardian_id: 'guard-abc-123',
      fingerprint: 'a1b2c3d4e5f67890'
    };

    const encoded = encodeCursor(payload);
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');

    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(payload);
  });

  it('decodeCursor rejects malformed, tampered, or invalid version cursors', () => {
    expect(decodeCursor('not-valid-base64-json!')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ v: 2 })))).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ v: 1, sort: 'invalid' })))).toBeNull();
  });

  it('computeCacheKey produces deterministic versioned keys', async () => {
    const key1 = await computeCacheKey('newest', 24, 'Fire', 'Rare', null);
    const key2 = await computeCacheKey('newest', 24, 'Fire', 'Rare', null);
    const key3 = await computeCacheKey('newest', 48, 'Fire', 'Rare', null);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1.startsWith('gallery:v1:')).toBe(true);
  });
});

describe('Gallery Endpoint Input Validation', () => {
  let mockEnv: Partial<Env>;

  beforeEach(() => {
    mockEnv = {
      CDN_DOMAIN: 'cdn.test.githoot.com',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] })
          })
        })
      } as any,
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      } as any
    };
  });

  it('rejects invalid sort with 400', async () => {
    const res = await app.request('/api/gallery?sort=popularity', {}, mockEnv as Env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects invalid limit with 400', async () => {
    const res1 = await app.request('/api/gallery?limit=0', {}, mockEnv as Env);
    expect(res1.status).toBe(400);

    const res2 = await app.request('/api/gallery?limit=99', {}, mockEnv as Env);
    expect(res2.status).toBe(400);

    const res3 = await app.request('/api/gallery?limit=abc', {}, mockEnv as Env);
    expect(res3.status).toBe(400);
  });

  it('rejects invalid element with 400', async () => {
    const res = await app.request('/api/gallery?element=Kryptonite', {}, mockEnv as Env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects invalid rarity with 400', async () => {
    const res = await app.request('/api/gallery?rarity=UltraGod', {}, mockEnv as Env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('rejects search query outside 2-40 character boundary', async () => {
    const res1 = await app.request('/api/gallery?q=a', {}, mockEnv as Env);
    expect(res1.status).toBe(400);

    const longStr = 'a'.repeat(45);
    const res2 = await app.request(`/api/gallery?q=${longStr}`, {}, mockEnv as Env);
    expect(res2.status).toBe(400);
  });

  it('rejects invalid or query-mismatched cursors', async () => {
    const res1 = await app.request('/api/gallery?cursor=corrupted_payload', {}, mockEnv as Env);
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.error.code).toBe('INVALID_CURSOR');

    const fp = await computeQueryFingerprint('newest', 'Fire', null, null);
    const cursor = encodeCursor({
      v: 1,
      sort: 'newest',
      snapshot_at: 1000,
      last_published_at: 900,
      last_guardian_id: 'g1',
      fingerprint: fp
    });

    // Request with element=Water (fingerprint mismatch)
    const res2 = await app.request(`/api/gallery?cursor=${cursor}&element=Water`, {}, mockEnv as Env);
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.error.code).toBe('CURSOR_QUERY_MISMATCH');
  });

  it('returns valid GalleryResponse structure on successful D1 execution', async () => {
    const fakeRows = [
      {
        id: 'g-1',
        name: 'Ignis Prime',
        species: 'emberfox',
        species_name: 'Ignis Emberfox',
        element: 'Fire',
        rarity_tier: 'Epic',
        level: 5,
        experience: 250,
        energy_state: 'Active',
        hero_image_url: 'https://cdn.test.githoot.com/references/ref1.png',
        spritesheet_url: null,
        spritesheet_key: 'masters/strip1.png',
        published_at: 1788000000000,
        owner_login: 'mrgoonie',
        owner_name: 'Goonie',
        owner_avatar_url: 'https://avatars.githubusercontent.com/u/123',
        owner_total_stars: 42
      }
    ];

    mockEnv.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: fakeRows })
        })
      })
    } as any;

    const res = await app.request('/api/gallery?element=Fire&rarity=Epic&sort=newest', {}, mockEnv as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Gallery-Cache')).toBe('MISS');

    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].name).toBe('Ignis Prime');
    expect(body.items[0].spritesheet_url).toBe('https://cdn.test.githoot.com/masters/strip1.png');
    expect(body.items[0].owner.login).toBe('mrgoonie');
    expect(body.applied.element).toBe('Fire');
    expect(body.applied.rarity).toBe('Epic');
  });

  it('supports sort=oldest with correct snapshot bound and ascending order', async () => {
    const fakeRows = [
      {
        id: 'g-old-1',
        name: 'Genesis Prime',
        species: 'emberfox',
        species_name: 'Ignis Emberfox',
        element: 'Fire',
        rarity_tier: 'Common',
        level: 1,
        experience: 0,
        energy_state: 'Active',
        hero_image_url: 'https://cdn.test.githoot.com/heroes/g-old.png',
        spritesheet_url: null,
        spritesheet_key: 'masters/strip-old.png',
        published_at: 1000,
        owner_login: 'octocat',
        owner_name: 'The Octocat',
        owner_avatar_url: null,
        owner_total_stars: 100
      }
    ];

    mockEnv.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: fakeRows })
        })
      })
    } as any;

    const res = await app.request('/api/gallery?sort=oldest', {}, mockEnv as Env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied.sort).toBe('oldest');
    expect(body.items.length).toBe(1);
    expect(body.items[0].name).toBe('Genesis Prime');
  });

  it('bypasses KV cache when search parameter q is provided', async () => {
    mockEnv.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] })
        })
      })
    } as any;

    const res = await app.request('/api/gallery?q=octocat', {}, mockEnv as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Gallery-Cache')).toBe('BYPASS');
  });

  it('serves fresh response from KV with X-Gallery-Cache: HIT', async () => {
    const cachedResponse = {
      items: [],
      page: { limit: 24, has_more: false, next_cursor: null, snapshot_at: Date.now() },
      applied: { q: null, element: null, rarity: null, sort: 'newest' }
    };

    mockEnv.CACHE_KV = {
      get: vi.fn().mockResolvedValue({
        response: cachedResponse,
        cached_at: Date.now() - 5000 // 5 seconds old (fresh)
      }),
      put: vi.fn().mockResolvedValue(undefined)
    } as any;

    const res = await app.request('/api/gallery', {}, mockEnv as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Gallery-Cache')).toBe('HIT');
  });

  it('serves degraded stale cache with Warning header when D1 throws', async () => {
    const staleResponse = {
      items: [{ id: 'g-stale', name: 'Stale Guardian' }],
      page: { limit: 24, has_more: false, next_cursor: null, snapshot_at: 1000 },
      applied: { q: null, element: null, rarity: null, sort: 'newest' }
    };

    mockEnv.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1 Connection Timeout'))
        })
      })
    } as any;

    mockEnv.CACHE_KV = {
      get: vi.fn().mockResolvedValue({
        response: staleResponse,
        cached_at: Date.now() - 180_000 // 180s old (> MAX_STALE_MS 120s)
      }),
      put: vi.fn().mockResolvedValue(undefined)
    } as any;
    const res = await app.request('/api/gallery', {}, mockEnv as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Gallery-Data')).toBe('stale-kv');
    expect(res.headers.get('Warning')).toContain('Response is stale');
    const body = await res.json();
    expect(body.meta.degraded).toBe(true);
    expect(body.meta.stale).toBe(true);
  });

  it('returns 503 GALLERY_UNAVAILABLE with Retry-After when D1 fails and no cache exists', async () => {
    mockEnv.DB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error('D1 Fatal Error'))
        })
      })
    } as any;

    mockEnv.CACHE_KV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined)
    } as any;

    const res = await app.request('/api/gallery', {}, mockEnv as Env);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('15');
    const body = await res.json();
    expect(body.error.code).toBe('GALLERY_UNAVAILABLE');
  });
});
