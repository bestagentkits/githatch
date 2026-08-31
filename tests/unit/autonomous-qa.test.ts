// ============================================================================
// GitHoot Autonomous QA & Verification Suite (tests/unit/autonomous-qa.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import app from '../../src/server/index';
import { deriveGuardianDNA } from '../../src/server/services/dna/seed';
import { removeChromaGreen } from '../../src/server/services/image/chroma-removal';
import { encodeRgbaToPng, decodePngToRgba } from '../../src/server/services/image/png-codec';
import { findCharacterBoundingBox, centerCharacterPose } from '../../src/server/services/image/slicer';
import { calculateGuardianMood } from '../../src/server/services/progression/mood-engine';
import type { Env } from '../../src/server/types';

function createMockEnv(): Env {
  return {
    DB: {
      prepare: (query: string) => ({
        bind: (...args: any[]) => ({
          first: async () => {
            if (query.includes('FROM guardians')) {
              return {
                id: 'g-octocat',
                name: 'octocat',
                species: 'Ignis Emberfox',
                element: 'Fire',
                rarity_tier: 'Common',
                status: 'ASSET_READY',
                hero_image_url: 'https://cdn.githoot.com/hero.png',
                spritesheet_url: 'https://cdn.githoot.com/strip.png',
                level: 1,
                experience: 0,
                energy_state: 'Active'
              };
            }
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true })
        }),
        first: async () => ({ count: 12 }),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true })
      }),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 })
    } as unknown as D1Database,
    CACHE_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], list_complete: true })
    } as unknown as KVNamespace,
    ASSETS_BUCKET: {
      head: async () => null,
      get: async () => null,
      put: async () => null,
      delete: async () => {},
      list: async () => ({ objects: [], truncated: false })
    } as unknown as R2Bucket,
    AI_QUEUE: {
      send: async () => {},
      sendBatch: async () => {}
    } as unknown as Queue<any>,
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };
}

describe('Autonomous QA Suite (Phase 8)', () => {
  const env = createMockEnv();

  it('Tier 1: Healthcheck Endpoint GET /health', async () => {
    const res = await app.fetch(new Request('http://localhost/health'), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { status: string };
    expect(data.status).toBe('ok');
  });

  it('Tier 1: Early Access Status GET /api/early-access/status', async () => {
    const res = await app.fetch(new Request('http://localhost/api/early-access/status'), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { total: number; remaining: number };
    expect(typeof data.remaining).toBe('number');
  });

  it('Tier 1: Dynamic SVG README Badge GET /badge/octocat.svg', async () => {
    const res = await app.fetch(new Request('http://localhost/badge/octocat.svg'), env);
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('image/svg+xml');
    const svgText = await res.text();
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('GitHoot');
  });

  it('Tier 1: Dynamic OpenGraph Card GET /og/octocat', async () => {
    const res = await app.fetch(new Request('http://localhost/og/octocat'), env);
    expect(res.status).toBe(200);
    const svgText = await res.text();
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('GitHoot.com');
  });

  it('Tier 2: Deterministic DNA Hash Consistency', async () => {
    const dna1 = await deriveGuardianDNA(12345, 'testuser');
    const dna2 = await deriveGuardianDNA(12345, 'testuser');
    expect(dna1.dna_seed).toBe(dna2.dna_seed);
    expect(dna1.species).toBe(dna2.species);
  });

  it('Tier 2: GitHub Profile Resolution GET /api/profile/octocat', async () => {
    const res = await app.fetch(new Request('http://localhost/api/profile/octocat'), env);
    expect(res.status).toBe(200);
    const data = await res.json() as { guardian: { species: string; element: string } };
    expect(data.guardian).toBeDefined();
    expect(data.guardian.species).toBeDefined();
  });
  it('Tier 3: Chroma Green Removal & Edge De-Spill', () => {
    const testRgba = new Uint8Array(4 * 4 * 4);
    // Pixel 0: pure green chroma #00FF00
    testRgba[0] = 0; testRgba[1] = 255; testRgba[2] = 0; testRgba[3] = 255;
    // Pixel 1: neon cyan character pixel
    testRgba[4] = 0; testRgba[5] = 240; testRgba[6] = 255; testRgba[7] = 255;

    const cleaned = removeChromaGreen(testRgba, 4, 4);
    expect(cleaned[3]).toBe(0);
    expect(cleaned[7]).not.toBe(0);
  });

  it('Tier 3: Pure TS PNG Encode/Decode Roundtrip', async () => {
    const origRgba = new Uint8Array(16 * 16 * 4);
    for (let i = 0; i < origRgba.length; i += 4) {
      origRgba[i] = 100; origRgba[i + 1] = 150; origRgba[i + 2] = 200; origRgba[i + 3] = 255;
    }
    const pngBytes = encodeRgbaToPng(origRgba, 16, 16);
    const decoded = await decodePngToRgba(pngBytes);
    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(16);
  });

  it('Tier 3: Smart Bounding Box Detection & Centering', () => {
    const canvasW = 64;
    const canvasH = 64;
    const testRgba = new Uint8Array(canvasW * canvasH * 4);

    // Place 10x10 character at offset x=20, y=20
    for (let y = 20; y < 30; y++) {
      for (let x = 20; x < 30; x++) {
        const idx = (y * canvasW + x) * 4;
        testRgba[idx] = 255; testRgba[idx + 1] = 255; testRgba[idx + 2] = 255; testRgba[idx + 3] = 255;
      }
    }

    const bbox = findCharacterBoundingBox(testRgba, canvasW, canvasH);
    expect(bbox.minX).toBe(20);
    expect(bbox.minY).toBe(20);
    expect(bbox.width).toBe(10);
    expect(bbox.height).toBe(10);

    const centered = centerCharacterPose(testRgba, canvasW, canvasH, 256, 256);
    const centeredBbox = findCharacterBoundingBox(centered, 256, 256);

    const expectedOffsetX = Math.floor((256 - 10) / 2);
    const expectedOffsetY = Math.floor((256 - 10) / 2);

    expect(centeredBbox.minX).toBe(expectedOffsetX);
    expect(centeredBbox.minY).toBe(expectedOffsetY);
  });

  it('Tier 4: Calculate 4 Activity Mood States', () => {
    const now = Date.now();
    const energetic = calculateGuardianMood(now - 2 * 3600 * 1000); // 2h ago
    const active = calculateGuardianMood(now - 3 * 86400 * 1000); // 3d ago
    const resting = calculateGuardianMood(now - 15 * 86400 * 1000); // 15d ago
    const hungry = calculateGuardianMood(now - 45 * 86400 * 1000); // 45d ago

    expect(energetic.state).toBe('Energetic');
    expect(active.state).toBe('Active');
    expect(resting.state).toBe('Resting');
    expect(hungry.state).toBe('Hungry_for_code');
  });
});
