// ============================================================================
// GitHoot Publication Integrity & Single-Pointer CAS Tests (tests/unit/publication-integrity.test.ts)
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPublicationReady } from '../../src/server/services/claim/publication-preflight';
import { approveGuardianPosesAndPublish } from '../../src/server/services/ai/hatch-admin';
import { encodeRgbaToPng } from '../../src/server/services/image/png-codec';
import { encodeRgbaToWebp } from '../../src/server/services/image/webp-encoder';
import { sha256Hex } from '../../src/server/services/crypto/web-crypto';
import { compileIdentitySpec } from '../../src/server/services/dna/compiler';
import { POSE_SET, VERSIONS } from '../../src/server/services/dna/contracts';
import { validateAndNormalizeFrame } from '../../src/server/services/image/frame-gate';
import type { Env, IdentitySpec } from '../../src/server/types';

function createSampleNonBlankCharacterPng(): { pngBytes: Uint8Array; b64: string } {
  const width = 256;
  const height = 256;
  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0;     // R
    rgba[i + 1] = 255; // G (chroma)
    rgba[i + 2] = 0;   // B
    rgba[i + 3] = 255; // A
  }

  for (let y = 64; y < 192; y++) {
    for (let x = 64; x < 192; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 255;   // R
      rgba[idx + 1] = 128; // G
      rgba[idx + 2] = 0;   // B
      rgba[idx + 3] = 255; // A
    }
  }

  const pngBytes = encodeRgbaToPng(rgba, width, height);
  const b64 = Buffer.from(pngBytes).toString('base64');
  return { pngBytes, b64 };
}

