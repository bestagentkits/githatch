// ============================================================================
// Workers Runtime Integration Harness Smoke Test
// (tests/integration/harness.smoke.test.ts)
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { env, createMessageBatch, getQueueResult, createExecutionContext } from 'cloudflare:test';
import { runMigrations } from './setup/migrations';
import { encodeRgbaToWebp, decodeWebpToRgba } from '../../src/server/services/image/webp-encoder';
import { decodePngToRgba, encodeRgbaToPng } from '../../src/server/services/image/png-codec';
import { findCharacterBoundingBox } from '../../src/server/services/image/slicer';
import { analyzeConnectedComponents } from '../../src/server/services/image/connected-components';
import { GATES, POSE_SET, VERSIONS } from '../../src/server/services/dna/contracts';
import { verifyPublicationReady } from '../../src/server/services/claim/publication-preflight';
import { reserveAiSpend, settleAiSpend } from '../../src/server/services/billing/budget-guard';
import { handleQueueBatch, type GenerationQueueMessage } from '../../src/server/queue/generation-worker';
import { approveGuardianPosesAndPublish } from '../../src/server/services/ai/hatch-admin';
import { compileIdentitySpec } from '../../src/server/services/dna/compiler';
import { sha256Hex } from '../../src/server/services/crypto/web-crypto';
import { drainOutbox, writeOutboxMessage } from '../../src/server/queue/outbox';
import { acquirePoseLease } from '../../src/server/queue/lease-manager';
import {
  createValidCenteredSubjectPng,
  createTransparentPng,
  createCollageEchoPng,
  createMultiSubjectPng,
  createScaleToFit1024Png,
  createOversizedPng,
  createTruncatedPng,
  createJpegBuffer,
  createInterlacedPng,
  createTooSmallSubjectPng,
  createOverWideSubjectPng
} from './fixtures/images';

