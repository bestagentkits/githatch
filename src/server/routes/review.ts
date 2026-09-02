// ============================================================================
// GitHoot In-Repo Admin Review Routes (src/server/routes/review.ts)
// Cloudflare Access-Protected Review Surface, Bundle SHA & Reviewer Provenance
// ============================================================================

import { Hono } from 'hono';
import type { Env, HatchJobRecord, HatchFrameRecord } from '../types';
import { verifyReviewerAuthorization } from '../services/auth/admin-auth';
import { approveGuardianPosesAndPublish } from '../services/ai/hatch-admin';
import { fetchRawObjectFromR2 } from '../services/ai/reference-manager';
import { canonicalJson } from '../services/dna/compiler';
import { sha256Hex } from '../services/crypto/web-crypto';

export const reviewRouter = new Hono<{ Bindings: Env }>();

export interface ReviewBundleFrame {
  poseId: string;
  poseIndex: number;
  frameSha256: string;
  rawSha256: string;
  url: string;
}

export interface ReviewBundleData {
  jobId: string;
  guardianId: string;
  guardianName: string;
  species: string;
  element: string;
  rarity: string;
  referenceSha256: string;
  referenceUrl: string;
  manifestSha256: string;
  manifestKey: string;
  manifestUrl: string;
  frames: ReviewBundleFrame[];
}

export interface ReviewBundleAssembly {
  bundleData: ReviewBundleData;
  bundleSha: string;
  job: HatchJobRecord;
  guardian: {
    id: string;
    name: string;
    species: string;
    element: string;
    rarity_tier: string;
    status: string;
    reference_sha256: string;
  };
  frames: HatchFrameRecord[];
}

/**
 * Builds the canonical review bundle payload from D1 and R2 state.
 */
export async function assembleReviewBundle(
  jobId: string,
  env: Env
): Promise<ReviewBundleAssembly> {
  const job = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_jobs WHERE id = ?1'
  ).bind(jobId).first<HatchJobRecord>();

  if (!job) {
    throw new Error(`Hatch job ${jobId} not found`);
  }

  const guardian = await env.DB.prepare(
    'SELECT id, name, species, element, rarity_tier, status, reference_sha256, identity_spec FROM guardians WHERE id = ?1'
  ).bind(job.guardian_id).first<{
    id: string;
    name: string;
    species: string;
    element: string;
    rarity_tier: string;
    status: string;
    reference_sha256: string | null;
    identity_spec: string;
  }>();

  if (!guardian) {
    throw new Error(`Guardian ${job.guardian_id} not found`);
  }

  if (job.state !== 'VERIFYING' || guardian.status !== 'VERIFYING') {
    throw new Error(`Job is currently in "${job.state}" state (must be in "VERIFYING" state for review).`);
  }

  if (!guardian.reference_sha256) {
    throw new Error('Guardian reference hero frame is missing from D1');
  }

  const framesRes = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_frames WHERE job_id = ?1 ORDER BY pose_index ASC'
  ).bind(jobId).all<HatchFrameRecord>();

  const frames = framesRes.results || [];
  if (frames.length !== 16) {
    throw new Error(`Incomplete frames for review: ${frames.length}/16 found`);
  }

  const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';
  // 1. Verify Reference Hero Image on R2
  const refKey = `references/${guardian.reference_sha256}.png`;
  const refObj = await env.ASSETS_BUCKET.get(refKey);
  if (!refObj) {
    throw new Error(`Reference hero image missing from R2: ${refKey}`);
  }
  const refBuf = new Uint8Array(await refObj.arrayBuffer());
  const actualRefSha = await sha256Hex(refBuf);
  if (actualRefSha !== guardian.reference_sha256) {
    throw new Error(`Reference image SHA mismatch: expected ${guardian.reference_sha256}, got ${actualRefSha}`);
  }

  // 2. Verify all 16 Raw & Normalized Frame Objects on R2
  for (const f of frames) {
    const rawResult = await fetchRawObjectFromR2(env.ASSETS_BUCKET, guardian.id, f.raw_sha256);
    if (!rawResult) {
      throw new Error(`Raw frame image missing from R2 for frame f${f.pose_id} (SHA: ${f.raw_sha256})`);
    }
    const rawBuf = new Uint8Array(await rawResult.object.arrayBuffer());
    const actualRawSha = await sha256Hex(rawBuf);
    if (actualRawSha !== f.raw_sha256) {
      throw new Error(`Raw frame ${f.pose_id} SHA mismatch: expected ${f.raw_sha256}, got ${actualRawSha}`);
    }

    const frameKey = `guardians/${guardian.id}/frames/f${f.pose_id}_${f.frame_sha256}.png`;
    const fObj = await env.ASSETS_BUCKET.get(frameKey);
    if (!fObj) {
      throw new Error(`Normalized frame image missing from R2: ${frameKey}`);
    }
    const fBuf = new Uint8Array(await fObj.arrayBuffer());
    const actualFrameSha = await sha256Hex(fBuf);
    if (actualFrameSha !== f.frame_sha256) {
      throw new Error(`Normalized frame ${f.pose_id} SHA mismatch: expected ${f.frame_sha256}, got ${actualFrameSha}`);
    }
  }

  // 3. Resolve manifest key and verify its authoritative SHA-256 on R2
  let manifestKey = '';
  if (job.manifest_url) {
    try {
      manifestKey = new URL(job.manifest_url).pathname.replace(/^\/+/, '');
    } catch {
      manifestKey = job.manifest_url.replace(/^\/+/, '');
    }
  }
  if (!manifestKey) {
    manifestKey = `guardians/${job.guardian_id}/manifest.json`;
  }

  const manifestObj = await env.ASSETS_BUCKET.get(manifestKey);
  if (!manifestObj) {
    throw new Error(`Manifest object missing from R2: ${manifestKey}`);
  }
  const manifestBuf = new Uint8Array(await manifestObj.arrayBuffer());
  const manifestSha256 = await sha256Hex(manifestBuf);

  if (manifestKey.startsWith('manifests/')) {
    const expectedKey = `manifests/${manifestSha256}.json`;
    if (manifestKey !== expectedKey) {
      throw new Error(`Content-addressed manifest key mismatch: expected ${expectedKey}, got ${manifestKey}`);
    }
  }
  const bundleData: ReviewBundleData = {
    jobId: job.id,
    guardianId: guardian.id,
    guardianName: guardian.name,
    species: guardian.species,
    element: guardian.element,
    rarity: guardian.rarity_tier,
    referenceSha256: guardian.reference_sha256,
    referenceUrl: `https://${cdnHost}/references/${guardian.reference_sha256}.png`,
    manifestSha256,
    manifestKey,
    manifestUrl: `https://${cdnHost}/${manifestKey}`,
    frames: frames.map(f => ({
      poseId: f.pose_id,
      poseIndex: f.pose_index,
      frameSha256: f.frame_sha256,
      rawSha256: f.raw_sha256,
      url: `https://${cdnHost}/guardians/${guardian.id}/frames/f${f.pose_id}_${f.frame_sha256}.png`
    }))
  };

  const canonicalBundleJson = canonicalJson(bundleData);
  const bundleSha = await sha256Hex(canonicalBundleJson);

  return {
    bundleData,
    bundleSha,
    job,
    guardian: guardian as any,
    frames
  };
}