async function createPublicationFixtureEnv() {
  const r2Storage = new Map<string, Uint8Array>();
  const d1Tables = {
    guardians: new Map<string, any>(),
    guardian_reference_candidates: new Map<string, any>(),
    guardian_hatch_jobs: new Map<string, any>(),
    guardian_hatch_frames: new Map<string, any>(),
    guardian_publication: new Map<string, any>()
  };

  const spec = await compileIdentitySpec({
    githubUserId: 11829471,
    telemetry: {
      topLanguages: ['typescript'],
      provenance: { topLanguages: 'measured' }
    }
  });

  const { pngBytes: samplePng } = createSampleNonBlankCharacterPng();
  const gateRes = await validateAndNormalizeFrame(samplePng);
  if (!gateRes.ok) throw new Error('Fixture gate failed');

  const refSha = gateRes.frameSha256;
  r2Storage.set(`references/${refSha}.png`, gateRes.normalizedPng);

  d1Tables.guardians.set('g-pub-1', {
    id: 'g-pub-1',
    user_id: 'u-1',
    github_user_id: 11829471,
    name: 'mrgoonie',
    species: spec.species,
    element: spec.element,
    rarity_tier: spec.rarity,
    dna_seed: spec.dnaSeed,
    status: 'VERIFYING',
    reference_sha256: refSha,
    spritesheet_url: null,
    manifest_url: null,
    identity_spec: JSON.stringify(spec)
  });

  d1Tables.guardian_reference_candidates.set('cand-1', {
    id: 'cand-1',
    guardian_id: 'g-pub-1',
    candidate_sha256: refSha,
    identity_hash: spec.identityHash,
    prompt_hash: 'prompt-hash',
    model_id: 'nano-banana-pro-preview',
    raw_sha256: gateRes.rawSha256,
    state: 'APPROVED',
    reviewer: 'art-lead@githoot.com',
    created_at: Date.now()
  });

  d1Tables.guardian_hatch_jobs.set('job-pub-1', {
    id: 'job-pub-1',
    guardian_id: 'g-pub-1',
    request_fingerprint: 'fp-pub',
    state: 'VERIFYING',
    model_id: 'nano-banana-pro-preview',
    attempts_count: 1,
    frames_completed: 16,
    manifest_url: null,
    created_at: Date.now(),
    updated_at: Date.now()
  });

  // Pre-populate 16 frames
  const framesData = [];
  for (let i = 0; i < 16; i++) {
    const p = POSE_SET[i]!;
    d1Tables.guardian_hatch_frames.set(`g-pub-1-${p.id}`, {
      id: `frame-${p.id}`,
      job_id: 'job-pub-1',
      pose_id: p.id,
      pose_index: i,
      raw_sha256: gateRes.rawSha256,
      frame_sha256: gateRes.frameSha256,
      raw_gate_metrics: JSON.stringify({ ...gateRes.metrics, attempt: 1 }),
      semantic_verdict: JSON.stringify({
        verdict: 'pass',
        reviewer: 'lead-art-director@githoot.com',
        boundToSha256: gateRes.frameSha256,
        timestamp: Date.now()
      }),
      state: 'ACCEPTED'
    });

    r2Storage.set(`guardians/g-pub-1/raw/${gateRes.rawSha256}.png`, samplePng);
    r2Storage.set(`guardians/g-pub-1/frames/f${p.id}_${gateRes.frameSha256}.png`, gateRes.normalizedPng);

    framesData.push({
      poseId: p.id,
      poseIndex: i,
      frameSha256: gateRes.frameSha256,
      rawSha256: gateRes.rawSha256
    });
  }

  // Pre-populate 4 master artifacts
  const dummySheetRgba = new Uint8Array(1024 * 1024 * 4);
  const sheetPngBytes = encodeRgbaToPng(dummySheetRgba, 1024, 1024);
  const sheetWebpBytes = await encodeRgbaToWebp(dummySheetRgba, 1024, 1024);
  const stripPngBytes = encodeRgbaToPng(dummySheetRgba, 4096, 256);
  const stripWebpBytes = await encodeRgbaToWebp(dummySheetRgba, 4096, 256);

  const sheetPngSha = await sha256Hex(sheetPngBytes);
  const sheetWebpSha = await sha256Hex(sheetWebpBytes);
  const stripPngSha = await sha256Hex(stripPngBytes);
  const stripWebpSha = await sha256Hex(stripWebpBytes);

  const sheetPngKey = `masters/${sheetPngSha}.png`;
  const sheetWebpKey = `masters/${sheetWebpSha}.webp`;
  const stripPngKey = `masters/${stripPngSha}.png`;
  const stripWebpKey = `masters/${stripWebpSha}.webp`;

  r2Storage.set(sheetPngKey, sheetPngBytes);
  r2Storage.set(sheetWebpKey, sheetWebpBytes);
  r2Storage.set(stripPngKey, stripPngBytes);
  r2Storage.set(stripWebpKey, stripWebpBytes);

  const manifestData = {
    v: 1,
    guardianId: 'g-pub-1',
    versions: VERSIONS,
    identityHash: spec.identityHash,
    identity: spec,
    modelId: 'nano-banana-pro-preview',
    referenceSha256: refSha,
    state: 'ASSET_READY',
    frames: framesData,
    artifacts: {
      sheetPng: { url: `https://cdn.githoot.com/${sheetPngKey}`, key: sheetPngKey, sha256: sheetPngSha },
      sheetWebp: { url: `https://cdn.githoot.com/${sheetWebpKey}`, key: sheetWebpKey, sha256: sheetWebpSha },
      stripPng: { url: `https://cdn.githoot.com/${stripPngKey}`, key: stripPngKey, sha256: stripPngSha },
      stripWebp: { url: `https://cdn.githoot.com/${stripWebpKey}`, key: stripWebpKey, sha256: stripWebpSha }
    }
  };

  const manifestJsonBytes = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));
  const manifestSha = await sha256Hex(manifestJsonBytes);
  const manifestKey = `manifests/${manifestSha}.json`;
  r2Storage.set(manifestKey, manifestJsonBytes);

  d1Tables.guardian_hatch_jobs.get('job-pub-1').manifest_url = `https://cdn.githoot.com/${manifestKey}`;

  const mockDb = {
    prepare: vi.fn().mockImplementation((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: vi.fn().mockImplementation((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardians g') && query.includes('LEFT JOIN guardian_publication p')) {
            const ghId = boundArgs[0];
            const g = Array.from(d1Tables.guardians.values()).find(x => x.github_user_id === ghId);
            if (!g) return null;
            const pub = d1Tables.guardian_publication.get(g.id);
            return {
              id: g.id,
              name: g.name,
              species: g.species,
              species_name: g.species_name || g.name,
              anatomy: g.anatomy,
              element: g.element,
              rarity_tier: g.rarity_tier,
              projected_status: g.status,
              level: g.level || 1,
              experience: g.experience || 0,
              energy_state: g.energy_state || 'Active',
              hero_image_url: g.hero_image_url,
              manifest_key: pub && pub.state === 'ASSET_READY' ? pub.manifest_key : null,
              spritesheet_key: pub && pub.state === 'ASSET_READY' ? pub.spritesheet_key : null,
              publication_state: pub && pub.state === 'ASSET_READY' ? pub.state : null,
              published_at: pub && pub.state === 'ASSET_READY' ? pub.published_at : null
            };
          }
          if (query.includes('FROM guardians WHERE id = ?1')) {
            return d1Tables.guardians.get(boundArgs[0]) || null;
          }
          if (query.includes('FROM guardian_hatch_jobs WHERE guardian_id = ?1')) {
            return d1Tables.guardian_hatch_jobs.get('job-pub-1') || null;
          }
          if (query.includes('FROM guardian_reference_candidates')) {
            return d1Tables.guardian_reference_candidates.get('cand-1') || null;
          }
          if (query.includes('FROM guardian_publication WHERE guardian_id = ?1')) {
            return d1Tables.guardian_publication.get(boundArgs[0]) || null;
          }
          return null;
        }),
        all: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_frames')) {
            return { results: Array.from(d1Tables.guardian_hatch_frames.values()) };
          }
          return { results: [] };
        }),
        run: vi.fn().mockImplementation(async () => {
          if (query.includes('INSERT INTO guardian_publication')) {
            const [gId, jId, mSha, mKey, sSha, sKey, rev, pubAt] = boundArgs;
            if (d1Tables.guardian_publication.has(gId)) {
              throw new Error('UNIQUE constraint failed: guardian_publication.guardian_id');
            }
            d1Tables.guardian_publication.set(gId, {
              guardian_id: gId,
              job_id: jId,
              manifest_sha256: mSha,
              manifest_key: mKey,
              spritesheet_sha256: sSha,
              spritesheet_key: sKey,
              state: 'ASSET_READY',
              reviewer: rev,
              published_at: pubAt,
              created_at: pubAt
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_frames SET semantic_verdict')) {
            const [verdictData, frameId] = boundArgs;
            const target = Array.from(d1Tables.guardian_hatch_frames.values()).find(f => f.id === frameId);
            if (target) target.semantic_verdict = verdictData;
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardians') && query.includes('SET status = \'ASSET_READY\'')) {
            const g = d1Tables.guardians.get('g-pub-1');
            if (g) {
              g.status = 'ASSET_READY';
              g.spritesheet_url = boundArgs[0];
              g.manifest_url = boundArgs[1];
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_jobs') && query.includes('SET state = \'ASSET_READY\'')) {
            const job = d1Tables.guardian_hatch_jobs.get('job-pub-1');
            if (job) {
              job.state = 'ASSET_READY';
              job.manifest_url = boundArgs[0];
            }
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 1 } };
        })
      };
      return stmt;
    }),
    batch: vi.fn().mockImplementation(async (stmts: any[]) => {
      for (const s of stmts) {
        await s.run();
      }
      return [{ success: true, meta: { changes: 1 } }];
    })
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
        json: async () => JSON.parse(new TextDecoder().decode(found))
      };
    }),
    put: vi.fn().mockImplementation(async (key: string, data: any) => {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
      r2Storage.set(key, bytes);
      return null;
    })
  } as unknown as R2Bucket;

  const env: Env = {
    DB: mockDb,
    ASSETS_BUCKET: mockBucket,
    CACHE_KV: {} as any,
    AI_QUEUE: {} as any,
    GEMINI_API_KEY: 'test-key',
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };

  return { env, r2Storage, d1Tables, manifestSha, manifestKey, stripPngKey, stripPngSha };
}

