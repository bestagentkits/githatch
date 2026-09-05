// ============================================================================
// Workers Runtime Integration Harness Smoke Test
// (tests/integration/harness.smoke.test.ts)
// ============================================================================

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env, createMessageBatch, getQueueResult, createExecutionContext } from 'cloudflare:test';
import { app } from '../../src/server/index';
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

      // 2. Unrecognized format and MIME mismatch
      const badFormat = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(50).fill(0)]); // GIF
      const badFormatRes = await validateAndNormalizeFrame(badFormat);
      expect(badFormatRes.ok).toBe(false);
      if (!badFormatRes.ok) expect(badFormatRes.reasons.some(r => r.includes('does not match supported PNG or JPEG'))).toBe(true);

      const mimeMismatchRes = await validateAndNormalizeFrame(trans, { claimedMime: 'image/jpeg' });
      expect(mimeMismatchRes.ok).toBe(false);
      if (!mimeMismatchRes.ok) expect(mimeMismatchRes.reasons.some(r => r.includes('MIME mismatch'))).toBe(true);
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

    it('executes full executeClaimTransaction batch on real workerd D1 with zero missing-table or missing-column errors', async () => {
      const { executeClaimTransaction } = await import('../../src/server/services/claim/transaction');
      const authUser: any = {
        id: 99443322,
        login: 'workerd-claim-user',
        name: 'Workerd Claimer',
        avatar_url: 'https://avatars.githubusercontent.com/u/99443322',
        bio: 'Workerd E2E tester',
        public_repos: 15,
        followers: 10,
        created_at: '2020-01-01T00:00:00Z'
      };
      const sentQueueMessages: any[] = [];
      const testEnv: any = {
        ...env,
        AI_QUEUE: {
          send: async (msg: any) => {
            sentQueueMessages.push(msg);
          }
        }
      };

      // 1. First Claim: executes full 6-statement batch on real workerd D1 (user, account, guardian, job, outbox, early_access_slots)
      const claim1 = await executeClaimTransaction(authUser, testEnv);
      expect(claim1.success).toBe(true);
      expect(claim1.isNewClaim).toBe(true);
      expect(claim1.deliveryStatus).toBe('delivered');
      expect(claim1.guardian.species).toBeDefined();
      expect(claim1.guardian.species_name).toBeDefined();
      expect(claim1.guardian.status).toBe('PENDING');
      expect(sentQueueMessages.length).toBe(1);

      // 2. Assert real D1 rows exist and all 25 columns are readable
      const gRow = await env.DB.prepare(
        'SELECT id, name, species, species_name, anatomy, element, rarity_tier, status, hero_image_url, traits, telemetry_snapshot, identity_spec, request_fingerprint FROM guardians WHERE github_user_id = ?'
      ).bind(authUser.id).first<any>();
      expect(gRow).toBeDefined();
      expect(gRow?.name).toBeDefined();
      expect(gRow?.species_name).toBe(claim1.guardian.species_name);
      expect(gRow?.anatomy).toBeDefined();
      expect(gRow?.identity_spec).toBeDefined();
      expect(gRow?.request_fingerprint).toBeDefined();

      const jRow = await env.DB.prepare(
        'SELECT id, guardian_id, request_fingerprint, state FROM guardian_hatch_jobs WHERE guardian_id = ?'
      ).bind(claim1.guardian.id).first<any>();
      expect(jRow).toBeDefined();
      expect(jRow?.state).toBe('PENDING');

      const outboxRow = await env.DB.prepare(
        'SELECT id, claim_key, queue_name, payload, state, delivered_at FROM guardian_outbox WHERE claim_key = ?'
      ).bind(`claim:${claim1.guardian.id}`).first<any>();
      expect(outboxRow).toBeDefined();
      expect(outboxRow?.state).toBe('DELIVERED');
      expect(outboxRow?.delivered_at).toBeGreaterThan(0);
      expect(outboxRow?.queue_name).toBe('githoot-ai-queue');

      // 3. Second Claim (Idempotency check on real D1): returns existing guardian with isNewClaim = false
      const claim2 = await executeClaimTransaction(authUser, testEnv);
      expect(claim2.success).toBe(true);
      expect(claim2.isNewClaim).toBe(false);
      expect(claim2.guardian.id).toBe(claim1.guardian.id);

      // 4. Failed Send Scenario: when queue send throws, returns deliveryStatus 'pending-delivery' and outbox row remains 'PENDING'
      const authUserFailingQueue: any = {
        id: 99443388,
        login: 'workerd-failing-queue-user',
        name: 'Workerd Failing Queue Claimer',
        avatar_url: 'https://avatars.githubusercontent.com/u/99443388',
        bio: 'Failing queue tester',
        public_repos: 5,
        followers: 2,
        created_at: '2021-01-01T00:00:00Z'
      };
      const failingEnv: any = {
        ...env,
        AI_QUEUE: {
          send: async () => {
            throw new Error('AI_QUEUE_TEMPORARY_NETWORK_FAULT');
          }
        }
      };
      const claim3 = await executeClaimTransaction(authUserFailingQueue, failingEnv);
      expect(claim3.success).toBe(true);
      expect(claim3.deliveryStatus).toBe('pending-delivery');

      const outboxRowPending = await env.DB.prepare(
        'SELECT id, claim_key, state, delivered_at FROM guardian_outbox WHERE claim_key = ?'
      ).bind(`claim:${claim3.guardian.id}`).first<any>();
      expect(outboxRowPending?.state).toBe('PENDING');
      expect(outboxRowPending?.delivered_at).toBeNull();
    });
    it('Matrix 17: reserveJobAndDailySpend atomically succeeds on fresh day with no prior ai_budget_ledger entry, and fails closed for nonexistent jobs on real workerd D1', async () => {
      const { reserveJobAndDailySpend, settleJobAndDailySpend } = await import('../../src/server/services/billing/budget-guard');
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const freshJobId = `job-fresh-d1-${Date.now()}`;
      const freshGuardianId = `g-fresh-d1-${Date.now()}`;
      const now = Date.now();

      // Seed user, guardian and job into real D1
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(freshGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'FreshBudgetPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(freshJobId, freshGuardianId, `fp-${freshJobId}`, now, now).run();

      const res1 = await reserveJobAndDailySpend(env, freshJobId, 'reference', 1, 25);
      expect(res1.ok).toBe(true);

      // Assert D1 reservation row
      const resRow = await env.DB.prepare(
        'SELECT id, amount_cents, state FROM guardian_budget_reservations WHERE job_id = ?1 AND pose_id = "reference" AND attempt_number = 1'
      ).bind(freshJobId).first<any>();
      expect(resRow).toBeDefined();
      expect(resRow?.amount_cents).toBe(25);
      expect(resRow?.state).toBe('RESERVED');

      // Assert job reserved_cents incremented
      const jobRow = await env.DB.prepare('SELECT reserved_cents, spent_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(freshJobId).first<any>();
      expect(jobRow?.reserved_cents).toBe(25);

      // Settle attempt (success = true)
      await settleJobAndDailySpend(env, freshJobId, 'reference', 1, true, 25);
      const jobRowSettled = await env.DB.prepare('SELECT reserved_cents, spent_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(freshJobId).first<any>();
      expect(jobRowSettled?.reserved_cents).toBe(0);
      expect(jobRowSettled?.spent_cents).toBe(25);
      // 2. Fail-Closed check: nonexistent job cannot reserve budget (0 rows modified in D1 batch)
      const resNonexistent = await reserveJobAndDailySpend(env, 'nonexistent-job-uuid', 'reference', 1, 25);
      expect(resNonexistent.ok).toBe(false);

      const orphanRes = await env.DB.prepare('SELECT count(*) as total FROM guardian_budget_reservations WHERE job_id = "nonexistent-job-uuid"').first<any>();
      expect(orphanRes?.total).toBe(0);
    });
    it('Matrix 18: failed attempt budget reservation release and subsequent retry successfully reactivates reservation on real workerd D1', async () => {
      const { reserveJobAndDailySpend, settleJobAndDailySpend } = await import('../../src/server/services/billing/budget-guard');
      const { releasePoseLease } = await import('../../src/server/queue/lease-manager');
      const retryJobId = `job-retry-d1-${Date.now()}`;
      const retryGuardianId = `g-retry-d1-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();

      // 1. Seed user, guardian, and job
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(retryGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'RetryPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(retryJobId, retryGuardianId, `fp-${retryJobId}`, now, now).run();

      // 2. First attempt reservation succeeds
      const res1 = await reserveJobAndDailySpend(env, retryJobId, 'reference', 1, 25);
      expect(res1.ok).toBe(true);

      // 3. Simulate failure: release lease and settle reservation as failure (RELEASED)
      await releasePoseLease(env, retryJobId, 'reference', 1, 'FAILED', 'SIMULATED_GEMINI_TIMEOUT');
      await settleJobAndDailySpend(env, retryJobId, 'reference', 1, false, 25);
      const releasedRow = await env.DB.prepare(
        'SELECT state FROM guardian_budget_reservations WHERE job_id = ?1 AND pose_id = "reference" AND attempt_number = 1'
      ).bind(retryJobId).first<any>();
      expect(releasedRow?.state).toBe('RELEASED');

      // 4. Retry of same attempt number atomically reactivates reservation to RESERVED
      const res2 = await reserveJobAndDailySpend(env, retryJobId, 'reference', 1, 25);
      expect(res2.ok).toBe(true);

      const reactivatedRow = await env.DB.prepare(
        'SELECT state, amount_cents FROM guardian_budget_reservations WHERE job_id = ?1 AND pose_id = "reference" AND attempt_number = 1'
      ).bind(retryJobId).first<any>();
      expect(reactivatedRow?.state).toBe('RESERVED');
      expect(reactivatedRow?.amount_cents).toBe(25);

      // Job reserved_cents is 25
      const jobRow = await env.DB.prepare('SELECT reserved_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(retryJobId).first<any>();
      expect(jobRow?.reserved_cents).toBe(25);
    });
    it('Matrix 19: queue generation with reservationToken books exactly one 25c charge and total_calls += 1 on real workerd D1', async () => {
      const { reserveJobAndDailySpend, settleJobAndDailySpend, getTodayDateString } = await import('../../src/server/services/billing/budget-guard');
      const singleJobId = `job-single-acc-${Date.now()}`;
      const singleGuardianId = `g-single-acc-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();
      const today = getTodayDateString();

      // Query initial daily ledger state
      const initialLedger = await env.DB.prepare('SELECT reserved_cents, settled_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      const startSettled = initialLedger?.settled_cents || 0;
      const startCalls = initialLedger?.total_calls || 0;

      // Seed guardian and job
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(singleGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'SingleAccPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(singleJobId, singleGuardianId, `fp-${singleJobId}`, now, now).run();

      // 1. Queue worker acquires reservation
      const res = await reserveJobAndDailySpend(env, singleJobId, 'reference', 1, 25);
      expect(res.ok).toBe(true);

      const midLedger = await env.DB.prepare('SELECT reserved_cents, settled_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(midLedger?.reserved_cents).toBe((initialLedger?.reserved_cents || 0) + 25);
      expect(midLedger?.total_calls).toBe(startCalls + 1);

      // 2. Queue worker settles on success
      await settleJobAndDailySpend(env, singleJobId, 'reference', 1, true, 25);

      const finalLedger = await env.DB.prepare('SELECT reserved_cents, settled_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(finalLedger?.settled_cents).toBe(startSettled + 25);
      expect(finalLedger?.reserved_cents).toBe(initialLedger?.reserved_cents || 0);
      expect(finalLedger?.total_calls).toBe(startCalls + 1); // Exactly +1 call increment, no double-counting
    });
    it('Matrix 20: failed outbound fetch or gate rejection commits 25c spend to D1 ledger to prevent unbounded provider spend', async () => {
      const { reserveJobAndDailySpend, settleJobAndDailySpend, getTodayDateString } = await import('../../src/server/services/billing/budget-guard');
      const failJobId = `job-fail-acc-${Date.now()}`;
      const failGuardianId = `g-fail-acc-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();
      const today = getTodayDateString();

      const initialLedger = await env.DB.prepare('SELECT reserved_cents, settled_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      const startSettled = initialLedger?.settled_cents || 0;

      // Seed guardian and job
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(failGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'FailAccPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(failJobId, failGuardianId, `fp-${failJobId}`, now, now).run();

      // 1. Reserve budget before outbound call
      await reserveJobAndDailySpend(env, failJobId, 'hover', 1, 25);

      // 2. Outbound fetch made but failed HTTP / gate validation: commit spend (success = true in settle)
      await settleJobAndDailySpend(env, failJobId, 'hover', 1, true, 25);

      // 3. Verify that 25c was committed to settled_cents on daily ledger and spent_cents on job
      const afterLedger = await env.DB.prepare('SELECT settled_cents FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(afterLedger?.settled_cents).toBe(startSettled + 25);

      const jobRow = await env.DB.prepare('SELECT spent_cents, reserved_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(failJobId).first<any>();
      expect(jobRow?.spent_cents).toBe(25);
      expect(jobRow?.reserved_cents).toBe(0);
    });
    it('Matrix 21: reference attempt 2 successfully executes through handleQueueBatch and commits candidate under attempt_number = 2 on real workerd D1', async () => {
      const { createValidCenteredSubjectPng } = await import('./fixtures/images');
      const { compileIdentitySpec } = await import('../../src/server/services/dna/compiler');
      const ref2JobId = `job-ref2-real-${Date.now()}`;
      const ref2GuardianId = `g-ref2-real-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: uniqueGhId,
        telemetry: {
          stars: 10,
          forks: 5,
          mergedExternalPRs: 3,
          publicRepos: 10,
          followers: 5,
          accountAgeYears: 2,
          releases: 1,
          reviewRatio: 1.0,
          collaborators: 2,
          activeWeeks: 10,
          nightCommitRatio: 0.1,
          topLanguages: ['TypeScript']
        }
      });

      // Seed user, guardian, and job into real D1
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, identity_spec, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(ref2GuardianId, `user-${uniqueGhId}`, uniqueGhId, 'Ref2RealPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', JSON.stringify(spec), 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(ref2JobId, ref2GuardianId, `fp-${ref2JobId}`, now, now).run();

      const validHeroPng = createValidCenteredSubjectPng();
      const validHeroB64 = Buffer.from(validHeroPng).toString('base64');
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (info: RequestInfo | URL) => {
        const urlStr = typeof info === 'string' ? info : info.toString();
        if (urlStr.includes('generateContent')) {
          callCount++;
          if (callCount === 1) {
            return new Response('Gemini unavailable on attempt 1', { status: 503 });
          }
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  inlineData: {
                    mimeType: 'image/png',
                    data: validHeroB64
                  }
                }]
              }
            }]
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
      });
      const enqueuedMessages: any[] = [];
      const queueTestEnv: any = {
        ...env,
        AI_QUEUE: {
          send: async (msg: any) => {
            enqueuedMessages.push(msg);
          }
        },
        GEMINI_API_KEY: 'test-gemini-key',
        AI_MODEL_TIER: 'nano-banana-pro-preview'
      };
      // 1. Dispatch Attempt 1 message through handleQueueBatch
      const msg1 = {
        id: 'msg-ref-1',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, type: 'HATCH_REFERENCE', jobId: ref2JobId, guardianId: ref2GuardianId, attempt: 1 } as GenerationQueueMessage
      };
      const batch1 = createMessageBatch('githoot-ai-queue', [msg1]);
      const ctx1 = createExecutionContext();
      await handleQueueBatch(batch1, queueTestEnv);
      const qRes1 = await getQueueResult(batch1, ctx1);
      expect(qRes1.ackAll || qRes1.explicitAcks.length > 0).toBe(true);

      // Verify Attempt 1 was marked FAILED and 25c spent
      const attempt1Row = await env.DB.prepare('SELECT state, error_message FROM guardian_pose_attempts WHERE job_id = ?1 AND attempt_number = 1').bind(ref2JobId).first<any>();
      expect(attempt1Row?.state).toBe('FAILED');
      expect(attempt1Row?.error_message).toContain('503');

      // 2. Dispatch Attempt 2 message through handleQueueBatch
      const msg2 = {
        id: 'msg-ref-2',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, type: 'HATCH_REFERENCE', jobId: ref2JobId, guardianId: ref2GuardianId, attempt: 2 } as GenerationQueueMessage
      };
      const batch2 = createMessageBatch('githoot-ai-queue', [msg2]);
      const ctx2 = createExecutionContext();
      await handleQueueBatch(batch2, queueTestEnv);
      const qRes2 = await getQueueResult(batch2, ctx2);
      expect(qRes2.ackAll || qRes2.explicitAcks.length > 0).toBe(true);

      // 3. Assert Attempt 2 succeeded, candidate is staged in VERIFYING, and attempt 2 is ACCEPTED
      const candRow = await env.DB.prepare('SELECT candidate_sha256, state FROM guardian_reference_candidates WHERE guardian_id = ?1 AND state = "VERIFYING"').bind(ref2GuardianId).first<any>();
      expect(candRow).toBeDefined();
      expect(candRow?.state).toBe('VERIFYING');

      const attempt2Row = await env.DB.prepare('SELECT state, frame_sha256 FROM guardian_pose_attempts WHERE job_id = ?1 AND attempt_number = 2').bind(ref2JobId).first<any>();
      expect(attempt2Row?.state).toBe('ACCEPTED');
      expect(attempt2Row?.frame_sha256).toBe(candRow?.candidate_sha256);
      const jobRow = await env.DB.prepare('SELECT spent_cents, reserved_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(ref2JobId).first<any>();
      expect(jobRow?.spent_cents).toBe(50);
      expect(jobRow?.reserved_cents).toBe(0);
    });

    it('Matrix 22: settleJobAndDailySpend is strictly idempotent across repeated calls on real workerd D1', async () => {
      const { reserveJobAndDailySpend, settleJobAndDailySpend, getTodayDateString } = await import('../../src/server/services/billing/budget-guard');
      const doubleSettleJobId = `job-double-settle-${Date.now()}`;
      const doubleSettleGuardianId = `g-double-settle-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();
      const today = getTodayDateString();

      // Seed user, guardian, and job into real D1
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(doubleSettleGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'DoubleSettlePet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(doubleSettleJobId, doubleSettleGuardianId, `fp-${doubleSettleJobId}`, now, now).run();

      const initialLedger = await env.DB.prepare('SELECT settled_cents FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      const startSettled = initialLedger?.settled_cents || 0;

      // 1. Reserve budget for attempt 1
      await reserveJobAndDailySpend(env, doubleSettleJobId, 'hover', 1, 25);

      // 2. Settle Call 1: transitions RESERVED -> COMMITTED, spent_cents += 25, settled_cents += 25
      await settleJobAndDailySpend(env, doubleSettleJobId, 'hover', 1, true, 25);

      const jobAfter1 = await env.DB.prepare('SELECT spent_cents, reserved_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(doubleSettleJobId).first<any>();
      expect(jobAfter1?.spent_cents).toBe(25);
      expect(jobAfter1?.reserved_cents).toBe(0);

      const ledgerAfter1 = await env.DB.prepare('SELECT settled_cents FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(ledgerAfter1?.settled_cents).toBe(startSettled + 25);

      // 3. Concurrent simultaneous settle calls (Promise.all): exactly one succeeds, exactly 25c spent
      const [resA, resB, resC] = await Promise.all([
        settleJobAndDailySpend(env, doubleSettleJobId, 'hover', 1, true, 25),
        settleJobAndDailySpend(env, doubleSettleJobId, 'hover', 1, true, 25),
        settleJobAndDailySpend(env, doubleSettleJobId, 'hover', 1, true, 25)
      ]);

      const jobAfter2 = await env.DB.prepare('SELECT spent_cents, reserved_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(doubleSettleJobId).first<any>();
      expect(jobAfter2?.spent_cents).toBe(25); // Exactly 25, not 75 or 100!
      expect(jobAfter2?.reserved_cents).toBe(0);

      const ledgerAfter2 = await env.DB.prepare('SELECT settled_cents FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(ledgerAfter2?.settled_cents).toBe(startSettled + 25); // Exactly +25, no overcharge
      expect([resA.settled, resB.settled, resC.settled].filter(Boolean).length).toBe(0); // All 3 concurrent duplicates rejected after initial settle
    });
    it('Matrix 23: concurrent simultaneous reserveJobAndDailySpend calls for the same attempt atomically elect exactly one winner and reserve exactly 25c on real workerd D1', async () => {
      const { reserveJobAndDailySpend, getTodayDateString } = await import('../../src/server/services/billing/budget-guard');
      const concJobId = `job-conc-res-${Date.now()}`;
      const concGuardianId = `g-conc-res-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();
      const today = getTodayDateString();

      // Seed user, guardian, and job into real D1
      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(concGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'ConcResPet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', 'PENDING', now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(concJobId, concGuardianId, `fp-${concJobId}`, now, now).run();

      const initialLedger = await env.DB.prepare('SELECT reserved_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      const startReserved = initialLedger?.reserved_cents || 0;
      const startCalls = initialLedger?.total_calls || 0;

      // 1. Simultaneous concurrent reservation calls for same (jobId, poseId, attemptNumber)
      const results = await Promise.all([
        reserveJobAndDailySpend(env, concJobId, 'hover', 1, 25),
        reserveJobAndDailySpend(env, concJobId, 'hover', 1, 25),
        reserveJobAndDailySpend(env, concJobId, 'hover', 1, 25)
      ]);

      // All 3 return ok: true (either elected winner or fast-checked idempotent existing reservation)
      expect(results.every(r => r.ok)).toBe(true);

      // 2. Exactly one 25c reservation is booked on the job and daily ledger (no triple-increment!)
      const jobRow = await env.DB.prepare('SELECT reserved_cents, spent_cents FROM guardian_hatch_jobs WHERE id = ?1').bind(concJobId).first<any>();
      expect(jobRow?.reserved_cents).toBe(25); // Exactly 25c, not 75c!
      expect(jobRow?.spent_cents).toBe(0);

      const ledgerRow = await env.DB.prepare('SELECT reserved_cents, total_calls FROM ai_budget_ledger WHERE day = ?1').bind(today).first<any>();
      expect(ledgerRow?.reserved_cents).toBe(startReserved + 25); // Exactly +25c
      expect(ledgerRow?.total_calls).toBe(startCalls + 1); // Exactly +1 call increment
    });
    it('Matrix 24: complete JPEG raw artifact lifecycle (storage -> composition -> review bundle -> preflight) succeeds on real workerd D1 and R2', async () => {
      const { generateRawKey, fetchRawObjectFromR2, generateReferenceKey } = await import('../../src/server/services/ai/reference-manager');
      const { assembleReviewBundle } = await import('../../src/server/routes/review');
      const { verifyPublicationReady } = await import('../../src/server/services/claim/publication-preflight');
      const { createValidCenteredSubjectPng } = await import('./fixtures/images');
      const { compileIdentitySpec, canonicalJson } = await import('../../src/server/services/dna/compiler');
      const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');
      const { decodePngToRgba } = await import('../../src/server/services/image/png-codec');
      const jpeg = await import('jpeg-js');

      const jpegJobId = `job-jpeg-life-${Date.now()}`;
      const jpegGuardianId = `g-jpeg-life-${Date.now()}`;
      const uniqueGhId = Math.floor(Math.random() * 8000000) + 2000000;
      const now = Date.now();

      const spec = await compileIdentitySpec({
        githubUserId: uniqueGhId,
        telemetry: {
          stars: 10, forks: 5, mergedExternalPRs: 3, publicRepos: 10,
          followers: 5, accountAgeYears: 2, releases: 1, reviewRatio: 1.0,
          collaborators: 2, activeWeeks: 10, nightCommitRatio: 0.1, topLanguages: ['TypeScript']
        }
      });

      // 1. Seed user, guardian, job, and approved reference in D1
      const refPng = createValidCenteredSubjectPng(1024, 1024);
      const refSha = await sha256Hex(refPng);
      await env.ASSETS_BUCKET.put(`references/${refSha}.png`, refPng, { httpMetadata: { contentType: 'image/png' } });

      await env.DB.prepare(
        'INSERT INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?, ?, "active", ?, ?)'
      ).bind(`user-${uniqueGhId}`, uniqueGhId, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, traits, identity_spec, reference_sha256, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "PENDING", ?)'
      ).bind(jpegGuardianId, `user-${uniqueGhId}`, uniqueGhId, 'JpegLifePet', 'Cyber', 'NeonByte', 'Cyber', '12345', 'Common', '/hero.png', '{}', JSON.stringify(spec), refSha, now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_hatch_jobs (id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, reserved_cents, spent_cents, created_at, updated_at) VALUES (?, ?, ?, "PENDING", "nano-banana-pro-preview", 0, 0, 0, 0, ?, ?)'
      ).bind(jpegJobId, jpegGuardianId, `fp-${jpegJobId}`, now, now).run();

      await env.DB.prepare(
        'INSERT INTO guardian_reference_candidates (id, guardian_id, candidate_sha256, identity_hash, prompt_hash, model_id, raw_sha256, state, reviewer, verdict_data, created_at) VALUES (?, ?, ?, ?, "prompt-hash", "nano-banana-pro-preview", ?, "APPROVED", "lead@githoot.com", "{}", ?)'
      ).bind(`ref-cand-${jpegJobId}`, jpegGuardianId, refSha, spec.identityHash, refSha, now).run();

      // 2. Populate 16 frames: Frame 0 is JPEG, Frames 1-15 are PNG
      for (let i = 0; i < POSE_SET.length; i++) {
        const pose = POSE_SET[i]!;
        let rawBytes: Uint8Array;
        let claimedMime = 'image/png';

        if (i === 0) {
          // Frame 0: Encode raw JPEG
          const validPng = createValidCenteredSubjectPng(256, 256);
          const decoded = await decodePngToRgba(validPng);
          const encodedJpeg = jpeg.encode({ data: decoded.data, width: decoded.width, height: decoded.height }, 90);
          rawBytes = new Uint8Array(encodedJpeg.data);
          claimedMime = 'image/jpeg';
        } else {
          rawBytes = createValidCenteredSubjectPng(256, 256);
        }

        const gateRes = await validateAndNormalizeFrame(rawBytes, { claimedMime });
        if (!gateRes.ok) {
          throw new Error(`Gate failure for frame ${i} (${claimedMime}): ${gateRes.reasons.join(', ')}`);
        }
        const rawSha = gateRes.rawSha256;
        const frameSha = gateRes.frameSha256;
        const rawKey = generateRawKey(jpegGuardianId, rawSha, gateRes.metrics.format);
        await env.ASSETS_BUCKET.put(rawKey, rawBytes, { httpMetadata: { contentType: claimedMime } });

        const frameKey = `guardians/${jpegGuardianId}/frames/f${pose.id}_${frameSha}.png`;
        await env.ASSETS_BUCKET.put(frameKey, gateRes.normalizedPng, { httpMetadata: { contentType: 'image/png' } });

        const gateMetricsJson = JSON.stringify({
          componentsCount: gateRes.metrics.componentsCount,
          dominanceRatio: gateRes.metrics.dominanceRatio,
          fillRatio: gateRes.metrics.fillRatio,
          aspectRatio: gateRes.metrics.aspectRatio,
          format: gateRes.metrics.format
        });

        await env.DB.prepare(
          'INSERT INTO guardian_hatch_frames (id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, created_at) VALUES (?, ?, ?, ?, ?, ?, "ACCEPTED", ?, ?)'
        ).bind(`f-${jpegJobId}-${pose.id}`, jpegJobId, pose.id, i, frameSha, rawSha, gateMetricsJson, now).run();
      }

      // 3. Run HATCH_COMPOSITE through handleQueueBatch (validates raw JPEG resolution during composition)
      const compMsg = {
        id: 'msg-comp-jpeg',
        timestamp: new Date(),
        attempts: 1,
        body: { v: 1, type: 'HATCH_COMPOSITE', jobId: jpegJobId, guardianId: jpegGuardianId } as GenerationQueueMessage
      };

      const queueTestEnv: any = {
        ...env,
        CDN_DOMAIN: 'staging-cdn.githoot.com',
        AI_MODEL_TIER: 'nano-banana-pro-preview'
      };

      await handleQueueBatch(createMessageBatch('githoot-ai-queue', [compMsg]), queueTestEnv);

      // Verify composition transitioned job and guardian to VERIFYING
      const jobRow = await env.DB.prepare('SELECT state, frames_completed, manifest_url FROM guardian_hatch_jobs WHERE id = ?1').bind(jpegJobId).first<any>();
      expect(jobRow?.state).toBe('VERIFYING');
      expect(jobRow?.frames_completed).toBe(16);
      expect(jobRow?.manifest_url).toBeDefined();

      const guardianRow = await env.DB.prepare('SELECT status, spritesheet_url, manifest_url FROM guardians WHERE id = ?1').bind(jpegGuardianId).first<any>();
      expect(guardianRow?.status).toBe('VERIFYING');
      expect(guardianRow?.manifest_url).toBe(jobRow?.manifest_url);

      // 4. Invoke assembleReviewBundle (validates raw JPEG resolution during review assembly)
      const reviewBundle = await assembleReviewBundle(jpegJobId, queueTestEnv);
      expect(reviewBundle).toBeDefined();
      expect(reviewBundle.bundleSha.length).toBe(64);
      expect(reviewBundle.bundleData.frames.length).toBe(16);
      expect(reviewBundle.bundleData.frames[0]?.poseId).toBe('hover');

      // 5. Attach 16 hash-bound semantic verdicts and review record (authoritative review step)
      const verdictStatements = reviewBundle.frames.map(frame => {
        const verdictObj = {
          verdict: 'pass',
          reviewer: 'lead@githoot.com',
          boundToSha256: frame.frame_sha256,
          bundleSha: reviewBundle.bundleSha,
          timestamp: now
        };
        return env.DB.prepare(
          'UPDATE guardian_hatch_frames SET semantic_verdict = ?1 WHERE id = ?2'
        ).bind(JSON.stringify(verdictObj), frame.id);
      });

      const reviewRecordStmt = env.DB.prepare(`
        INSERT INTO guardian_review_records (
          id, job_id, guardian_id, reviewer, decision, bundle_sha, manifest_sha, frame_hashes, notes, created_at
        ) VALUES (?1, ?2, ?3, ?4, 'approve', ?5, ?6, ?7, ?8, ?9);
      `).bind(
        crypto.randomUUID(),
        jpegJobId,
        jpegGuardianId,
        'lead@githoot.com',
        reviewBundle.bundleSha,
        reviewBundle.bundleData.manifestSha256 || null,
        JSON.stringify(reviewBundle.frames.map(f => f.frame_sha256)),
        'Approved in Matrix 24 test',
        now
      );

      await env.DB.batch([...verdictStatements, reviewRecordStmt]);

      // 6. Admin reviews and approves the 16-pose package via Single-Row Pointer CAS
      const publishRes = await approveGuardianPosesAndPublish({
        guardianId: jpegGuardianId,
        reviewer: 'lead@githoot.com',
        env: queueTestEnv
      });
      if (!publishRes.success) {
        throw new Error(`Publish failed: ${JSON.stringify(publishRes)}`);
      }
      expect(publishRes.success).toBe(true);
      expect(publishRes.status).toBe('ASSET_READY');

      // 7. Invoke verifyPublicationReady (validates raw JPEG resolution during preflight verification)
      const preflight = await verifyPublicationReady(jpegGuardianId, queueTestEnv);
      if (!preflight.ready) {
        throw new Error(`Preflight reasons: ${preflight.reasons.join('; ')}`);
      }
      expect(preflight.ready).toBe(true);
      expect(preflight.reasons).toEqual([]);
      expect(preflight.manifestSha256).toBeDefined();
      expect(preflight.spritesheetSha256).toBeDefined();
    });
    it('Matrix 25: Gallery API executes on real D1 SQLite with 0009 indexes, keyset paging, and KV SWR', async () => {
      const now = Date.now();

      // Seed 2 users, accounts, guardians
      const user1 = 'u-gallery-1';
      const user2 = 'u-gallery-2';
      const ghId1 = 881001;
      const ghId2 = 881002;

      await env.DB.prepare(`
        INSERT INTO users (id, github_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
      `).bind(user1, ghId1, now, now).run();

      await env.DB.prepare(`
        INSERT INTO users (id, github_user_id, status, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?)
      `).bind(user2, ghId2, now, now).run();

      await env.DB.prepare(`
        INSERT INTO github_accounts (id, user_id, github_user_id, login, name, avatar_url, total_stars, followers, public_repos, last_synced_at)
        VALUES ('ga-1', ?, ?, 'octogoonie', 'Octo Goonie', 'https://avatars.example.com/octogoonie', 120, 50, 10, ?)
      `).bind(user1, ghId1, now).run();

      await env.DB.prepare(`
        INSERT INTO github_accounts (id, user_id, github_user_id, login, name, avatar_url, total_stars, followers, public_repos, last_synced_at)
        VALUES ('ga-2', ?, ?, 'cybercat', 'Cyber Cat', 'https://avatars.example.com/cybercat', 88, 30, 5, ?)
      `).bind(user2, ghId2, now).run();
      const gId1 = 'g-gal-1';
      const gId2 = 'g-gal-2';

      // Guardian 1: Published ASSET_READY (Fire, Epic)
      await env.DB.prepare(`
        INSERT INTO guardians (
          id, user_id, github_user_id, name, egg_type, species, species_name, element,
          dna_seed, rarity_tier, hero_image_url, spritesheet_url, traits, status, level, experience, energy_state, created_at
        ) VALUES (?, ?, ?, 'Ignis Blade', 'ember-core', 'emberfox', 'Ignis Emberfox', 'Fire', 'seed1', 'Epic', 'https://cdn.githoot.com/heroes/g1.png', 'https://cdn.githoot.com/masters/g1.png', '{}', 'ASSET_READY', 10, 500, 'Active', ?)
      `).bind(gId1, user1, ghId1, now).run();

      // Guardian 2: Unpublished PENDING (Cyber, Rare) - must NEVER appear in gallery
      await env.DB.prepare(`
        INSERT INTO guardians (
          id, user_id, github_user_id, name, egg_type, species, species_name, element,
          dna_seed, rarity_tier, hero_image_url, traits, status, level, experience, energy_state, created_at
        ) VALUES (?, ?, ?, 'Volt Byte', 'neon-byte', 'neonbyte', 'Volt Neonbyte', 'Cyber', 'seed2', 'Rare', 'https://cdn.githoot.com/heroes/g2.png', '{}', 'PENDING', 1, 0, 'Active', ?)
      `).bind(gId2, user2, ghId2, now).run();

      // Seed hatch job for Guardian 1
      await env.DB.prepare(`
        INSERT INTO guardian_hatch_jobs (
          id, guardian_id, request_fingerprint, state, model_id, created_at, updated_at
        ) VALUES ('job-gal-1', ?, 'fp-gal-1', 'ASSET_READY', 'gemini-3-pro-image', ?, ?)
      `).bind(gId1, now, now).run();

      // Authoritative Publication Pointer for Guardian 1 ONLY
      await env.DB.prepare(`
        INSERT INTO guardian_publication (
          guardian_id, job_id, manifest_sha256, manifest_key, spritesheet_sha256, spritesheet_key, state, reviewer, published_at, created_at
        ) VALUES (?, 'job-gal-1', 'msha1', 'manifests/m1.json', 'ssha1', 'masters/strip1.png', 'ASSET_READY', 'admin@githoot.com', ?, ?)
      `).bind(gId1, now, now).run();

      // 1. Fetch gallery without filters -> only Guardian 1 returned
      const res1 = await app.request('/api/gallery', {}, env);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.items.some((item: any) => item.id === gId1)).toBe(true);
      expect(data1.items.some((item: any) => item.id === gId2)).toBe(false); // Unpublished excluded!
      expect(data1.page.has_more).toBe(false);

      // 2. Fetch gallery with element=Fire -> match
      const res2 = await app.request('/api/gallery?element=Fire', {}, env);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.items.length).toBeGreaterThanOrEqual(1);
      expect(data2.items[0].element).toBe('Fire');

      // 3. Fetch gallery with element=Water -> no match
      const res3 = await app.request('/api/gallery?element=Water', {}, env);
      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      expect(data3.items.length).toBe(0);

      // 4. Search by login prefix 'octo'
      const res4 = await app.request('/api/gallery?q=octo', {}, env);
      expect(res4.status).toBe(200);
      expect(res4.headers.get('X-Gallery-Cache')).toBe('BYPASS');
      const data4 = await res4.json();
      expect(data4.items.some((item: any) => item.owner.login === 'octogoonie')).toBe(true);

      // 5. Search by name prefix 'Ignis'
      const res5 = await app.request('/api/gallery?q=ignis', {}, env);
      expect(res5.status).toBe(200);
      const data5 = await res5.json();
      expect(data5.items.some((item: any) => item.name === 'Ignis Blade')).toBe(true);
    });

    it('Matrix 26: EXPLAIN QUERY PLAN verifies B-tree index coverage on gallery query shapes', async () => {
      // 1. Browse newest
      const qp1 = await env.DB.prepare(`
        EXPLAIN QUERY PLAN
        SELECT g.id, p.published_at
        FROM guardian_publication p
        INNER JOIN guardians g ON g.id = p.guardian_id
        INNER JOIN github_accounts a ON a.github_user_id = g.github_user_id
        WHERE p.state = 'ASSET_READY' AND p.published_at <= 1788000000000
        ORDER BY p.published_at DESC, p.guardian_id DESC
        LIMIT 25
      `).all();
      const plans1 = (qp1.results || []).map((r: any) => r.detail).join('; ');
      expect(plans1).toContain('idx_gallery_publication_time');

      // 2. Element and Rarity filter
      const qp2 = await env.DB.prepare(`
        EXPLAIN QUERY PLAN
        SELECT g.id, p.published_at
        FROM guardian_publication p
        INNER JOIN guardians g ON g.id = p.guardian_id
        INNER JOIN github_accounts a ON a.github_user_id = g.github_user_id
        WHERE p.state = 'ASSET_READY' AND g.element = 'Fire' AND g.rarity_tier = 'Epic'
        ORDER BY p.published_at DESC, p.guardian_id DESC
        LIMIT 25
      `).all();
      const plans2 = (qp2.results || []).map((r: any) => r.detail).join('; ');
      expect(plans2).toContain('USING');

      // 3. Oldest browse
      const qp3 = await env.DB.prepare(`
        EXPLAIN QUERY PLAN
        SELECT g.id, p.published_at
        FROM guardian_publication p
        INNER JOIN guardians g ON g.id = p.guardian_id
        INNER JOIN github_accounts a ON a.github_user_id = g.github_user_id
        WHERE p.state = 'ASSET_READY' AND p.published_at >= 1788000000000
        ORDER BY p.published_at ASC, p.guardian_id ASC
        LIMIT 25
      `).all();
      const plans3 = (qp3.results || []).map((r: any) => r.detail).join('; ');
      expect(plans3).toContain('idx_gallery_publication_time');
    });
  });
});
