// ============================================================================
// Hatch Admin Approval & Publication Transition Tests (tests/unit/hatch-admin-publish.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { approveGuardianPosesAndPublish } from '../../src/server/services/ai/hatch-admin';
import { compileIdentitySpec } from '../../src/server/services/dna/compiler';
import { POSE_SET, VERSIONS } from '../../src/server/services/dna/contracts';
import { encodeRgbaToPng } from '../../src/server/services/image/png-codec';
import { encodeRgbaToWebp } from '../../src/server/services/image/webp-encoder';
import { sha256Hex } from '../../src/server/services/crypto/web-crypto';
import type { Env } from '../../src/server/types';

async function createMockHatchEnv(options: {
  framesCount?: number;
  duplicatePoseIndex?: boolean;
  preflightReady?: boolean;
  verdictsPresent?: boolean;
  guardianStatus?: string;
  jobState?: string;
} = {}): Promise<Env> {
  const framesCount = options.framesCount ?? 16;
  const duplicatePoseIndex = options.duplicatePoseIndex ?? false;
  const preflightReady = options.preflightReady ?? true;
  const verdictsPresent = options.verdictsPresent ?? true;
  const guardianStatus = options.guardianStatus ?? 'VERIFYING';
  const jobState = options.jobState ?? 'VERIFYING';

  const spec = await compileIdentitySpec({
    githubUserId: 11829471,
    telemetry: {
      topLanguages: ['typescript'],
      provenance: { topLanguages: 'measured' }
    }
  });

  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0; rgba[i+1] = 255; rgba[i+2] = 0; rgba[i+3] = 255;
  }
  for (let y = 64; y < 192; y++) {
    for (let x = 64; x < 192; x++) {
      const idx = (y * 256 + x) * 4;
      rgba[idx] = 255; rgba[idx+1] = 128; rgba[idx+2] = 0; rgba[idx+3] = 255;
    }
  }
  const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');
  const samplePng = encodeRgbaToPng(rgba, 256, 256);
  const gateRes = await validateAndNormalizeFrame(samplePng);
  if (!gateRes.ok) throw new Error('Fixture gate failed');

  const refSha = gateRes.frameSha256;
  const frameSha = gateRes.frameSha256;
  const rawSha = gateRes.rawSha256;

  const mockFrames = Array.from({ length: framesCount }, (_, i) => {
    const p = POSE_SET[i % POSE_SET.length]!;
    return {
      id: `f-${i + 1}`,
      job_id: 'job-123',
      pose_id: p.id,
      pose_index: duplicatePoseIndex && i === 1 ? 0 : i,
      frame_sha256: frameSha,
      raw_sha256: rawSha,
      state: 'ACCEPTED',
      raw_gate_metrics: JSON.stringify({ ...gateRes.metrics, attempt: 1 }),
      semantic_verdict: verdictsPresent ? JSON.stringify({
        verdict: 'pass',
        reviewer: 'lead-auditor',
        boundToSha256: frameSha,
        timestamp: Date.now()
      }) : null,
      created_at: Date.now()
    };
  });
  const framesData = mockFrames.map(f => ({
    poseId: f.pose_id,
    poseIndex: f.pose_index,
    frameSha256: f.frame_sha256,
    rawSha256: f.raw_sha256
  }));

  const r2Storage = new Map<string, Uint8Array>();

  const sheetPngKey = `masters/${frameSha}.png`;
  const sheetWebpKey = `masters/${frameSha}.webp`;
  const stripPngKey = `masters/${frameSha}.png`;
  const stripWebpKey = `masters/${frameSha}.webp`;

  if (preflightReady) {
    r2Storage.set(`references/${refSha}.png`, gateRes.normalizedPng);
    r2Storage.set(sheetPngKey, gateRes.normalizedPng);
    r2Storage.set(sheetWebpKey, gateRes.normalizedPng);
    r2Storage.set(stripPngKey, gateRes.normalizedPng);
    r2Storage.set(stripWebpKey, gateRes.normalizedPng);

    for (const f of mockFrames) {
      r2Storage.set(`guardians/g-test-1/raw/${f.raw_sha256}.png`, samplePng);
      r2Storage.set(`guardians/g-test-1/frames/f${f.pose_id}_${f.frame_sha256}.png`, gateRes.normalizedPng);
    }
  }

  const manifestData = {
    v: 1,
    guardianId: 'g-test-1',
    versions: VERSIONS,
    identityHash: spec.identityHash,
    identity: spec,
    modelId: 'nano-banana-pro-preview',
    referenceSha256: refSha,
    state: 'VERIFYING',
    frames: framesData,
    artifacts: {
      sheetPng: { url: `https://cdn.githoot.com/${sheetPngKey}`, key: sheetPngKey, sha256: frameSha },
      sheetWebp: { url: `https://cdn.githoot.com/${sheetWebpKey}`, key: sheetWebpKey, sha256: frameSha },
      stripPng: { url: `https://cdn.githoot.com/${stripPngKey}`, key: stripPngKey, sha256: frameSha },
      stripWebp: { url: `https://cdn.githoot.com/${stripWebpKey}`, key: stripWebpKey, sha256: frameSha }
    }
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));
  r2Storage.set('guardians/g-test-1/manifest.json', manifestBytes);

  const mockDb = {
    prepare: vi.fn().mockImplementation((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: vi.fn().mockImplementation((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardians')) {
            return { id: 'g-test-1', name: 'mrgoonie', status: guardianStatus, reference_sha256: refSha, identity_spec: JSON.stringify(spec), dna_seed: spec.dnaSeed };
          }
          if (query.includes('FROM guardian_hatch_jobs')) {
            return { id: 'job-123', guardian_id: 'g-test-1', state: jobState, model_id: 'nano-banana-pro-preview', manifest_url: 'guardians/g-test-1/manifest.json' };
          }
          if (query.includes('FROM guardian_reference_candidates')) {
            return { state: 'APPROVED', candidate_sha256: refSha };
          }
          if (query.includes('FROM guardian_publication')) {
            return null;
          }
          return null;
        }),
        all: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_frames')) {
            return { results: mockFrames };
          }
          return { results: [] };
        }),
        run: vi.fn().mockImplementation(async () => {
          if (query.includes('UPDATE guardian_hatch_frames SET semantic_verdict')) {
            const [verdictData, frameId] = boundArgs;
            const target = mockFrames.find(f => f.id === frameId);
            if (target) target.semantic_verdict = verdictData;
          }
          return { success: true, meta: { changes: 1 } };
        })
      };
      return stmt;
    }),
    batch: vi.fn().mockImplementation(async (statements: any[]) => {
      for (const s of statements) {
        await s.run();
      }
      return [{ success: true, meta: { changes: 1 } }];
    }),
    exec: vi.fn().mockResolvedValue({ success: true })
  } as unknown as D1Database;

  const mockBucket = {
    head: vi.fn().mockImplementation(async (key: string) => {
      const found = r2Storage.get(key);
      if (!found) return null;
      return { key, size: found.length };
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      const found = r2Storage.get(key);
      if (!found) return null;
      return {
        arrayBuffer: async () => found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength),
        json: async () => JSON.parse(new TextDecoder().decode(found)),
        text: async () => new TextDecoder().decode(found)
      };
    }),
    put: vi.fn().mockImplementation(async (key: string, data: any) => {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
      r2Storage.set(key, bytes);
      return null;
    }),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as R2Bucket;

  const mockKv = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as KVNamespace;

  return {
    DB: mockDb,
    ASSETS_BUCKET: mockBucket,
    CACHE_KV: mockKv,
    AI_QUEUE: {} as any,
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };
}
describe('Hatch Admin Approval & Publication Transition', () => {
  it('successfully transitions to ASSET_READY when all 16 frames and preflight pass', async () => {
    const env = await createMockHatchEnv({ framesCount: 16, preflightReady: true });
    const result = await approveGuardianPosesAndPublish({
      guardianId: 'g-test-1',
      reviewer: 'lead-auditor',
      verdict: 'pass',
      env
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('ASSET_READY');
    expect(result.manifestUrl).toContain('manifests/');
  });

  it('rejects approval if frame count is less than 16', async () => {
    const env = await createMockHatchEnv({ framesCount: 14 });
    await expect(
      approveGuardianPosesAndPublish({
        guardianId: 'g-test-1',
        reviewer: 'lead-auditor',
        verdict: 'pass',
        env
      })
    ).rejects.toThrow(/incomplete pose set/i);
  });

  it('rejects approval if duplicate pose indices exist in frame set', async () => {
    const env = await createMockHatchEnv({ framesCount: 16, duplicatePoseIndex: true });
    await expect(
      approveGuardianPosesAndPublish({
        guardianId: 'g-test-1',
        reviewer: 'lead-auditor',
        verdict: 'pass',
        env
      })
    ).rejects.toThrow(/duplicate or missing pose indices/i);
  });

  it('rejects approval when guardian status and job state are mismatched', async () => {
    const env = await createMockHatchEnv({ guardianStatus: 'PENDING', jobState: 'VERIFYING' });
    await expect(
      approveGuardianPosesAndPublish({
        guardianId: 'g-test-1',
        reviewer: 'lead-auditor',
        verdict: 'pass',
        env
      })
    ).rejects.toThrow(/cannot approve mismatched state/i);
  });

  it('rejects approval when reviewer string is empty', async () => {
    const env = await createMockHatchEnv({ framesCount: 16 });
    await expect(
      approveGuardianPosesAndPublish({
        guardianId: 'g-test-1',
        reviewer: '   ',
        verdict: 'pass',
        env
      })
    ).rejects.toThrow(/non-empty reviewer identity/i);
  });

  it('quarantines job if publication preflight fails during approval', async () => {
    const env = await createMockHatchEnv({ framesCount: 16, preflightReady: false });
    const result = await approveGuardianPosesAndPublish({
      guardianId: 'g-test-1',
      reviewer: 'lead-auditor',
      verdict: 'pass',
      env
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('QUARANTINED');
    expect(result.reasons?.length).toBeGreaterThan(0);
  });

  it('regression: calling approveGuardianPosesAndPublish directly with null verdicts fails closed and does not auto-stamp', async () => {
    const env = await createMockHatchEnv({ framesCount: 16, verdictsPresent: false });
    const result = await approveGuardianPosesAndPublish({
      guardianId: 'g-test-1',
      reviewer: 'attacker-trying-to-autostamp',
      verdict: 'pass',
      env
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('QUARANTINED');
    expect(result.reasons?.some(r => r.includes('missing semantic review verdict'))).toBe(true);
  });
});
