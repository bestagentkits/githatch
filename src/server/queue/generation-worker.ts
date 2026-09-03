// ============================================================================
// GitHoot Background AI Generation Queue Worker (src/server/queue/generation-worker.ts)
// ============================================================================

import type { Env, IdentitySpec, HatchJobRecord, HatchFrameRecord } from '../types';
import {
  MODEL_ALLOWLIST,
  POSE_SET,
  FRAME,
  GATES,
  VERSIONS,
  type PoseDefinition
} from '../services/dna/contracts';
import {
  compileAllPosePrompts,
  compileReferencePrompt,
  validateIdentitySpec
} from '../services/dna/compiler';
import { generatePoseWithGemini } from '../services/ai/gemini-client';
import {
  generateReferenceKey,
  generateCandidateKey,
  fetchRawObjectFromR2
} from '../services/ai/reference-manager';
import {
  compositeLandingSheetAndStrip
} from '../services/image/landing-compositor';
import { encodeRgbaToPng, decodePngToRgba } from '../services/image/png-codec';
import { encodeRgbaToWebp } from '../services/image/webp-encoder';
import { validateAndNormalizeFrame } from '../services/image/frame-gate';
import { ensurePngBytes } from '../services/image/jpeg-decoder';
import { deleteProfileCacheKeys } from '../services/github/cache-keys';
import { sha256Hex } from '../services/crypto/web-crypto';
import {
  parseQueueMessage,
  type GenerationQueueMessage,
  type HatchReferenceMessage,
  type HatchPoseMessage,
  type HatchCompositeMessage,
  type RevalidateProfileMessage
} from './message-schema';

export type { GenerationQueueMessage };

import {
  acquirePoseLease,
  commitPoseLease,
  releasePoseLease
} from './lease-manager';
import {
  reserveJobAndDailySpend,
  settleJobAndDailySpend
} from '../services/billing/budget-guard';
import { writeOutboxMessage } from './outbox';

export function isModelAllowlisted(modelId: string): boolean {
  return MODEL_ALLOWLIST.includes(modelId);
}

export function filterMissingPoses(
  allPoses: readonly PoseDefinition[],
  completedPoseIds: Set<string>
): PoseDefinition[] {
  return allPoses.filter(p => !completedPoseIds.has(p.id));
}
async function enqueueNextReferenceAttemptOrQuarantine(
  env: Env,
  jobId: string,
  guardianId: string,
  attempt: number,
  errorReason: string
): Promise<void> {
  if (attempt < GATES.maxAttemptsPerPose) {
    const nextRefMsg: HatchReferenceMessage = {
      v: 1,
      type: 'HATCH_REFERENCE',
      jobId,
      guardianId,
      attempt: attempt + 1
    };
    await writeOutboxMessage(env.DB, 'githoot-ai-queue', nextRefMsg, `${jobId}:reference:${attempt + 1}`);
    if (env.AI_QUEUE) {
      await env.AI_QUEUE.send(nextRefMsg);
    }
  } else {
    console.error(`[Queue] Reference for ${guardianId} exhausted all ${GATES.maxAttemptsPerPose} attempts. Quarantining job.`);
    const errReason = `REFERENCE_GATE_EXHAUSTED: Reference failed after ${GATES.maxAttemptsPerPose} attempts (${errorReason}).`;
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, errReason, Date.now())
    ]);
  }
}

async function enqueueNextPoseAttemptOrQuarantine(
  env: Env,
  jobId: string,
  guardianId: string,
  poseId: string,
  attempt: number,
  errorReason: string
): Promise<void> {
  if (attempt < GATES.maxAttemptsPerPose) {
    const nextMsg: HatchPoseMessage = {
      v: 1,
      type: 'HATCH_POSE',
      jobId,
      guardianId,
      poseId,
      attempt: attempt + 1
    };
    await writeOutboxMessage(env.DB, 'githoot-ai-queue', nextMsg, `${jobId}:${poseId}:${attempt + 1}`);
    if (env.AI_QUEUE) {
      await env.AI_QUEUE.send(nextMsg);
    }
  } else {
    console.error(`[Queue] Pose ${poseId} exhausted all ${GATES.maxAttemptsPerPose} attempts. Quarantining job.`);
    const errReason = `POSE_GATE_EXHAUSTED: Pose ${poseId} failed after ${GATES.maxAttemptsPerPose} attempts (${errorReason}).`;
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, errReason, Date.now())
    ]);
  }
}

export async function handleGenerationQueue(
  batch: MessageBatch<GenerationQueueMessage | unknown>,
  env: Env
): Promise<void> {
  return handleQueueBatch(batch as MessageBatch<GenerationQueueMessage>, env);
}

