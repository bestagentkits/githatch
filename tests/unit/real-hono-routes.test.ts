// ============================================================================
// Real Hono Application Route Integration Tests (tests/unit/real-hono-routes.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import serverApp from '../../src/server/index';
import type { Env } from '../../src/server/types';

// Mock minimal in-memory environment bindings
function createMockEnv(guardianOverrides: Record<string, unknown> = {}): Env {
  const mockGuardian = {
    id: 'g-test',
    user_id: 'u-test',
    github_user_id: 11829471,
    name: 'Aether Neonbyte',
    species: 'neonbyte',
    species_name: 'Aether Neonbyte',
    anatomy: 'humanoid cyber-elemental',
    element: 'Cyber',
    dna_seed: 'seed123',
    rarity_tier: 'Epic',
    status: 'PENDING',
    hero_image_url: 'https://cdn.githoot.com/guardians/g-test/landing16-sheet.png',
    spritesheet_url: 'https://cdn.githoot.com/guardians/g-test/landing16-strip.png',
    manifest_url: 'https://cdn.githoot.com/guardians/g-test/manifest.json',
    traits: '{}',
    level: 1,
    experience: 0,
    energy_state: 'Active',
    ...guardianOverrides
  };

  const mockDb = {
    prepare: vi.fn().mockImplementation((query: string) => {
      const statement = {
        bind: vi.fn().mockImplementation(() => statement),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardians')) {
            const isReady = mockGuardian.status === 'ASSET_READY';
            return {
              ...mockGuardian,
              projected_status: mockGuardian.status,
              manifest_key: isReady ? 'manifests/manifest-ready.json' : null,
              spritesheet_key: isReady ? 'masters/strip-ready.png' : null,
              publication_state: isReady ? 'ASSET_READY' : null,
              published_at: isReady ? Date.now() : null
            };
          }
          if (query.includes('FROM early_access_slots')) {
            return { count: 21 };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true })
      };
      return statement;
    }),
    batch: vi.fn().mockResolvedValue([{ success: true }]),
    exec: vi.fn().mockResolvedValue({ success: true })
  } as unknown as D1Database;

  const mockKv = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as KVNamespace;

  const mockBucket = {
    head: vi.fn().mockResolvedValue({ key: 'test', size: 100 }),
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as R2Bucket;

  const mockQueue = {
    send: vi.fn().mockResolvedValue(undefined)
  } as unknown as Queue<any>;

  return {
    DB: mockDb,
    CACHE_KV: mockKv,
    ASSETS_BUCKET: mockBucket,
    AI_QUEUE: mockQueue,
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };
}

describe('Real Hono Application Routes & State Exposure Policy', () => {
  it('/health returns 200 OK with service info', async () => {
    const env = createMockEnv();
    const res = await serverApp.fetch(new Request('http://localhost/health'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('githoot-edge-api');
  });

  it('/api/early-access/status returns live slot calculations', async () => {
    const env = createMockEnv();
    const res = await serverApp.fetch(new Request('http://localhost/api/early-access/status'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; claimed: number; remaining: number };
    expect(body.total).toBe(100);
    expect(body.claimed).toBe(21);
    expect(body.remaining).toBe(79);
  });

  it('Hides asset URLs when guardian status is PENDING (No Asset Leakage)', async () => {
    const env = createMockEnv({ status: 'PENDING' });
    const res = await serverApp.fetch(new Request('http://localhost/api/profile/mrgoonie'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guardian: { status: string; hero_image_url: string | null; spritesheet_url: string | null; manifest_url: string | null } };
    expect(body.guardian).toBeDefined();
    expect(body.guardian.status).toBe('PENDING');
    expect(body.guardian.hero_image_url).toBe('/assets/sample-pets/neonbyte.webp');
    expect(body.guardian.hero_image_url).not.toContain('landing16-sheet.png');
    expect(body.guardian.spritesheet_url).toBeNull();
    expect(body.guardian.manifest_url).toBeNull();
  });

  it('Hides asset URLs when guardian status is VERIFYING', async () => {
    const env = createMockEnv({ status: 'VERIFYING' });
    const res = await serverApp.fetch(new Request('http://localhost/api/profile/mrgoonie'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guardian: { status: string; hero_image_url: string | null; spritesheet_url: string | null } };
    expect(body.guardian.status).toBe('VERIFYING');
    expect(body.guardian.hero_image_url).toBe('/assets/sample-pets/neonbyte.webp');
    expect(body.guardian.hero_image_url).not.toContain('landing16-sheet.png');
    expect(body.guardian.spritesheet_url).toBeNull();
  });

  it('Hides asset URLs when guardian status is QUARANTINED', async () => {
    const env = createMockEnv({ status: 'QUARANTINED' });
    const res = await serverApp.fetch(new Request('http://localhost/api/profile/mrgoonie'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guardian: { status: string; hero_image_url: string | null; spritesheet_url: string | null } };
    expect(body.guardian.status).toBe('QUARANTINED');
    expect(body.guardian.hero_image_url).toBe('/assets/sample-pets/neonbyte.webp');
    expect(body.guardian.hero_image_url).not.toContain('landing16-sheet.png');
    expect(body.guardian.spritesheet_url).toBeNull();
  });

  it('Exposes asset URLs ONLY when guardian status is ASSET_READY', async () => {
    const env = createMockEnv({ status: 'ASSET_READY' });
    const res = await serverApp.fetch(new Request('http://localhost/api/profile/mrgoonie'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { guardian: { status: string; hero_image_url: string | null; spritesheet_url: string | null; manifest_url: string | null } };
    expect(body.guardian.status).toBe('ASSET_READY');
    expect(body.guardian.hero_image_url).toContain('landing16-sheet.png');
    expect(body.guardian.spritesheet_url).toContain('masters/strip-ready.png');
    expect(body.guardian.manifest_url).toContain('manifests/manifest-ready.json');
  });
});