describe('Publication Preflight Gate & Cryptographic Integrity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes preflight when all 21 objects and cross-field agreements match', async () => {
    const { env } = await createPublicationFixtureEnv();
    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(true);
    expect(result.reasons.length).toBe(0);
    expect(result.manifestSha256).toBeDefined();
  });

  it('fails preflight when manifest lists a correct hash but R2 master bytes are mutated', async () => {
    const { env, r2Storage, stripPngKey } = await createPublicationFixtureEnv();
    // Mutate the master strip bytes on R2
    r2Storage.set(stripPngKey, new Uint8Array([0, 1, 2, 3, 4]));

    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => r.includes('SHA mismatch'))).toBe(true);
  });

  it('fails preflight when D1 reference disagrees with manifest reference', async () => {
    const { env, d1Tables } = await createPublicationFixtureEnv();
    // Tamper guardian reference_sha256 in D1
    d1Tables.guardians.get('g-pub-1').reference_sha256 = 'tampered-sha-12345';

    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => r.includes('Cross-field mismatch') || r.includes('not approved'))).toBe(true);
  });

  it('fails preflight when raw_gate_metrics in D1 is corrupted or invalid JSON', async () => {
    const { env, d1Tables } = await createPublicationFixtureEnv();
    // Corrupt raw_gate_metrics in D1 for hover pose
    d1Tables.guardian_hatch_frames.get('g-pub-1-hover').raw_gate_metrics = '{ corrupted-not-json';

    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => r.includes('raw_gate_metrics JSON parse failed') || r.includes('schema in D1'))).toBe(true);
  });

  it('fails preflight when stored gate metrics disagree with recomputed raw contour metrics', async () => {
    const { env, d1Tables } = await createPublicationFixtureEnv();
    // Tamper componentsCount in D1 to 99
    const originalMetrics = JSON.parse(d1Tables.guardian_hatch_frames.get('g-pub-1-hover').raw_gate_metrics);
    d1Tables.guardian_hatch_frames.get('g-pub-1-hover').raw_gate_metrics = JSON.stringify({
      ...originalMetrics,
      componentsCount: 99
    });

    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => r.includes('componentsCount mismatch'))).toBe(true);
  });

  it('fails preflight when R2 raw frame bytes are mutated or fail gate re-evaluation', async () => {
    const { env, r2Storage, d1Tables } = await createPublicationFixtureEnv();
    const hoverFrame = d1Tables.guardian_hatch_frames.get('g-pub-1-hover');
    const rawKey = `guardians/g-pub-1/raw/${hoverFrame.raw_sha256}.png`;

    // Mutate the raw frame bytes in R2
    r2Storage.set(rawKey, new Uint8Array([0, 1, 2, 3, 4]));

    const result = await verifyPublicationReady('g-pub-1', env);
    expect(result.ready).toBe(false);
    expect(result.reasons.some(r => r.includes('SHA mismatch') || r.includes('contour gate'))).toBe(true);
  });

  it('concurrent publish elects exactly one winner; loser gets CONFLICT without mixed state', async () => {
    const { env, d1Tables } = await createPublicationFixtureEnv();

    const [pub1, pub2] = await Promise.all([
      approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env }),
      approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-B@githoot.com', env })
    ]);

    // Exactly one succeeds, one gets CONFLICT
    const successes = [pub1, pub2].filter(p => p.success && p.status === 'ASSET_READY');
    const conflicts = [pub1, pub2].filter(p => !p.success && p.status === 'CONFLICT');

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    // Exactly one winner record in guardian_publication
    expect(d1Tables.guardian_publication.size).toBe(1);
    const pubRecord = d1Tables.guardian_publication.get('g-pub-1');
    expect(pubRecord.state).toBe('ASSET_READY');
  });

  it('idempotent re-publish of already published guardian returns ASSET_READY success', async () => {
    const { env } = await createPublicationFixtureEnv();

    const pub1 = await approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env });
    expect(pub1.success).toBe(true);

    const pub2 = await approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env });
    expect(pub2.success).toBe(true);
    expect(pub2.status).toBe('ASSET_READY');
  });

  it('crash matrix: injected failure during R2 master upload halts publish before CAS, leaving no pointer and no visible assets', async () => {
    const { env, d1Tables } = await createPublicationFixtureEnv();
    const { resolveGitHubProfile } = await import('../../src/server/services/github/resolver');

    // Inject failure on R2 upload for manifests
    const originalPut = env.ASSETS_BUCKET.put;
    env.ASSETS_BUCKET.put = vi.fn().mockImplementation(async (key: string, data: any) => {
      if (key.includes('manifests/')) {
        throw new Error('R2_STORAGE_INJECTED_NETWORK_ERROR');
      }
      return (originalPut as any)(key, data);
    });

    await expect(
      approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env })
    ).rejects.toThrow('R2_STORAGE_INJECTED_NETWORK_ERROR');

    // No pointer row in guardian_publication
    expect(d1Tables.guardian_publication.has('g-pub-1')).toBe(false);

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 11829471,
      login: 'mrgoonie',
      public_repos: 10,
      created_at: '2015-01-01T00:00:00Z'
    }), { status: 200 }));

    // Public reader resolves non-ready state without mixed visible assets
    const profile = await resolveGitHubProfile('mrgoonie', env);
    expect(profile.guardian?.status).toBe('VERIFYING');
    expect(profile.guardian?.spritesheet_url).toBeNull();
    expect(profile.guardian?.manifest_url).toBeNull();
  });

  it('crash matrix: injected failure during post-CAS projection still resolves ASSET_READY via pointer, and re-running converges D1', async () => {
    const { env, d1Tables, manifestSha, stripPngSha } = await createPublicationFixtureEnv();
    const { resolveGitHubProfile } = await import('../../src/server/services/github/resolver');

    // Inject failure on post-CAS projection (UPDATE guardians SET status = 'ASSET_READY')
    let projectionFailed = false;
    const originalPrepare = env.DB.prepare;
    env.DB.prepare = vi.fn().mockImplementation((query: string) => {
      const stmt = (originalPrepare as any)(query);
      if (query.includes('UPDATE guardians') && query.includes('SET status = \'ASSET_READY\'') && !projectionFailed) {
        return {
          ...stmt,
          bind: vi.fn().mockImplementation((...args: any[]) => ({
            run: vi.fn().mockImplementation(async () => {
              projectionFailed = true;
              throw new Error('D1_INJECTED_PROJECTION_CRASH');
            })
          }))
        };
      }
      return stmt;
    });

    // Approval succeeds because CAS pointer was committed before the projection crash
    const pubResult = await approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env });
    expect(pubResult.success).toBe(true);
    expect(pubResult.status).toBe('ASSET_READY');

    // Pointer was committed, but projection in guardians table failed
    expect(d1Tables.guardian_publication.has('g-pub-1')).toBe(true);
    expect(d1Tables.guardians.get('g-pub-1').status).toBe('VERIFYING'); // Unprojected state

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 11829471,
      login: 'mrgoonie',
      public_repos: 10,
      created_at: '2015-01-01T00:00:00Z'
    }), { status: 200 }));

    // Public reader queries pointer-first and resolves ASSET_READY with content-addressed URLs
    const profile = await resolveGitHubProfile('mrgoonie', env);
    const pubRow = d1Tables.guardian_publication.get('g-pub-1');
    expect(profile.guardian?.status).toBe('ASSET_READY');
    expect(profile.guardian?.manifest_url).toBe(`https://cdn.githoot.com/${pubRow.manifest_key}`);
    expect(profile.guardian?.spritesheet_url).toBe(`https://cdn.githoot.com/${pubRow.spritesheet_key}`);
    // Re-running approveGuardianPosesAndPublish converges D1 projections
    env.DB.prepare = originalPrepare;
    const convergeResult = await approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env });
    expect(convergeResult.success).toBe(true);
    expect(convergeResult.status).toBe('ASSET_READY');

    // Assert that D1 guardians table and hatch jobs table converged to ASSET_READY
    const guardian = d1Tables.guardians.get('g-pub-1');
    const job = d1Tables.guardian_hatch_jobs.get('job-pub-1');
    expect(guardian?.status).toBe('ASSET_READY');
    expect(guardian?.manifest_url).toBe(`https://cdn.githoot.com/${pubRow.manifest_key}`);
    expect(guardian?.spritesheet_url).toBe(`https://cdn.githoot.com/${pubRow.spritesheet_key}`);
    expect(job?.state).toBe('ASSET_READY');
    expect(job?.manifest_url).toBe(`https://cdn.githoot.com/${pubRow.manifest_key}`);
  });

  it('resolved public manifest state is ASSET_READY and equals pointer target', async () => {
    const { env, r2Storage, d1Tables } = await createPublicationFixtureEnv();
    const { parseGuardianManifest } = await import('../../src/server/services/claim/manifest-schema');

    const pubRes = await approveGuardianPosesAndPublish({ guardianId: 'g-pub-1', reviewer: 'reviewer-A@githoot.com', env });
    expect(pubRes.success).toBe(true);
    expect(pubRes.status).toBe('ASSET_READY');

    const pointer = d1Tables.guardian_publication.get('g-pub-1');
    expect(pointer).toBeDefined();
    expect(pointer.state).toBe('ASSET_READY');

    // Fetch target manifest from R2
    const rawBytes = r2Storage.get(pointer.manifest_key);
    expect(rawBytes).toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(rawBytes));

    const manifestCheck = await parseGuardianManifest(parsed);
    expect(manifestCheck.ok).toBe(true);
    if (manifestCheck.ok) {
      expect(manifestCheck.manifest.state).toBe('ASSET_READY');
      expect(manifestCheck.manifest.guardianId).toBe('g-pub-1');
    }
  });
});