export async function handleQueueBatch(
  batch: MessageBatch<GenerationQueueMessage | unknown>,
  env: Env
): Promise<void> {
  for (const rawMessage of batch.messages) {
    const parseRes = parseQueueMessage(rawMessage.body);
    if (!parseRes.ok) {
      console.error(`[Queue] Poison message rejected to DLQ (ID: ${rawMessage.id}): ${parseRes.error}`);
      if (env.DB) {
        try {
          await env.DB.prepare(`
            INSERT INTO guardian_dlq_quarantine (id, message_id, queue_name, payload, error_reason, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6);
          `).bind(
            crypto.randomUUID(),
            rawMessage.id || 'unknown',
            batch.queue || 'githoot-ai-queue',
            typeof rawMessage.body === 'string' ? rawMessage.body : JSON.stringify(rawMessage.body),
            parseRes.error,
            Date.now()
          ).run();
        } catch (dlqErr) {
          console.error('[Queue] Failed to record quarantine log in D1:', dlqErr);
        }
      }
      // Retrying routes to Cloudflare Queue DLQ policy once max_retries is reached
      rawMessage.retry();
      continue;
    }

    const message = parseRes.message;

    try {
      switch (message.type) {
        case 'REVALIDATE_PROFILE':
          await handleRevalidateProfile(message, env);
          rawMessage.ack();
          break;

        case 'HATCH_REFERENCE':
          await handleHatchReference(message, env);
          rawMessage.ack();
          break;

        case 'HATCH_POSE':
          await handleHatchPose(message, env, rawMessage);
          break;

        case 'HATCH_COMPOSITE':
          await handleHatchComposite(message, env, rawMessage);
          break;
      }
    } catch (err) {
      console.error(`[Queue] Unhandled error processing message ${rawMessage.id} (${message.type}):`, err);
      rawMessage.retry();
    }
  }
}

async function handleRevalidateProfile(
  message: RevalidateProfileMessage,
  env: Env
): Promise<void> {
  console.log(`[Queue] Revalidating profile KV cache for @${message.username}`);
  if (env.CACHE_KV) {
    await deleteProfileCacheKeys(env.CACHE_KV, message.username);
  }
}