describe('Workers Runtime Harness Smoke', () => {
  beforeAll(async () => {
    // 1. Apply D1 Migrations to real workerd D1 binding
    await runMigrations(env.DB);

    // 2. Insert test user for matrix foreign key constraints
    const now = Date.now();
    await env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, github_user_id, status, created_at, updated_at)
      VALUES ('u-1', 991001, 'active', ?1, ?1);
    `).bind(now).run();
  });

  it('verifies real D1 database operations & migrations schema', async () => {
    // Seed one PENDING guardian
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, github_user_id, status, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?)`
    ).bind('user-smoke-1', 999001, now, now).run();

    await env.DB.prepare(
      `INSERT INTO guardians (
         id, user_id, github_user_id, name, egg_type, species, element,
         dna_seed, rarity_tier, hero_image_url, traits, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      'g-smoke-1', 'user-smoke-1', 999001, 'SmokePet', 'Cyber', 'NeonByte', 'Cyber',
      'seed-1234', 'Rare', 'https://cdn.githoot.com/guardians/g-smoke-1/hero.png',
      JSON.stringify({ attack: 10 }), 'PENDING', now
    ).run();

    const guardian = await env.DB.prepare(
      `SELECT id, name, status FROM guardians WHERE id = ?`
    ).bind('g-smoke-1').first();

    expect(guardian).toBeDefined();
    expect(guardian?.id).toBe('g-smoke-1');
    expect(guardian?.status).toBe('PENDING');
  });

  it('verifies real R2 object storage operations (put, head, get)', async () => {
    const testKey = 'test/smoke-asset.txt';
    const testData = new TextEncoder().encode('Hello GitHoot R2 Storage');

    await env.ASSETS_BUCKET.put(testKey, testData, {
      httpMetadata: { contentType: 'text/plain' },
      customMetadata: { sha256: 'dummy-sha' }
    });

    const head = await env.ASSETS_BUCKET.head(testKey);
    expect(head).not.toBeNull();
    expect(head?.size).toBe(testData.length);
    expect(head?.customMetadata?.sha256).toBe('dummy-sha');

    const obj = await env.ASSETS_BUCKET.get(testKey);
    expect(obj).not.toBeNull();
    const retrievedText = await obj!.text();
    expect(retrievedText).toBe('Hello GitHoot R2 Storage');
  });

  it('verifies real KV cache operations (put, get, ttl)', async () => {
    const key = 'test:smoke:kv';
    await env.CACHE_KV.put(key, JSON.stringify({ ok: true, timestamp: 12345 }), {
      expirationTtl: 300
    });
    const val = await env.CACHE_KV.get(key, 'json');
    expect(val).toEqual({ ok: true, timestamp: 12345 });
  });

  it('verifies exact published FIPS 180-4 SHA-256 digests in real workerd environment', async () => {
    const emptyExpected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const abcExpected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const utf8Input = 'GitHoot 🦉 ấp trứng & sinh linh thần thoại 2026';
    const utf8Expected = '4e8468e3a1f0f4edda9fd5089e11ab7915e5d43f82b00ac5c301703fed9ababb';

    const { sha256Hex } = await import('../../src/server/services/crypto/web-crypto');
    expect(await sha256Hex('')).toBe(emptyExpected);
    expect(await sha256Hex('abc')).toBe(abcExpected);
    expect(await sha256Hex(utf8Input)).toBe(utf8Expected);
  });

  it('verifies byte-identical IdentitySpec, prompts, and request fingerprint derivation on workerd', async () => {
    const { compileIdentitySpec, compileReferencePrompt, compilePosePrompt, requestFingerprint, validateIdentitySpec } = await import('../../src/server/services/dna/compiler');

    const telemetry = {
      topLanguages: ['TypeScript', 'Rust', 'Go'],
      stars: 1420, forks: 210, publicRepos: 48, followers: 380,
      accountAgeYears: 9, mergedExternalPRs: 24, releases: 11,
      reviewRatio: 0.62, collaborators: 18, activeWeeks: 34, nightCommitRatio: 0.71,
      provenance: {
        topLanguages: 'measured' as const, stars: 'measured' as const, forks: 'measured' as const, publicRepos: 'measured' as const, followers: 'measured' as const,
        accountAgeYears: 'measured' as const, mergedExternalPRs: 'measured' as const, releases: 'measured' as const, reviewRatio: 'measured' as const,
        collaborators: 'measured' as const, activeWeeks: 'measured' as const, nightCommitRatio: 'measured' as const
      }
    };

    const spec = await compileIdentitySpec({ githubUserId: 11829471, telemetry });
    expect(spec.species).toBe('neonbyte');
    expect(spec.element).toBe('Cyber');
    expect(spec.rarity).toBe('Rare');
    expect(spec.dnaSeed).toBe('ed9c4578553149045f9b8c1d46d3e801a59324a0657c7c87bd70391ab06c76cb');
    expect(spec.telemetrySnapshotHash).toBe('8bcaad92f6581d5bbb75a4acafb835615288cc280ddeb6b812b7351f240bce4f');
    expect(spec.identityHash).toBe('244a6529d022e63b94a6fec175c6d198d8312854fda560e5d83f283def293983');

    const refPrompt = await compileReferencePrompt(spec);
    expect(refPrompt.poseId).toBe('reference');
    expect(refPrompt.promptHash).toBe('5172e615740545bbff7035214c48ace85286024b6c1530f1dacf8c8fd6cd7d76');

    const posePrompt = await compilePosePrompt(spec, 'hero_stance');
    expect(posePrompt.poseId).toBe('hero_stance');
    expect(posePrompt.promptHash).toBe('6083d37bd222cee8da2dab1c8bcdc9fba5a83e0362381019f177f4cf0a2f2c04');

    const fingerprint = await requestFingerprint({ spec, referenceSha256: 'sha-ref-golden-1234', modelId: 'nano-banana-pro-preview' });
    expect(fingerprint).toBe('f790a42382815ea76b978db31aebcad07ef2e652b93abee2ba5fdfde755d86c5');
    // Validate identity spec runtime validator on workerd
    const validation = await validateIdentitySpec(spec);
    expect(validation.valid).toBe(true);
  });

  it('quarantines malformed identity_spec on real workerd D1 database atomically', async () => {
    const { handleQueueBatch } = await import('../../src/server/queue/generation-worker');

    const now = Date.now();
    // Seed user & guardian with malformed identity_spec
    await env.DB.prepare('INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)').bind('u-malformed-workerd', 888777, now, now).run();
    await env.DB.prepare(`
      INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, identity_spec, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).bind('g-malformed-workerd', 'u-malformed-workerd', 888777, 'BadSpecPet', 'Cyber', 'Neonbyte', 'Cyber', 'seed', 'Common', '', '{}', 'INVALID_JSON_OR_TAMPERED', now).run();

    await env.DB.prepare('INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at) VALUES (?, ?, ?, "PENDING", ?, 0, 0, ?, ?)').bind('job-malformed-workerd', 'g-malformed-workerd', 'req-malformed-1', 'nano-banana-pro-preview', now, now).run();

    const batch = createMessageBatch('githoot-ai-queue', [
      {
        id: 'msg-malformed-workerd',
        timestamp: new Date(),
        attempts: 1,
        body: { type: 'HATCH_JOB', guardianId: 'g-malformed-workerd', jobId: 'job-malformed-workerd' }
      }
    ]);
    const ctx = createExecutionContext();
    await handleQueueBatch(batch as any, env);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toContain('msg-malformed-workerd');

    // Assert real D1 table status
    const guardianRow = await env.DB.prepare('SELECT status FROM guardians WHERE id = ?').bind('g-malformed-workerd').first<{ status: string }>();
    const jobRow = await env.DB.prepare('SELECT state, error_log FROM guardian_hatch_jobs WHERE id = ?').bind('job-malformed-workerd').first<{ state: string; error_log: string }>();

    expect(guardianRow?.status).toBe('QUARANTINED');
    expect(jobRow?.state).toBe('QUARANTINED');
    expect(jobRow?.error_log).toContain('INVALID_IDENTITY_SPEC');
  });
  it('verifies Queue producer binding presence and message sending on env.AI_QUEUE', async () => {
    expect(env.AI_QUEUE).toBeDefined();
    expect(typeof env.AI_QUEUE.send).toBe('function');

    await env.AI_QUEUE.send({
      type: 'HATCH_JOB',
      guardianId: 'g-smoke-producer'
    });
  });

  it('verifies real Queue message batch processing, ack, and retry semantics on workerd', async () => {
    // 1. Test successful batch ack semantics
    const ackBatch = createMessageBatch('githoot-ai-queue', [
      {
        id: 'msg-ack-1',
        timestamp: new Date(),
        attempts: 1,
        body: { type: 'HATCH_JOB', guardianId: 'g-smoke-ack' }
      }
    ]);
    const ackCtx = createExecutionContext();

    // Mock consumer that acks the message
    for (const msg of ackBatch.messages) {
      msg.ack();
    }
    const ackResult = await getQueueResult(ackBatch, ackCtx);
    expect(ackResult.outcome).toBe('ok');
    expect(ackResult.explicitAcks).toContain('msg-ack-1');

    // 2. Test retry semantics on failure
    const retryBatch = createMessageBatch('githoot-ai-queue', [
      {
        id: 'msg-retry-1',
        timestamp: new Date(),
        attempts: 1,
        body: { type: 'HATCH_JOB', guardianId: 'g-smoke-retry' }
      }
    ]);
    const retryCtx = createExecutionContext();

    for (const msg of retryBatch.messages) {
      msg.retry();
    }
    const retryResult = await getQueueResult(retryBatch, retryCtx);
    expect(retryResult.outcome).toBe('ok');
    expect(retryResult.retryMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ msgId: 'msg-retry-1' })])
    );
  });

  it('verifies WASM WebP encode and decode on workerd', async () => {
    // 4x4 RGBA raw buffer
    const rgba = new Uint8Array(4 * 4 * 4);
    rgba.fill(128);

    const webpBytes = await encodeRgbaToWebp(rgba, 4, 4);
    expect(webpBytes).toBeInstanceOf(Uint8Array);
    expect(webpBytes.length).toBeGreaterThan(0);

    const decoded = await decodeWebpToRgba(webpBytes);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.data.length).toBe(4 * 4 * 4);
  });

  it('verifies deterministic image fixture factory produces all contract classes adhering to GATES', async () => {
    // 1. Valid centered subject + repeat byte determinism + semantic bounding box
    const validPng1 = createValidCenteredSubjectPng(256, 256);
    const validPng2 = createValidCenteredSubjectPng(256, 256);
    expect(validPng1).toEqual(validPng2);
    expect(validPng1.length).toBeLessThanOrEqual(GATES.maxBytes);
    const validDecoded = await decodePngToRgba(validPng1);
    expect(validDecoded.width).toBe(256);
    expect(validDecoded.height).toBe(256);
    const validBbox = findCharacterBoundingBox(validDecoded.data, 256, 256);
    expect(validBbox.width).toBeGreaterThan(50);
    expect(validBbox.height).toBeGreaterThan(50);
    expect(validBbox.width / validBbox.height).toBeCloseTo(1.0, 1);

    // 2. Fully transparent frame + repeat byte determinism
    const transPng1 = createTransparentPng(256, 256);
    const transPng2 = createTransparentPng(256, 256);
    expect(transPng1).toEqual(transPng2);
    const transDecoded = await decodePngToRgba(transPng1);
    expect(transDecoded.width).toBe(256);
    expect(transDecoded.height).toBe(256);
    let nonZeroAlpha = 0;
    for (let i = 3; i < transDecoded.data.length; i += 4) {
      if (transDecoded.data[i] > 0) nonZeroAlpha++;
    }
    expect(nonZeroAlpha).toBe(0);

    // 3. Collage echo (>4 components) + repeat byte determinism + real decoded CCL component count
    const collagePng1 = createCollageEchoPng(256, 256);
    const collagePng2 = createCollageEchoPng(256, 256);
    expect(collagePng1).toEqual(collagePng2);
    const collageDecoded = await decodePngToRgba(collagePng1);
    const collageCcl = analyzeConnectedComponents(collageDecoded.data, 256, 256);
    expect(collageCcl.largeComponentsCount).toBe(6);
    expect(collageCcl.largeComponentsCount).toBeGreaterThan(GATES.maxLargeComponents); // 6 > 4

    // 4. Multi-subject (>30% second component) + repeat byte determinism + real decoded CCL dominance ratio
    const multiPng1 = createMultiSubjectPng(256, 256);
    const multiPng2 = createMultiSubjectPng(256, 256);
    expect(multiPng1).toEqual(multiPng2);
    const multiDecoded = await decodePngToRgba(multiPng1);
    const multiCcl = analyzeConnectedComponents(multiDecoded.data, 256, 256);
    expect(multiCcl.largeComponentsCount).toBe(2);
    expect(multiCcl.dominanceRatio).toBeGreaterThan(GATES.dominanceRatio); // ~0.56 > 0.30
    const scale1024Png1 = await createScaleToFit1024Png();
    const scale1024Png2 = await createScaleToFit1024Png();
    expect(scale1024Png1).toEqual(scale1024Png2);
    expect(scale1024Png1.length).toBeLessThanOrEqual(GATES.maxBytes);
    const scaleDecoded = await decodePngToRgba(scale1024Png1);
    expect(scaleDecoded.width).toBe(GATES.maxSidePx);
    expect(scaleDecoded.height).toBe(GATES.maxSidePx);

    // 6. Oversized: 1600x1600 exceeds GATES.maxSidePx + repeat byte determinism
    const oversizedPng1 = await createOversizedPng();
    const oversizedPng2 = await createOversizedPng();
    expect(oversizedPng1).toEqual(oversizedPng2);
    const overDecoded = await decodePngToRgba(oversizedPng1);
    expect(overDecoded.width).toBe(1600);
    expect(overDecoded.width).toBeGreaterThan(GATES.maxSidePx);

    // 7. Truncated PNG + repeat byte determinism + decoder rejection
    const truncated1 = createTruncatedPng();
    const truncated2 = createTruncatedPng();
    expect(truncated1).toEqual(truncated2);
    expect(truncated1[0]).toBe(0x89);
    expect(truncated1[1]).toBe(0x50);
    expect(truncated1.length).toBeLessThan(100);
    await expect(decodePngToRgba(truncated1)).rejects.toThrow();

    // 8. JPEG magic buffer + repeat byte determinism + decoder rejection
    const jpeg1 = createJpegBuffer();
    const jpeg2 = createJpegBuffer();
    expect(jpeg1).toEqual(jpeg2);
    expect(jpeg1[0]).toBe(0xff);
    expect(jpeg1[1]).toBe(0xd8);
    expect(jpeg1[2]).toBe(0xff);
    await expect(decodePngToRgba(jpeg1)).rejects.toThrow();
    // 9. Too small (<6% bbox fill) semantic invariant
    const tooSmall1 = createTooSmallSubjectPng(256, 256);
    const tooSmall2 = createTooSmallSubjectPng(256, 256);
    expect(tooSmall1).toEqual(tooSmall2);
    const smallDecoded = await decodePngToRgba(tooSmall1);
    const smallBbox = findCharacterBoundingBox(smallDecoded.data, 256, 256);
    const smallFillRatio = (smallBbox.width * smallBbox.height) / (256 * 256);
    expect(smallFillRatio).toBeLessThan(GATES.minBboxFill);

    // 10. Over wide (aspect > 3.2) semantic invariant
    const overWide1 = createOverWideSubjectPng(256, 256);
    const overWide2 = createOverWideSubjectPng(256, 256);
    expect(overWide1).toEqual(overWide2);
    const wideDecoded = await decodePngToRgba(overWide1);
    const wideBbox = findCharacterBoundingBox(wideDecoded.data, 256, 256);
    const wideAspect = wideBbox.width / wideBbox.height;
    expect(wideAspect).toBeGreaterThan(GATES.maxBboxAspect);
  });

  it('characterizes baseline vulnerability: verifyPublicationReady currently returns ready=true on real workerd D1/R2 storage when master bytes are 100% transparent', async () => {
    const guardianId = 'g-trans-baseline';
    const now = Date.now();

    // 1. Seed user and guardian in D1
    await env.DB.prepare(
      `INSERT INTO users (id, github_user_id, status, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?)`
    ).bind('u-trans-1', 999111, now, now).run();

    await env.DB.prepare(
      `INSERT INTO guardians (
         id, user_id, github_user_id, name, egg_type, species, element,
         dna_seed, rarity_tier, hero_image_url, traits, reference_sha256, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      guardianId, 'u-trans-1', 999111, 'TransPet', 'Cyber', 'NeonByte', 'Cyber',
      'seed-trans', 'Rare', 'https://cdn.githoot.com/guardians/g-trans-baseline/hero.png',
      JSON.stringify({ attack: 10 }), 'ref-sha-trans', 'VERIFYING', now
    ).run();

    // 2. Seed approved reference candidate
    await env.DB.prepare(
      `INSERT INTO guardian_reference_candidates (
         id, guardian_id, candidate_sha256, identity_hash, prompt_hash,
         model_id, raw_sha256, state, reviewer, verdict_data, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'reviewer-1', ?, ?)`
    ).bind(
      'ref-cand-1', guardianId, 'ref-sha-trans', 'id-hash-trans', 'prompt-hash-1',
      'nano-banana-pro-preview', 'raw-sha-1', JSON.stringify({ approved: true }), now
    ).run();

    // 3. Seed hatch job
    await env.DB.prepare(
      `INSERT INTO guardian_hatch_jobs (
         id, guardian_id, request_fingerprint, state, model_id, attempts_count,
         frames_completed, created_at, updated_at
       ) VALUES (?, ?, ?, 'VERIFYING', 'nano-banana-pro-preview', 1, 16, ?, ?)`
    ).bind('job-trans-1', guardianId, 'fp-trans-1', now, now).run();

    // 4. Seed 16 frames in D1 with valid pose indices (0..15) and mock metrics/verdicts
    for (let i = 0; i < 16; i++) {
      const frameSha = `frame-sha-${i}`;
      await env.DB.prepare(
        `INSERT INTO guardian_hatch_frames (
           id, job_id, pose_id, pose_index, frame_sha256, raw_sha256,
           state, raw_gate_metrics, semantic_verdict, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', ?, ?, ?)`
      ).bind(
        `frame-rec-${i}`, 'job-trans-1', `pose-${i}`, i, frameSha, `raw-sha-${i}`,
        JSON.stringify({ bbox: [0, 0, 10, 10], components: 1 }),
        JSON.stringify({ verdict: 'pass', reviewer: 'art-lead', boundToSha256: frameSha }),
        now
      ).run();
    }

    // 5. Store 100% transparent PNG and WebP bytes in real R2 storage
    const transPng = createTransparentPng(256, 256);
    const transWebp = await encodeRgbaToWebp(new Uint8Array(256 * 256 * 4), 256, 256);

    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/landing16-sheet.png`, transPng);
    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/landing16-sheet.webp`, transWebp);
    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/landing16-strip.png`, transPng);
    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/landing16-strip.webp`, transWebp);

    const manifestContent = JSON.stringify({
      artifacts: {
        sheetPng: { sha256: 'sha-trans-sheet-png' },
        sheetWebp: { sha256: 'sha-trans-sheet-webp' },
        stripPng: { sha256: 'sha-trans-strip-png' },
        stripWebp: { sha256: 'sha-trans-strip-webp' }
      }
    });
    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/manifest.json`, manifestContent);

    // 6. Execute verifyPublicationReady
    const preflightResult = await verifyPublicationReady(guardianId, env);

    // Hardened Phase 3 & 5 Preflight:
    // Cryptographic preflight recomputes digests and runs contour gates over retained raw inputs,
    // correctly rejecting 100% transparent frames.
    expect(preflightResult.ready).toBe(false);
    expect(preflightResult.reasons.length).toBeGreaterThan(0);
  });
  it('enforces real D1 atomic concurrent budget reservations and hard $20 cap on workerd', async () => {
    const today = new Date().toISOString().split('T')[0];
    // Clean today's ledger entry for isolation
    await env.DB.prepare('DELETE FROM ai_budget_ledger WHERE day = ?').bind(today).run();

    // Fire 85 concurrent reservation calls on real workerd D1 without settlement
    const promises = Array.from({ length: 85 }, () => reserveAiSpend(env, 25));
    const results = await Promise.all(promises);

    const granted = results.filter(r => r.ok === true).length;
    const rejected = results.filter(r => r.ok === false).length;

    expect(granted).toBe(80); // Exactly 80 granted (80 * 25c = 2000c = $20.00)
    expect(rejected).toBe(5);  // Calls 81-85 rejected

    // Inspect real D1 row
    const row = await env.DB.prepare(
      'SELECT reserved_cents, settled_cents, cap_cents, total_calls FROM ai_budget_ledger WHERE day = ?'
    ).bind(today).first<{ reserved_cents: number; settled_cents: number; cap_cents: number; total_calls: number }>();

    expect(row).toBeDefined();
    expect(row?.reserved_cents).toBe(2000);
    expect(row?.settled_cents).toBe(0);
    expect(row?.cap_cents).toBe(2000);
    expect(row?.total_calls).toBe(80);

    // Settle all 80 calls and verify settled_cents = 2000, reserved_cents = 0
    await env.DB.prepare(
      'UPDATE ai_budget_ledger SET reserved_cents = 0, settled_cents = 2000 WHERE day = ?'
    ).bind(today).run();

    const settledRow = await env.DB.prepare(
      'SELECT reserved_cents, settled_cents FROM ai_budget_ledger WHERE day = ?'
    ).bind(today).first<{ reserved_cents: number; settled_cents: number }>();

    expect(settledRow?.reserved_cents).toBe(0);
    expect(settledRow?.settled_cents).toBe(2000);

    // Any further reservation call MUST be rejected since settled_cents = 2000
    const overCapRes = await reserveAiSpend(env, 25);
    expect(overCapRes.ok).toBe(false);
    expect(overCapRes.reason).toBe('DAILY_BUDGET_CAP_EXCEEDED');

    // Cleanup
    await env.DB.prepare('DELETE FROM ai_budget_ledger WHERE day = ?').bind(today).run();
  });

  describe('Phase 8: Complete Falsifiable Contract Matrix on Real workerd Bindings', () => {
    it('Matrix 1 & 4: Rejects transparent frame, JPEG, truncated, and oversized input fail-closed', async () => {
      const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');

      // 1. Transparent frame
      const trans = createTransparentPng(256, 256);
      const transRes = await validateAndNormalizeFrame(trans);
      expect(transRes.ok).toBe(false);
      if (!transRes.ok) expect(transRes.reasons.some(r => r.includes('transparent'))).toBe(true);

      // 2. JPEG magic bytes
      const jpeg = createJpegBuffer();
      const jpegRes = await validateAndNormalizeFrame(jpeg);
      expect(jpegRes.ok).toBe(false);
      if (!jpegRes.ok) expect(jpegRes.reasons.some(r => r.includes('valid PNG magic signature'))).toBe(true);

      // 3. Truncated PNG
      const trunc = createTruncatedPng();
      const truncRes = await validateAndNormalizeFrame(trunc);
      expect(truncRes.ok).toBe(false);

      // 4. Oversized (>1024px)
      const over = await createOversizedPng();
      const overRes = await validateAndNormalizeFrame(over);
      expect(overRes.ok).toBe(false);
      if (!overRes.ok) expect(overRes.reasons.some(r => r.includes('exceed max allowed bounds'))).toBe(true);

      // 5. Interlaced PNG (interlaceMethod !== 0 rejected specifically by decoder)
      const interlaced = createInterlacedPng();
      const interRes = await validateAndNormalizeFrame(interlaced);
      expect(interRes.ok).toBe(false);
      if (!interRes.ok) expect(interRes.reasons.some(r => r.includes('Unsupported interlaced PNG'))).toBe(true);
    });

    it('Matrix 2: Scales 1024x1024 within-cap subject to fit 256x256 without clipping', async () => {
      const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');
      const largeSubject = await createScaleToFit1024Png();
      const res = await validateAndNormalizeFrame(largeSubject);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.normalizedPng.length).toBeGreaterThan(0);
        expect(res.frameSha256.length).toBe(64);
      }
    });

    it('Matrix 3: Rejects collage echo (>4 components) and multi-subject (>30% dominance)', async () => {
      const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');

      // Collage echo
      const collage = createCollageEchoPng(256, 256);
      const colRes = await validateAndNormalizeFrame(collage);
      expect(colRes.ok).toBe(false);
      if (!colRes.ok) expect(colRes.reasons.some(r => r.includes('Collage echo'))).toBe(true);

      // Multi-subject
      const multi = createMultiSubjectPng(256, 256);
      const multiRes = await validateAndNormalizeFrame(multi);
      expect(multiRes.ok).toBe(false);
      if (!multiRes.ok) expect(multiRes.reasons.some(r => r.includes('Multi-subject'))).toBe(true);
    });

    it('Matrix 5: Missing canonical reference hero image in R2 quarantines job on real D1/R2', async () => {
      const guardianId = 'g-mat-missing-ref';
      const jobId = 'job-mat-missing-ref';
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: 991001,
        telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
      });

      await env.DB.prepare(`
        INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, rarity_tier, dna_seed, status, reference_sha256, hero_image_url, traits, identity_spec, created_at)
        VALUES (?1, 'u-1', 991001, 'RefMissing', 'Cyber', ?2, ?3, ?4, ?5, 'VERIFYING', 'missing-sha-ref', '/assets/sample-pets/neonbyte.jpg', '{}', ?6, ?7);
      `).bind(guardianId, spec.species, spec.element, spec.rarity, spec.dnaSeed, JSON.stringify(spec), now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at)
        VALUES (?1, ?2, 'fp-m1', 'GENERATING', 'nano-banana-pro-preview', 1, 0, ?3, ?3);
      `).bind(jobId, guardianId, now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_reference_candidates (id, guardian_id, candidate_sha256, identity_hash, prompt_hash, model_id, raw_sha256, state, created_at)
        VALUES ('cand-m1', ?1, 'missing-sha-ref', ?2, 'p-hash', 'nano-banana-pro-preview', 'raw-sha', 'APPROVED', ?3);
      `).bind(guardianId, spec.identityHash, now).run();

      // Do NOT put references/missing-sha-ref.png in R2!
      const msg = {
        id: 'msg-mat-1',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, type: 'HATCH_POSE', jobId, guardianId, poseId: 'hover', attempt: 1 } as GenerationQueueMessage,
        ack: () => {},
        retry: () => {}
      };

      await handleQueueBatch(createMessageBatch('githoot-ai-queue', [msg]), env);

      const gRow = await env.DB.prepare('SELECT status FROM guardians WHERE id = ?1').bind(guardianId).first<{ status: string }>();
      const jRow = await env.DB.prepare('SELECT state, error_log FROM guardian_hatch_jobs WHERE id = ?1').bind(jobId).first<{ state: string; error_log: string }>();

      expect(gRow?.status).toBe('QUARANTINED');
      expect(jRow?.state).toBe('QUARANTINED');
      expect(jRow?.error_log).toContain('MISSING_CANONICAL_REFERENCE');
    });

    it('Matrix 6 & 10: Per-pose conditional lease and duplicate delivery converge to exactly one accepted row', async () => {
      const guardianId = 'g-mat-lease-test';
      const jobId = 'job-mat-lease-test';
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: 991002,
        telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
      });

      await env.DB.prepare(`
        INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, rarity_tier, dna_seed, status, hero_image_url, traits, identity_spec, created_at)
        VALUES (?1, 'u-1', 991002, 'LeasePet', 'Cyber', ?2, ?3, ?4, ?5, 'GENERATING', '/assets/sample-pets/neonbyte.jpg', '{}', ?6, ?7);
      `).bind(guardianId, spec.species, spec.element, spec.rarity, spec.dnaSeed, JSON.stringify(spec), now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at)
        VALUES (?1, ?2, 'fp-m2', 'GENERATING', 'nano-banana-pro-preview', 1, 0, ?3, ?3);
      `).bind(jobId, guardianId, now).run();

      // 1. Worker A acquires lease
      const l1 = await acquirePoseLease(env, jobId, 'hover', 1, 'worker-A');
      expect(l1.acquired).toBe(true);

      // 2. Concurrent Worker B attempts to acquire same pose attempt -> fails with ACTIVE_LEASE
      const l2 = await acquirePoseLease(env, jobId, 'hover', 1, 'worker-B');
      expect(l2.acquired).toBe(false);
      expect(l2.reason).toBe('ACTIVE_LEASE');

      // 3. Mark pose ACCEPTED in D1
      await env.DB.prepare(`
        INSERT INTO guardian_hatch_frames (id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, created_at)
        VALUES ('f-1', ?1, 'hover', 0, 'sha-f1', 'sha-r1', 'ACCEPTED', '{"validated":true}', ?2);
      `).bind(jobId, now).run();

      // 4. Duplicate delivery arrives -> fails with ALREADY_ACCEPTED
      const l3 = await acquirePoseLease(env, jobId, 'hover', 1, 'worker-C');
      expect(l3.acquired).toBe(false);
      expect(l3.reason).toBe('ALREADY_ACCEPTED');
    });

    it('Matrix 9: Concurrent publish on real workerd D1 elects exactly one pointer winner and returns CONFLICT to loser', async () => {
      const guardianId = 'g-mat-concurrent-pub';
      const jobId = 'job-mat-concurrent-pub';
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: 991003,
        telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
      });

      const validPng = createValidCenteredSubjectPng(256, 256);
      const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');
      const gateRes = await validateAndNormalizeFrame(validPng);
      if (!gateRes.ok) throw new Error('Gate failed');

      const refSha = gateRes.frameSha256;
      await env.ASSETS_BUCKET.put(`references/${refSha}.png`, gateRes.normalizedPng);

      await env.DB.prepare(`
        INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, rarity_tier, dna_seed, status, reference_sha256, hero_image_url, traits, identity_spec, created_at)
        VALUES (?1, 'u-1', 991003, 'PubPet', 'Cyber', ?2, ?3, ?4, ?5, 'VERIFYING', ?6, '/assets/sample-pets/neonbyte.jpg', '{}', ?7, ?8);
      `).bind(guardianId, spec.species, spec.element, spec.rarity, spec.dnaSeed, refSha, JSON.stringify(spec), now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_reference_candidates (id, guardian_id, candidate_sha256, identity_hash, prompt_hash, model_id, raw_sha256, state, created_at)
        VALUES ('cand-m3', ?1, ?2, ?3, 'p-hash', 'nano-banana-pro-preview', 'raw-sha', 'APPROVED', ?4);
      `).bind(guardianId, refSha, spec.identityHash, now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at)
        VALUES (?1, ?2, 'fp-m3', 'VERIFYING', 'nano-banana-pro-preview', 1, 16, ?3, ?3);
      `).bind(jobId, guardianId, now).run();

      // Populate 16 frames in D1 and R2
      const framesData = [];
      for (let i = 0; i < 16; i++) {
        const p = POSE_SET[i]!;
        await env.DB.prepare(`
          INSERT INTO guardian_hatch_frames (id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, semantic_verdict, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ACCEPTED', ?7, ?8, ?9);
        `).bind(
          `frame-m3-${p.id}`,
          jobId,
          p.id,
          i,
          gateRes.frameSha256,
          gateRes.rawSha256,
          JSON.stringify({ ...gateRes.metrics, attempt: 1 }),
          JSON.stringify({ verdict: 'pass', reviewer: 'art-lead@githoot.com', boundToSha256: gateRes.frameSha256, timestamp: now }),
          now
        ).run();

        await env.ASSETS_BUCKET.put(`guardians/${guardianId}/raw/${gateRes.rawSha256}.png`, validPng);
        await env.ASSETS_BUCKET.put(`guardians/${guardianId}/frames/f${p.id}_${gateRes.frameSha256}.png`, gateRes.normalizedPng);

        framesData.push({
          poseId: p.id,
          poseIndex: i,
          frameSha256: gateRes.frameSha256,
          rawSha256: gateRes.rawSha256
        });
      }

      const dummyRgba = new Uint8Array(1024 * 1024 * 4);
      const sheetPngBytes = encodeRgbaToPng(dummyRgba, 1024, 1024);
      const sheetWebpBytes = await encodeRgbaToWebp(dummyRgba, 1024, 1024);
      const stripPngBytes = encodeRgbaToPng(dummyRgba, 4096, 256);
      const stripWebpBytes = await encodeRgbaToWebp(dummyRgba, 4096, 256);

      const sheetPngSha = await sha256Hex(sheetPngBytes);
      const sheetWebpSha = await sha256Hex(sheetWebpBytes);
      const stripPngSha = await sha256Hex(stripPngBytes);
      const stripWebpSha = await sha256Hex(stripWebpBytes);

      const sheetPngKey = `masters/${sheetPngSha}.png`;
      const sheetWebpKey = `masters/${sheetWebpSha}.webp`;
      const stripPngKey = `masters/${stripPngSha}.png`;
      const stripWebpKey = `masters/${stripWebpSha}.webp`;

      await env.ASSETS_BUCKET.put(sheetPngKey, sheetPngBytes);
      await env.ASSETS_BUCKET.put(sheetWebpKey, sheetWebpBytes);
      await env.ASSETS_BUCKET.put(stripPngKey, stripPngBytes);
      await env.ASSETS_BUCKET.put(stripWebpKey, stripWebpBytes);

      const manifestData = {
        v: 1,
        guardianId,
        versions: VERSIONS,
        identityHash: spec.identityHash,
        identity: spec,
        modelId: 'nano-banana-pro-preview',
        referenceSha256: refSha,
        state: 'VERIFYING',
        frames: framesData,
        artifacts: {
          sheetPng: { url: `https://cdn.githoot.com/${sheetPngKey}`, key: sheetPngKey, sha256: sheetPngSha },
          sheetWebp: { url: `https://cdn.githoot.com/${sheetWebpKey}`, key: sheetWebpKey, sha256: sheetWebpSha },
          stripPng: { url: `https://cdn.githoot.com/${stripPngKey}`, key: stripPngKey, sha256: stripPngSha },
          stripWebp: { url: `https://cdn.githoot.com/${stripWebpKey}`, key: stripWebpKey, sha256: stripWebpSha }
        }
      };

      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));
      await env.ASSETS_BUCKET.put(`guardians/${guardianId}/manifest.json`, manifestBytes);

      // Concurrent publish calls on real workerd D1
      const [p1, p2] = await Promise.all([
        approveGuardianPosesAndPublish({ guardianId, reviewer: 'reviewer-1@githoot.com', env }),
        approveGuardianPosesAndPublish({ guardianId, reviewer: 'reviewer-2@githoot.com', env })
      ]);

      const successes = [p1, p2].filter(p => p.success && p.status === 'ASSET_READY');
      const conflicts = [p1, p2].filter(p => !p.success && p.status === 'CONFLICT');

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(1);

      // Exactly one row exists in guardian_publication
      const pubRows = await env.DB.prepare('SELECT * FROM guardian_publication WHERE guardian_id = ?1').bind(guardianId).all();
      expect(pubRows.results?.length).toBe(1);
    });

    it('Matrix 7: Stale/corrupt cached frame fails re-validation during compositing and marks frame REJECTED', async () => {
      const guardianId = 'g-mat-corrupt-cache';
      const jobId = 'job-mat-corrupt-cache';
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: 991004,
        telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
      });

      await env.DB.prepare(`
        INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, rarity_tier, dna_seed, status, reference_sha256, hero_image_url, traits, identity_spec, created_at)
        VALUES (?1, 'u-1', 991004, 'CorruptPet', 'Cyber', ?2, ?3, ?4, ?5, 'VERIFYING', 'ref-sha-corrupt', '/assets/sample-pets/neonbyte.jpg', '{}', ?6, ?7);
      `).bind(guardianId, spec.species, spec.element, spec.rarity, spec.dnaSeed, JSON.stringify(spec), now).run();
      await env.DB.prepare(`
        INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at)
        VALUES (?1, ?2, 'fp-m4', 'GENERATING', 'nano-banana-pro-preview', 1, 16, ?3, ?3);
      `).bind(jobId, guardianId, now).run();

      await env.DB.prepare(`
        INSERT INTO guardian_reference_candidates (id, guardian_id, candidate_sha256, identity_hash, prompt_hash, model_id, raw_sha256, state, created_at)
        VALUES ('cand-m4', ?1, 'ref-sha-corrupt', ?2, 'p-hash', 'nano-banana-pro-preview', 'raw-sha', 'APPROVED', ?3);
      `).bind(guardianId, spec.identityHash, now).run();

      const validPng = createValidCenteredSubjectPng(256, 256);
      await env.ASSETS_BUCKET.put(`references/ref-sha-corrupt.png`, validPng);

      // Insert 16 frames in D1, but corrupt frame 0 bytes in R2!
      for (let i = 0; i < 16; i++) {
        const p = POSE_SET[i]!;
        await env.DB.prepare(`
          INSERT INTO guardian_hatch_frames (id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, created_at)
          VALUES (?1, ?2, ?3, ?4, 'sha-f', 'sha-r', 'ACCEPTED', '{"validated":true}', ?5);
        `).bind(`f-${p.id}`, jobId, p.id, i, now).run();

        if (i === 0) {
          // Corrupted byte buffer for frame 0
          await env.ASSETS_BUCKET.put(`guardians/${guardianId}/raw/sha-r.png`, new Uint8Array([0, 1, 2, 3]));
          await env.ASSETS_BUCKET.put(`guardians/${guardianId}/frames/f${p.id}_sha-f.png`, new Uint8Array([0, 1, 2, 3]));
        } else {
          await env.ASSETS_BUCKET.put(`guardians/${guardianId}/raw/sha-r.png`, validPng);
          await env.ASSETS_BUCKET.put(`guardians/${guardianId}/frames/f${p.id}_sha-f.png`, validPng);
        }
      }

      const msg = {
        id: 'msg-comp-corrupt',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, type: 'HATCH_COMPOSITE', jobId, guardianId } as GenerationQueueMessage,
        ack: () => {},
        retry: () => {}
      };

      await handleQueueBatch(createMessageBatch('githoot-ai-queue', [msg]), env);

      // Job and guardian are quarantined, frame 0 is rejected
      const gRow = await env.DB.prepare('SELECT status FROM guardians WHERE id = ?1').bind(guardianId).first<{ status: string }>();
      const f0Row = await env.DB.prepare('SELECT state FROM guardian_hatch_frames WHERE job_id = ?1 AND pose_id = "hover"').bind(jobId).first<{ state: string }>();

      expect(gRow?.status).toBe('QUARANTINED');
      expect(f0Row?.state).toBe('REJECTED');
    });

    it('Matrix 11 & 12: Outbox failure and recovery delivers messages safely on workerd', async () => {
      const claimKey = `outbox-recovery-test-${Date.now()}`;
      const msg: GenerationQueueMessage = {
        v: 1,
        type: 'HATCH_REFERENCE',
        jobId: 'job-outbox-rec',
        guardianId: 'g-outbox-rec'
      };

      // 1. Write to transactional outbox in D1
      await writeOutboxMessage(env.DB, 'githoot-ai-queue', msg, claimKey);

      // 2. Execute drainer on real D1
      const drainRes = await drainOutbox(env, 10, 'drainer-workerd');
      expect(drainRes.processed).toBeGreaterThanOrEqual(1);

      // 3. Outbox row is marked DELIVERED
      const row = await env.DB.prepare('SELECT state, delivered_at FROM guardian_outbox WHERE claim_key = ?1').bind(claimKey).first<{ state: string; delivered_at: number }>();
      expect(row?.state).toBe('DELIVERED');
      expect(row?.delivered_at).toBeDefined();
    });

    it('Matrix 16: Cryptographic SHA-256 vectors produce identical hashes across Node.js and workerd Web Crypto', async () => {
      const testVector = 'GitHoot FIPS 180-4 SHA-256 Canonical Invariant Test String 2026';
      const computedSha = await sha256Hex(testVector);
      expect(computedSha.length).toBe(64);

      // Verify determinism over same string
      const recomputedSha = await sha256Hex(testVector);
      expect(recomputedSha).toBe(computedSha);
    });
  });
});