/**
 * GET /auth/admin/review/:jobId
 * Returns the immutable review bundle (16 candidate frames + reference URL, each SHA-256, plus bundleSha)
 * while the job is held in VERIFYING state.
 */
reviewRouter.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!jobId) {
    return c.json({ error: 'Missing jobId parameter' }, 400);
  }

  try {
    await verifyReviewerAuthorization(c.req.raw.headers, c.env);
  } catch (authErr) {
    return c.json({ error: (authErr as Error).message }, 401);
  }

  try {
    const { bundleData, bundleSha } = await assembleReviewBundle(jobId, c.env);
    return c.json({
      ...bundleData,
      bundleSha
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/**
 * POST /auth/admin/review/:jobId
 * Requires shown bundleSha in request body, recomputes current bundleSha, enforces exact match,
 * records an immutable review record in guardian_review_records with exact manifestSha, and executes pointer CAS on approve.
 */
reviewRouter.post('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  if (!jobId) {
    return c.json({ error: 'Missing jobId parameter' }, 400);
  }

  let principal: { reviewerId: string; email: string };
  try {
    principal = await verifyReviewerAuthorization(c.req.raw.headers, c.env);
  } catch (authErr) {
    return c.json({ error: (authErr as Error).message }, 401);
  }

  let body: { decision?: string; bundleSha?: string; notes?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const decision = body.decision?.toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') {
    return c.json({ error: 'Body field "decision" must be "approve" or "reject"' }, 400);
  }

  if (!body.bundleSha || typeof body.bundleSha !== 'string') {
    return c.json({ error: 'Missing required "bundleSha" in review request body' }, 400);
  }

  // 1. Recompute current bundleSha from live state
  let assembled: ReviewBundleAssembly;
  try {
    assembled = await assembleReviewBundle(jobId, c.env);
  } catch (assembleErr) {
    return c.json({ error: (assembleErr as Error).message }, 400);
  }

  if (body.bundleSha !== assembled.bundleSha) {
    return c.json({
      error: `BUNDLE_SHA_MISMATCH: Provided bundleSha "${body.bundleSha}" does not match server-recomputed bundleSha "${assembled.bundleSha}"`,
      expectedBundleSha: assembled.bundleSha
    }, 400);
  }

  const now = Date.now();
  const reviewRecordId = crypto.randomUUID();
  const frameHashesJson = JSON.stringify(assembled.frames.map(f => f.frame_sha256));

  if (decision === 'reject') {
    const errorReason = body.notes ? `REJECTED_BY_REVIEWER: ${body.notes}` : `REJECTED_BY_REVIEWER: Rejected by ${principal.email}`;

    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO guardian_review_records (
          id, job_id, guardian_id, reviewer, decision, bundle_sha, manifest_sha, frame_hashes, notes, created_at
        ) VALUES (?1, ?2, ?3, ?4, 'reject', ?5, NULL, ?6, ?7, ?8);
      `).bind(reviewRecordId, jobId, assembled.job.guardian_id, principal.email, assembled.bundleSha, frameHashesJson, body.notes || null, now),

      c.env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(assembled.job.guardian_id),
      c.env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?1, updated_at = ?2 WHERE id = ?3')
        .bind(errorReason, now, jobId)
    ]);

    return c.json({
      success: true,
      status: 'QUARANTINED',
      message: 'Job quarantined by reviewer.',
      bundleSha: assembled.bundleSha
    });
  }

  // Decision === 'approve'
  try {
    // 1. ATOMIC REVIEW TRANSACTION:
    // Attach 16 hash-bound verdicts in D1 and write immutable review record in one single batch
    const verdictStatements = assembled.frames.map(frame => {
      const verdictObj = {
        verdict: 'pass',
        reviewer: principal.email || principal.reviewerId,
        boundToSha256: frame.frame_sha256,
        bundleSha: assembled.bundleSha,
        timestamp: now
      };
      return c.env.DB.prepare(
        'UPDATE guardian_hatch_frames SET semantic_verdict = ?1 WHERE id = ?2'
      ).bind(JSON.stringify(verdictObj), frame.id);
    });

    const reviewRecordStmt = c.env.DB.prepare(`
      INSERT INTO guardian_review_records (
        id, job_id, guardian_id, reviewer, decision, bundle_sha, manifest_sha, frame_hashes, notes, created_at
      ) VALUES (?1, ?2, ?3, ?4, 'approve', ?5, ?6, ?7, ?8, ?9);
    `).bind(
      reviewRecordId,
      jobId,
      assembled.job.guardian_id,
      principal.email,
      assembled.bundleSha,
      assembled.bundleData.manifestSha256 || null,
      frameHashesJson,
      body.notes || null,
      now
    );

    await c.env.DB.batch([...verdictStatements, reviewRecordStmt]);

    // 2. Publish via Single-Row Pointer CAS
    const publishResult = await approveGuardianPosesAndPublish({
      guardianId: assembled.job.guardian_id,
      reviewer: principal.email || principal.reviewerId,
      verdict: 'pass',
      env: c.env
    });

    if (!publishResult.success) {
      return c.json({
        success: false,
        status: publishResult.status,
        reasons: publishResult.reasons,
        error: publishResult.error
      }, publishResult.status === 'CONFLICT' ? 409 : 400);
    }

    return c.json({
      success: true,
      status: 'ASSET_READY',
      manifestUrl: publishResult.manifestUrl,
      bundleSha: assembled.bundleSha
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});
reviewRouter.post('/:jobId/composite', async (c) => {
  const jobId = c.req.param('jobId');
  try {
    await verifyReviewerAuthorization(c.req.raw.headers, c.env);
  } catch (authErr) {
    return c.json({ error: (authErr as Error).message }, 401);
  }

  const job = await c.env.DB.prepare('SELECT * FROM guardian_hatch_jobs WHERE id = ?1').bind(jobId).first<HatchJobRecord>();
  if (!job) {
    return c.json({ error: `Job ${jobId} not found` }, 404);
  }

  const { handleHatchComposite } = await import('../queue/generation-worker');
  const dummyMsg = {
    id: `comp-admin-${Date.now()}`,
    timestamp: new Date(),
    body: { v: 1, type: 'HATCH_COMPOSITE', jobId, guardianId: job.guardian_id },
    ack: () => {},
    retry: () => {}
  } as unknown as Message<unknown>;

  try {
    await handleHatchComposite({ v: 1, type: 'HATCH_COMPOSITE', jobId, guardianId: job.guardian_id }, c.env, dummyMsg);
    const updatedJob = await c.env.DB.prepare('SELECT state, frames_completed, manifest_url FROM guardian_hatch_jobs WHERE id = ?1').bind(jobId).first();
    return c.json({ success: true, job: updatedJob });
  } catch (err: unknown) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