async function handleHatchReference(
  message: HatchReferenceMessage,
  env: Env,
  rawMessage?: Message<unknown>
): Promise<void> {
  const { guardianId, jobId } = message;
  const attempt = message.attempt || 1;
  console.log(`[Queue] Processing HATCH_REFERENCE (attempt ${attempt}) for Guardian: ${guardianId}`);
  // 1. Fetch Guardian record from D1
  const guardian = await env.DB.prepare(
    'SELECT * FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<Record<string, unknown>>();

  if (!guardian) {
    console.error(`[Queue] Guardian ${guardianId} not found in D1.`);
    return;
  }

  // 2. Fetch or create active Hatch Job
  let job = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_jobs WHERE guardian_id = ?1 ORDER BY created_at DESC LIMIT 1'
  ).bind(guardianId).first<HatchJobRecord>();

  let parsedSpecRaw: unknown = guardian.identity_spec;
  if (typeof guardian.identity_spec === 'string' && guardian.identity_spec.trim() !== '') {
    try {
      parsedSpecRaw = JSON.parse(guardian.identity_spec);
    } catch {
      parsedSpecRaw = null;
    }
  }

  let expectedSubject: string | number | null = null;
  if (guardian.github_user_id && Number(guardian.github_user_id) > 0) {
    expectedSubject = Number(guardian.github_user_id);
  } else {
    const ghAccount = await env.DB.prepare(
      'SELECT login FROM github_accounts WHERE user_id = ?1 OR github_user_id = ?2'
    ).bind(guardian.user_id, guardian.github_user_id || 0).first<{ login: string }>();
    expectedSubject = ghAccount?.login || null;
  }

  if (!expectedSubject) {
    console.error(`[Queue] Guardian ${guardianId} has unresolvable identity subject. Quarantining job.`);
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, 'INVALID_IDENTITY_SUBJECT', Date.now())
    ]);
    return;
  }

  const validation = await validateIdentitySpec(parsedSpecRaw, {
    githubUserId: expectedSubject
  });
  if (!validation.valid) {
    console.error(`[Queue] Guardian ${guardianId} has invalid identity_spec: ${validation.reason}. Quarantining job.`);
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, `INVALID_IDENTITY_SPEC: ${validation.reason}`, Date.now())
    ]);
    return;
  }

  const spec: IdentitySpec = parsedSpecRaw as IdentitySpec;
  const modelId = env.AI_MODEL_TIER || 'nano-banana-pro-preview';
  if (!isModelAllowlisted(modelId)) {
    console.error(`[Queue] Disallowed model ID "${modelId}". Quarantining job.`);
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, `DISALLOWED_MODEL_ID: ${modelId}`, Date.now())
    ]);
    return;
  }

  const activeJobId = job?.id || jobId || crypto.randomUUID();
  if (!job) {
    const reqFingerprint = await sha256Hex(`hatch:job:${guardianId}:${spec.identityHash}`);
    await env.DB.prepare(`
      INSERT INTO guardian_hatch_jobs (
        id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at
      ) VALUES (?1, ?2, ?3, 'GENERATING', ?4, 1, 0, ?5, ?5)
      ON CONFLICT(request_fingerprint) DO UPDATE SET updated_at = ?5
    `).bind(activeJobId, guardianId, reqFingerprint, modelId, Date.now()).run();
  }

  // Check if candidate already exists
  let referenceSha = guardian.reference_sha256 as string | null;
  if (!referenceSha) {
    const existingCand = await env.DB.prepare(
      'SELECT candidate_sha256 FROM guardian_reference_candidates WHERE guardian_id = ?1 AND state IN ("VERIFYING", "APPROVED") LIMIT 1'
    ).bind(guardianId).first<{ candidate_sha256: string }>();
    if (existingCand) {
      referenceSha = existingCand.candidate_sha256;
    }
  }

  if (!referenceSha) {
    console.log(`[Queue] Generating Candidate Reference for Guardian ${guardianId}...`);
    const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

    // 1. Acquire reference lease for this attempt
    const leaseRes = await acquirePoseLease(env, activeJobId, 'reference', attempt, workerId);
    if (!leaseRes.acquired) {
      if (leaseRes.reason === 'ALREADY_ACCEPTED') {
        console.log(`[Queue] Reference for guardian ${guardianId} already generated. Skipping.`);
        return;
      }
      if (leaseRes.reason === 'ACTIVE_LEASE') {
        console.log(`[Queue] Reference for guardian ${guardianId} currently leased. Retrying.`);
        throw new Error('REFERENCE_LEASE_ACTIVE');
      }
      return;
    }

    // 2. Reserve budget for reference attempt
    const budgetRes = await reserveJobAndDailySpend(env, activeJobId, 'reference', attempt);
    if (!budgetRes.ok) {
      await releasePoseLease(env, activeJobId, 'reference', attempt, 'FAILED', budgetRes.reason);
      throw new Error(`Reference budget reservation failed: ${budgetRes.reason}`);
    }

    const referencePromptObj = await compileReferencePrompt(spec);

    // Fetch canonical sample-pet reference image from R2 to strictly condition Gemini on committed art (Invariant #4)
    let refImageOption: { mime: string; b64: string } | null = null;
    let promptText = referencePromptObj.text;
    const canonicalKey = `references/canonical/${spec.species}.jpg`;
    const canonicalObj = await env.ASSETS_BUCKET.get(canonicalKey);
    if (canonicalObj) {
      const canonicalBuf = new Uint8Array(await canonicalObj.arrayBuffer());
      refImageOption = {
        mime: 'image/jpeg',
        b64: Buffer.from(canonicalBuf).toString('base64')
      };
      promptText += ' Reference Image is for character identity and color palette ONLY. Render this exact creature centered on solid #00FF00 green background.';
      console.log(`[Queue] Reference-conditioning candidate generation on canonical art: ${canonicalKey}`);
    }

    try {
      const refGenRes = await generatePoseWithGemini({
        prompt: promptText,
        referenceImage: refImageOption,
        reservation: { jobId: activeJobId, poseId: 'reference', attemptNumber: attempt }
      }, env);
      if (!refGenRes.success || !refGenRes.base64Data) {
        throw new Error(`Failed to generate reference candidate for ${guardianId}: ${refGenRes.error || 'No base64 data'}`);
      }
      const rawRefBytes = Buffer.from(refGenRes.base64Data, 'base64');
      const gateResult = await validateAndNormalizeFrame(rawRefBytes, { claimedMime: refGenRes.mimeType });
      if (!gateResult.ok) {
        throw new Error(`Reference candidate failed acceptance gate: ${gateResult.reasons.join('; ')}`);
      }
      const rawExt = gateResult.metrics.format === 'jpeg' ? 'jpg' : 'png';
      const rawMime = gateResult.metrics.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      await env.ASSETS_BUCKET.put(`guardians/${guardianId}/raw/${gateResult.rawSha256}.${rawExt}`, rawRefBytes, {
        httpMetadata: { contentType: rawMime }
      });
      const candidateKey = generateCandidateKey(guardianId, gateResult.frameSha256);
      await env.ASSETS_BUCKET.put(candidateKey, gateResult.normalizedPng, {
        httpMetadata: { contentType: 'image/png' }
      });

      const candidateId = crypto.randomUUID();
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];
      const costCents = 25;

      // Atomic reference commit with WHERE EXISTS lease guard
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO guardian_reference_candidates (
            id, guardian_id, candidate_sha256, identity_hash, prompt_hash, model_id, raw_sha256, state, created_at
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'VERIFYING', ?8
          WHERE EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?9 AND pose_id = 'reference' AND attempt_number = ?11 AND lease_owner = ?10 AND state = 'LEASED'
          )
          ON CONFLICT(id) DO NOTHING;
        `).bind(
          candidateId,
          guardianId,
          gateResult.frameSha256,
          spec.identityHash,
          referencePromptObj.promptHash,
          modelId,
          gateResult.rawSha256,
          now,
          activeJobId,
          workerId,
          attempt
        ),

        env.DB.prepare(`
          UPDATE guardian_budget_reservations
          SET state = 'COMMITTED', updated_at = ?1
          WHERE job_id = ?2 AND pose_id = 'reference' AND attempt_number = ?4 AND state = 'RESERVED'
            AND EXISTS (
              SELECT 1 FROM guardian_pose_attempts
              WHERE job_id = ?2 AND pose_id = 'reference' AND attempt_number = ?4 AND lease_owner = ?3 AND state = 'LEASED'
            );
        `).bind(now, activeJobId, workerId, attempt),

        env.DB.prepare(`
          UPDATE guardian_hatch_jobs
          SET reserved_cents = MAX(0, reserved_cents - ?1), spent_cents = spent_cents + ?1, updated_at = ?2
          WHERE id = ?3
            AND EXISTS (
              SELECT 1 FROM guardian_pose_attempts
              WHERE job_id = ?3 AND pose_id = 'reference' AND attempt_number = ?5 AND lease_owner = ?4 AND state = 'LEASED'
            );
        `).bind(costCents, now, activeJobId, workerId, attempt),

        env.DB.prepare(`
          UPDATE ai_budget_ledger
          SET reserved_cents = MAX(0, reserved_cents - ?1),
              settled_cents = settled_cents + ?1,
              updated_at = unixepoch()
          WHERE day = ?2
            AND EXISTS (
              SELECT 1 FROM guardian_pose_attempts
              WHERE job_id = ?3 AND pose_id = 'reference' AND attempt_number = ?5 AND lease_owner = ?4 AND state = 'LEASED'
            );
        `).bind(costCents, today, activeJobId, workerId, attempt),

        env.DB.prepare(`
          UPDATE guardian_pose_attempts
          SET state = 'ACCEPTED', raw_sha256 = ?1, frame_sha256 = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
          WHERE job_id = ?4 AND pose_id = 'reference' AND attempt_number = ?6 AND lease_owner = ?5 AND state = 'LEASED';
        `).bind(gateResult.rawSha256, gateResult.frameSha256, now, activeJobId, workerId, attempt)
      ]);

      console.log(`[Queue] Staged reference candidate ${candidateId} (${gateResult.frameSha256}) in VERIFYING.`);
    } catch (refErr) {
      const errMsg = (refErr as Error).message;
      console.error(`[Queue] Reference generation error (attempt ${attempt}):`, refErr);
      await releasePoseLease(env, activeJobId, 'reference', attempt, 'FAILED', errMsg);
      // Outbound attempt was made: commit 25c charge to ledger
      await settleJobAndDailySpend(env, activeJobId, 'reference', attempt, true);
      await enqueueNextReferenceAttemptOrQuarantine(env, activeJobId, guardianId, attempt, errMsg);
    }
  }
}

async function handleHatchPose(
  message: HatchPoseMessage,
  env: Env,
  rawMessage: Message<unknown>
): Promise<void> {
  const { jobId, guardianId, poseId, attempt } = message;
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;

  console.log(`[Queue] Processing HATCH_POSE for guardian ${guardianId}, pose ${poseId}, attempt ${attempt}`);

  // 1. Acquire Per-Pose Conditional Lease
  const leaseRes = await acquirePoseLease(env, jobId, poseId, attempt, workerId);
  if (!leaseRes.acquired) {
    if (leaseRes.reason === 'ALREADY_ACCEPTED') {
      console.log(`[Queue] Pose ${poseId} already ACCEPTED in D1. Skipping duplicate execution.`);
      rawMessage.ack();
      return;
    }
    if (leaseRes.reason === 'ACTIVE_LEASE') {
      console.log(`[Queue] Pose ${poseId} currently LEASED by another worker. Retrying message with backoff.`);
      rawMessage.retry();
      return;
    }
    rawMessage.retry();
    return;
  }

  // 2. Fetch Guardian & Approved Reference
  const guardian = await env.DB.prepare(
    'SELECT * FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<Record<string, unknown>>();

  if (!guardian) {
    await releasePoseLease(env, jobId, poseId, attempt, 'FAILED', 'Guardian not found');
    rawMessage.ack();
    return;
  }

  const referenceSha = guardian.reference_sha256 as string | null;
  if (!referenceSha) {
    await releasePoseLease(env, jobId, poseId, attempt, 'FAILED', 'Reference hero image missing from guardian record');
    rawMessage.ack();
    return;
  }

  // Verify approved candidate row
  const approvedCandidate = await env.DB.prepare(
    'SELECT * FROM guardian_reference_candidates WHERE guardian_id = ?1 AND candidate_sha256 = ?2 AND state = "APPROVED"'
  ).bind(guardianId, referenceSha).first();

  if (!approvedCandidate) {
    console.warn(`[Queue] Reference ${referenceSha} not approved yet. Releasing lease and retrying later.`);
    await releasePoseLease(env, jobId, poseId, attempt, 'TIMED_OUT', 'Reference not approved');
    rawMessage.retry();
    return;
  }

  // Fetch Reference Hero Image bytes
  const refKey = generateReferenceKey(referenceSha);
  const refObj = await env.ASSETS_BUCKET.get(refKey);
  if (!refObj) {
    console.error(`[Queue] Canonical reference image missing from R2: ${refKey}. Quarantining job.`);
    const errReason = `MISSING_CANONICAL_REFERENCE: Canonical reference image missing from R2 (${refKey}).`;
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, errReason, Date.now())
    ]);
    rawMessage.ack();
    return;
  }
  const refBytes = new Uint8Array(await refObj.arrayBuffer());
  // 3. Atomically Reserve Budget (Per-Job & Per-Day Cap Enforcement)
  const budgetRes = await reserveJobAndDailySpend(env, jobId, poseId, attempt);
  if (!budgetRes.ok) {
    console.error(`[Queue] Budget reservation failed for pose ${poseId}:`, budgetRes.reason);
    await releasePoseLease(env, jobId, poseId, attempt, 'FAILED', budgetRes.reason);
    rawMessage.retry();
    return;
  }

  // 4. Generate Single Pose with Gemini
  const spec: IdentitySpec = JSON.parse(guardian.identity_spec as string);
  const allPrompts = await compileAllPosePrompts(spec);
  const promptObj = allPrompts.find(p => p.poseId === poseId);
  if (!promptObj) {
    await releasePoseLease(env, jobId, poseId, attempt, 'FAILED', `No prompt compiled for pose ${poseId}`);
    await settleJobAndDailySpend(env, jobId, poseId, attempt, false);
    rawMessage.ack();
    return;
  }

  try {
    const poseRes = await generatePoseWithGemini({
      prompt: promptObj.text,
      referenceImage: { mime: 'image/png', b64: Buffer.from(refBytes).toString('base64') },
      reservation: { jobId, poseId, attemptNumber: attempt }
    }, env);

    if (!poseRes.success || !poseRes.base64Data) {
      throw new Error(`Pose generation failed: ${poseRes.error || 'No base64 data'}`);
    }
    const rawFrameBytes = Buffer.from(poseRes.base64Data, 'base64');
    const gateResult = await validateAndNormalizeFrame(rawFrameBytes, { claimedMime: poseRes.mimeType });

    if (!gateResult.ok) {
      const gateReason = gateResult.reasons.join('; ');
      console.warn(`[Queue] Pose ${poseId} attempt ${attempt} failed image gate: ${gateReason}`);
      await releasePoseLease(env, jobId, poseId, attempt, 'REJECTED', gateReason);
      // Outbound attempt was made: commit 25c charge to ledger
      await settleJobAndDailySpend(env, jobId, poseId, attempt, true);
      await enqueueNextPoseAttemptOrQuarantine(env, jobId, guardianId, poseId, attempt, gateReason);
      rawMessage.ack();
      return;
    }

    // 5. Store exact raw bytes and normalized frame in R2
    const rawExt = gateResult.metrics.format === 'jpeg' ? 'jpg' : 'png';
    const rawMime = gateResult.metrics.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    await env.ASSETS_BUCKET.put(`guardians/${guardianId}/raw/${gateResult.rawSha256}.${rawExt}`, rawFrameBytes, {
      httpMetadata: { contentType: rawMime }
    });
    const frameKey = `guardians/${guardianId}/frames/f${poseId}_${gateResult.frameSha256}.png`;
    await env.ASSETS_BUCKET.put(frameKey, gateResult.normalizedPng, {
      httpMetadata: { contentType: 'image/png' }
    });

    const poseIndex = POSE_SET.findIndex(p => p.id === poseId);
    const gateMetrics = JSON.stringify({
      ...gateResult.metrics,
      attempt,
      validated: true
    });

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const costCents = 25;

    // 6. ATOMIC CRASH-CONSISTENT TRANSACTION WITH MANDATORY LEASE-OWNERSHIP GUARDS:
    // Every statement is strictly conditioned on the active lease ownership in guardian_pose_attempts.
    // If the lease expired or was reclaimed by another worker, ALL statements evaluate to 0 changes.
    const commitResults = await env.DB.batch([
      // 1. Insert or update accepted frame ONLY IF lease is currently owned and active
      env.DB.prepare(`
        INSERT INTO guardian_hatch_frames (
          id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, semantic_verdict, created_at
        )
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'ACCEPTED', ?7, NULL, ?8
        WHERE EXISTS (
          SELECT 1 FROM guardian_pose_attempts
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?9 AND lease_owner = ?10 AND state = 'LEASED'
        )
        ON CONFLICT(job_id, pose_id) DO UPDATE SET
          frame_sha256 = ?5, raw_sha256 = ?6, state = 'ACCEPTED', raw_gate_metrics = ?7, semantic_verdict = NULL, created_at = ?8
        WHERE EXISTS (
          SELECT 1 FROM guardian_pose_attempts
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?9 AND lease_owner = ?10 AND state = 'LEASED'
        );
      `).bind(
        crypto.randomUUID(),
        jobId,
        poseId,
        poseIndex,
        gateResult.frameSha256,
        gateResult.rawSha256,
        gateMetrics,
        now,
        attempt,
        workerId
      ),

      // 2. Commit budget reservation for this attempt ONLY IF lease is currently owned
      env.DB.prepare(`
        UPDATE guardian_budget_reservations
        SET state = 'COMMITTED', updated_at = ?1
        WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND state = 'RESERVED'
          AND EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND lease_owner = ?5 AND state = 'LEASED'
          );
      `).bind(now, jobId, poseId, attempt, workerId),

      // 3. Update Job spend counters ONLY IF lease is currently owned
      env.DB.prepare(`
        UPDATE guardian_hatch_jobs
        SET reserved_cents = MAX(0, reserved_cents - ?1), spent_cents = spent_cents + ?1, updated_at = ?2
        WHERE id = ?3
          AND EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?3 AND pose_id = ?4 AND attempt_number = ?5 AND lease_owner = ?6 AND state = 'LEASED'
          );
      `).bind(costCents, now, jobId, poseId, attempt, workerId),

      // 4. Settle Daily Budget Ledger ONLY IF lease is currently owned
      env.DB.prepare(`
        UPDATE ai_budget_ledger
        SET reserved_cents = MAX(0, reserved_cents - ?1),
            settled_cents = settled_cents + ?1,
            updated_at = unixepoch()
        WHERE day = ?2
          AND EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?3 AND pose_id = ?4 AND attempt_number = ?5 AND lease_owner = ?6 AND state = 'LEASED'
          );
      `).bind(costCents, today, jobId, poseId, attempt, workerId),

      // 5. Transition lease to ACCEPTED last
      env.DB.prepare(`
        UPDATE guardian_pose_attempts
        SET state = 'ACCEPTED', raw_sha256 = ?1, frame_sha256 = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
        WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6 AND lease_owner = ?7 AND state = 'LEASED';
      `).bind(gateResult.rawSha256, gateResult.frameSha256, now, jobId, poseId, attempt, workerId)
    ]);

    const leaseUpdated = commitResults[4]?.meta?.changes ?? (commitResults[4] as unknown as { changes?: number })?.changes ?? 1;
    if (leaseUpdated === 0) {
      console.warn(`[Queue] Lease for pose ${poseId} attempt ${attempt} was no longer owned by ${workerId} (reclaimed/aborted). Rollback complete.`);
      rawMessage.ack();
      return;
    }
    console.log(`[Queue] Successfully checkpointed pose ${poseId} for job ${jobId}.`);

    // 8. Check if all 16 poses are complete in D1 to trigger composition
    const acceptedCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM guardian_hatch_frames WHERE job_id = ?1 AND state = 'ACCEPTED';
    `).bind(jobId).first<{ count: number }>();

    if (acceptedCount?.count === POSE_SET.length) {
      console.log(`[Queue] All 16 poses completed for job ${jobId}. Enqueuing HATCH_COMPOSITE.`);
      const compMsg: HatchCompositeMessage = {
        v: 1,
        type: 'HATCH_COMPOSITE',
        jobId,
        guardianId
      };
      await writeOutboxMessage(env.DB, 'githoot-ai-queue', compMsg, `composite:${jobId}`);
      if (env.AI_QUEUE) {
        await env.AI_QUEUE.send(compMsg);
      }
    }

    rawMessage.ack();
  } catch (poseErr) {
    const errMsg = (poseErr as Error).message;
    console.error(`[Queue] Pose ${poseId} attempt ${attempt} execution error:`, poseErr);
    await releasePoseLease(env, jobId, poseId, attempt, 'FAILED', errMsg);
    // Outbound attempt was made: commit 25c charge to ledger
    await settleJobAndDailySpend(env, jobId, poseId, attempt, true);
    await enqueueNextPoseAttemptOrQuarantine(env, jobId, guardianId, poseId, attempt, errMsg);
    rawMessage.ack();
  }
}

export async function handleHatchComposite(
  message: HatchCompositeMessage,
  env: Env,
  rawMessage: Message<unknown>
): Promise<void> {
  const { jobId, guardianId } = message;
  console.log(`[Queue] Executing HATCH_COMPOSITE for guardian ${guardianId}, job ${jobId}`);

  const guardian = await env.DB.prepare(
    'SELECT * FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<Record<string, unknown>>();

  if (!guardian) {
    console.error(`[Queue] Guardian ${guardianId} not found for composition.`);
    rawMessage.ack();
    return;
  }

  const spec: IdentitySpec = JSON.parse(guardian.identity_spec as string);
  const modelId = env.AI_MODEL_TIER || 'nano-banana-pro-preview';
  const referenceSha = guardian.reference_sha256 as string;

  const existingFrames = await env.DB.prepare(
    'SELECT * FROM guardian_hatch_frames WHERE job_id = ?1'
  ).bind(jobId).all<HatchFrameRecord>();

  const completedMap = new Map<string, HatchFrameRecord>();
  for (const row of existingFrames.results || []) {
    if (row.state === 'ACCEPTED') {
      completedMap.set(row.pose_id, row);
    }
  }

  if (completedMap.size !== POSE_SET.length) {
    console.warn(`[Queue] Composition called with ${completedMap.size}/16 frames. Re-enqueuing HATCH_COMPOSITE.`);
    rawMessage.retry();
    return;
  }

  const frameBuffers: Uint8Array[] = [];
  let cacheCorrupted = false;

  for (let i = 0; i < POSE_SET.length; i++) {
    const poseDef = POSE_SET[i]!;
    const record = completedMap.get(poseDef.id);
    if (!record) {
      cacheCorrupted = true;
      break;
    }

    // 1. Fetch retained raw gate input bytes (format-agnostic raw key resolution)
    const rawResult = await fetchRawObjectFromR2(env.ASSETS_BUCKET, guardianId, record.raw_sha256);
    if (!rawResult) {
      console.error(`[Queue] Retained raw bytes missing for f${poseDef.id} in R2 (SHA: ${record.raw_sha256}). Invalidating frame.`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }

    const rawBuf = new Uint8Array(await rawResult.object.arrayBuffer());
    const actualRawSha = await sha256Hex(rawBuf);
    if (actualRawSha !== record.raw_sha256) {
      console.error(`[Queue] Retained raw SHA mismatch for f${poseDef.id} (expected ${record.raw_sha256}, got ${actualRawSha}). Invalidating frame.`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }

    // 2. Re-run authoritative acceptance gate over raw bytes
    const gateResult = await validateAndNormalizeFrame(rawBuf);
    if (!gateResult.ok || gateResult.frameSha256 !== record.frame_sha256) {
      const reasons = !gateResult.ok ? gateResult.reasons.join('; ') : `reproduced SHA ${gateResult.frameSha256} != expected ${record.frame_sha256}`;
      console.error(`[Queue] Cached frame f${poseDef.id} failed authoritative gate re-validation: ${reasons}`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }

    // 3. Fetch stored normalized frame bytes & verify SHA
    const frameKey = `guardians/${guardianId}/frames/f${poseDef.id}_${record.frame_sha256}.png`;
    const fObj = await env.ASSETS_BUCKET.get(frameKey);
    if (!fObj) {
      console.error(`[Queue] Cached normalized frame f${poseDef.id} missing from R2: ${frameKey}. Invalidating frame.`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }

    const frameBuf = new Uint8Array(await fObj.arrayBuffer());
    const actualFrameSha = await sha256Hex(frameBuf);
    if (actualFrameSha !== record.frame_sha256) {
      console.error(`[Queue] Cached frame f${poseDef.id} normalized SHA mismatch (expected ${record.frame_sha256}, got ${actualFrameSha}). Invalidating frame.`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }

    try {
      const decoded = await decodePngToRgba(frameBuf);
      if (decoded.width === FRAME.size && decoded.height === FRAME.size) {
        frameBuffers.push(decoded.data);
      } else {
        console.error(`[Queue] Cached frame f${poseDef.id} invalid dimensions ${decoded.width}x${decoded.height}. Invalidating frame.`);
        await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
        cacheCorrupted = true;
        break;
      }
    } catch {
      console.error(`[Queue] Cached frame f${poseDef.id} corrupted decode. Invalidating frame.`);
      await env.DB.prepare('UPDATE guardian_hatch_frames SET state = "REJECTED" WHERE job_id = ?1 AND pose_id = ?2').bind(jobId, poseDef.id).run();
      cacheCorrupted = true;
      break;
    }
  }

  if (cacheCorrupted || frameBuffers.length !== 16) {
    console.error(`[Queue] Cached frames corrupted or incomplete (${frameBuffers.length}/16). Quarantining job.`);
    const errReason = 'CACHED_FRAMES_CORRUPTED: Stored raw or normalized frame bytes failed integrity verification, gate re-validation, or decode in R2.';
    await env.DB.batch([
      env.DB.prepare('UPDATE guardians SET status = "QUARANTINED" WHERE id = ?1').bind(guardianId),
      env.DB.prepare('UPDATE guardian_hatch_jobs SET state = "QUARANTINED", error_log = ?2, updated_at = ?3 WHERE guardian_id = ?1').bind(guardianId, errReason, Date.now())
    ]);
    rawMessage.ack();
    return;
  }

  const composited = compositeLandingSheetAndStrip(frameBuffers, FRAME.size, FRAME.cols, FRAME.rows);

  const sheetPngBytes = encodeRgbaToPng(composited.sheetRgba, composited.sheetWidth, composited.sheetHeight);
  let sheetWebpBytes: Uint8Array;
  try {
    sheetWebpBytes = await encodeRgbaToWebp(composited.sheetRgba, composited.sheetWidth, composited.sheetHeight);
  } catch {
    sheetWebpBytes = sheetPngBytes;
  }

  const stripPngBytes = encodeRgbaToPng(composited.stripRgba, composited.stripWidth, composited.stripHeight);
  let stripWebpBytes: Uint8Array;
  try {
    stripWebpBytes = await encodeRgbaToWebp(composited.stripRgba, composited.stripWidth, composited.stripHeight);
  } catch {
    stripWebpBytes = stripPngBytes;
  }
  const sheetPngSha = await sha256Hex(sheetPngBytes);
  const sheetWebpSha = await sha256Hex(sheetWebpBytes);
  const stripPngSha = await sha256Hex(stripPngBytes);
  const stripWebpSha = await sha256Hex(stripWebpBytes);

  // Content-addressed immutable master artifact keys
  const sheetPngKey = `masters/${sheetPngSha}.png`;
  const sheetWebpKey = `masters/${sheetWebpSha}.webp`;
  const stripPngKey = `masters/${stripPngSha}.png`;
  const stripWebpKey = `masters/${stripWebpSha}.webp`;

  await env.ASSETS_BUCKET.put(sheetPngKey, sheetPngBytes, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' }
  });

  await env.ASSETS_BUCKET.put(sheetWebpKey, sheetWebpBytes, {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }
  });

  await env.ASSETS_BUCKET.put(stripPngKey, stripPngBytes, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' }
  });

  await env.ASSETS_BUCKET.put(stripWebpKey, stripWebpBytes, {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }
  });

  const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';

  const framesData = POSE_SET.map((p, idx) => {
    const rec = completedMap.get(p.id)!;
    return {
      poseId: p.id,
      poseIndex: typeof rec.pose_index === 'number' ? rec.pose_index : idx,
      frameSha256: rec.frame_sha256,
      rawSha256: rec.raw_sha256
    };
  });

  const manifestData = {
    v: 1,
    guardianId,
    versions: VERSIONS,
    identity: spec,
    modelId,
    referenceSha256: referenceSha,
    state: 'VERIFYING',
    frames: framesData,
    artifacts: {
      sheetPng: { url: `https://${cdnHost}/${sheetPngKey}`, key: sheetPngKey, sha256: sheetPngSha },
      sheetWebp: { url: `https://${cdnHost}/${sheetWebpKey}`, key: sheetWebpKey, sha256: sheetWebpSha },
      stripPng: { url: `https://${cdnHost}/${stripPngKey}`, key: stripPngKey, sha256: stripPngSha },
      stripWebp: { url: `https://${cdnHost}/${stripWebpKey}`, key: stripWebpKey, sha256: stripWebpSha }
    }
  };

  const manifestJsonString = JSON.stringify(manifestData, null, 2);
  const manifestJsonBytes = new TextEncoder().encode(manifestJsonString);
  const manifestSha256 = await sha256Hex(manifestJsonBytes);
  const manifestKey = `manifests/${manifestSha256}.json`;

  // Upload content-addressed immutable manifest to R2
  await env.ASSETS_BUCKET.put(manifestKey, manifestJsonBytes, {
    httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=31536000, immutable' }
  });

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE guardian_hatch_jobs
      SET state = 'VERIFYING', frames_completed = 16, manifest_url = ?1, updated_at = ?2
      WHERE id = ?3 AND state IN ('PENDING', 'GENERATING', 'VERIFYING');
    `).bind(`https://${cdnHost}/${manifestKey}`, Date.now(), jobId),

    env.DB.prepare(`
      UPDATE guardians
      SET status = 'VERIFYING', spritesheet_url = ?1, manifest_url = ?2
      WHERE id = ?3 AND status IN ('PENDING', 'GENERATING', 'VERIFYING');
    `).bind(`https://${cdnHost}/${stripPngKey}`, `https://${cdnHost}/${manifestKey}`, guardianId)
  ]);

  console.log(`[Queue] Successfully composited 16-pose package for ${guardianId} with manifest ${manifestSha256}. Guardian and Job hold in VERIFYING.`);
  rawMessage.ack();
}
