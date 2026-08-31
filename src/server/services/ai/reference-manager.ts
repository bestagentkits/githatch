// ============================================================================
// GitHoot Canonical Reference & Two-Phase CAS Manager (src/server/services/ai/reference-manager.ts)
// ============================================================================

import type { Env, ReferenceCandidateRecord } from '../../types';
import { sha256Hex } from '../crypto/web-crypto';
import { POSE_SET } from '../dna/contracts';
import { validateIdentitySpec } from '../dna/compiler';
import { createOutboxStatement } from '../../queue/outbox';
import type { GenerationQueueMessage } from '../../queue/message-schema';

export function generateReferenceKey(referenceSha256: string): string {
  return `references/${referenceSha256}.png`;
}

export function generateCandidateKey(guardianId: string, candidateSha256: string): string {
  return `candidates/${guardianId}/${candidateSha256}.png`;
}

export interface ProvenanceCheckOptions {
  candidateSha256: string;
  actualBufferSha256: string;
  recordedIdentityHash: string;
  currentIdentityHash: string;
}

export function verifyCandidateProvenance({
  candidateSha256,
  actualBufferSha256,
  recordedIdentityHash,
  currentIdentityHash
}: ProvenanceCheckOptions): boolean {
  if (candidateSha256 !== actualBufferSha256) {
    throw new Error(`Candidate bytes changed: expected ${candidateSha256}, got ${actualBufferSha256}`);
  }

  if (recordedIdentityHash !== currentIdentityHash) {
    throw new Error(`Identity spec changed since candidate was minted: recorded ${recordedIdentityHash}, current ${currentIdentityHash}`);
  }

  return true;
}

export interface TwoPhaseApprovalParams {
  guardianId: string;
  candidateId: string;
  candidateSha256: string;
  reviewer: string;
  verdict: 'pass';
  env: Env;
}
export async function twoPhaseApproveReference({
  guardianId,
  candidateId,
  candidateSha256,
  reviewer,
  verdict,
  env
}: TwoPhaseApprovalParams): Promise<{ success: boolean; referenceUrl: string; referenceSha256: string }> {
  if (verdict !== 'pass' || !reviewer) {
    throw new Error('Approval requires verdict: pass and an identified reviewer.');
  }

  // 1. Fetch guardian and candidate records from D1 bound strictly to guardian_id
  const guardian = await env.DB.prepare(
    'SELECT identity_spec FROM guardians WHERE id = ?1'
  ).bind(guardianId).first<{ identity_spec: string }>();

  if (!guardian) {
    throw new Error(`Guardian ${guardianId} not found in D1.`);
  }

  let parsedSpecRaw: unknown = guardian.identity_spec;
  if (typeof guardian.identity_spec === 'string' && guardian.identity_spec.trim() !== '') {
    try {
      parsedSpecRaw = JSON.parse(guardian.identity_spec);
    } catch {
      parsedSpecRaw = null;
    }
  }

  const specValidation = await validateIdentitySpec(parsedSpecRaw);
  if (!specValidation.valid) {
    throw new Error(`Invalid or tampered guardian identity_spec in D1: ${specValidation.reason}`);
  }

  const serverDerivedIdentityHash = specValidation.spec.identityHash;

  const candidate = await env.DB.prepare(
    'SELECT * FROM guardian_reference_candidates WHERE id = ?1 AND guardian_id = ?2 AND state = "VERIFYING"'
  ).bind(candidateId, guardianId).first<ReferenceCandidateRecord>();

  if (!candidate) {
    throw new Error(`Candidate ${candidateId} not found or not in VERIFYING state for guardian ${guardianId}.`);
  }
  // 2. Fetch candidate image bytes from R2
  const candidateKey = generateCandidateKey(guardianId, candidateSha256);
  const candObj = await env.ASSETS_BUCKET.get(candidateKey);
  if (!candObj) {
    throw new Error(`Candidate image not found on R2: ${candidateKey}`);
  }

  const candArrayBuffer = await candObj.arrayBuffer();
  const candBytes = new Uint8Array(candArrayBuffer);
  
  // Real binary SHA-256 calculation
  const actualSha = await sha256Hex(candBytes);

  // 3. Verify provenance
  // 3. Verify provenance strictly using server-derived identity hash
  verifyCandidateProvenance({
    candidateSha256: candidate.candidate_sha256,
    actualBufferSha256: actualSha,
    recordedIdentityHash: candidate.identity_hash,
    currentIdentityHash: serverDerivedIdentityHash
  });

  // 4. Phase 1: Idempotent R2 Put to Canonical Immutable Key
  const canonicalKey = generateReferenceKey(candidate.candidate_sha256);
  await env.ASSETS_BUCKET.put(canonicalKey, candBytes, {
    httpMetadata: {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000, immutable'
    }
  });

  // Verify R2 Put succeeded before modifying D1
  const verifiedObj = await env.ASSETS_BUCKET.head(canonicalKey);
  if (!verifiedObj) {
    throw new Error(`Failed to verify canonical R2 object after upload: ${canonicalKey}`);
  }
  const verdictData = JSON.stringify({
    verdict: 'pass',
    reviewer,
    boundToSha256: candidate.candidate_sha256,
    boundToIdentityHash: serverDerivedIdentityHash,
    covers: ['species', 'anatomy/build', 'silhouette', 'palette', 'crest', 'style', 'subject count'],
    approvedAt: Date.now()
  });

  // Fetch or resolve active Job ID
  const activeJob = await env.DB.prepare(
    'SELECT id FROM guardian_hatch_jobs WHERE guardian_id = ?1 ORDER BY created_at DESC LIMIT 1'
  ).bind(guardianId).first<{ id: string }>();
  const resolvedJobId = activeJob?.id || `job-${guardianId}`;

  const batchStmts: D1PreparedStatement[] = [
    env.DB.prepare(`
      UPDATE guardian_reference_candidates
      SET state = 'APPROVED', reviewer = ?1, verdict_data = ?2
      WHERE id = ?3 AND guardian_id = ?4 AND state = 'VERIFYING'
    `).bind(reviewer, verdictData, candidateId, guardianId),

    env.DB.prepare(`
      UPDATE guardians
      SET reference_sha256 = ?1, status = 'VERIFYING'
      WHERE id = ?2 AND reference_sha256 IS NULL
    `).bind(candidate.candidate_sha256, guardianId)
  ];

  // Add all 16 pose messages to the atomic outbox batch
  const poseMessages: GenerationQueueMessage[] = [];
  for (const pose of POSE_SET) {
    const poseMsg: GenerationQueueMessage = {
      v: 1,
      type: 'HATCH_POSE',
      jobId: resolvedJobId,
      guardianId,
      poseId: pose.id,
      attempt: 1
    };
    poseMessages.push(poseMsg);
    batchStmts.push(
      createOutboxStatement(env.DB, 'githoot-ai-queue', poseMsg, `${resolvedJobId}:${pose.id}:1`)
    );
  }

  const batchResults = await env.DB.batch(batchStmts);

  const candUpdated = batchResults[0]?.meta?.changes ?? 1;
  const guardianUpdated = batchResults[1]?.meta?.changes ?? 1;

  if (candUpdated === 0 || guardianUpdated === 0) {
    throw new Error('D1 Single-Winner CAS failed: reference was already approved or modified concurrently.');
  }

  // Best-effort direct fan-out enqueue to AI_QUEUE (Outbox drainer guarantees eventual delivery)
  if (env.AI_QUEUE) {
    for (const msg of poseMessages) {
      try {
        await env.AI_QUEUE.send(msg);
        if ('poseId' in msg) {
          await env.DB.prepare(`
            UPDATE guardian_outbox
            SET state = 'DELIVERED', delivered_at = ?1, updated_at = ?1
            WHERE claim_key = ?2;
          `).bind(Date.now(), `${resolvedJobId}:${msg.poseId}:1`).run();
        }
      } catch (queueErr) {
        console.warn(`[ReferenceManager] Direct enqueue failed for pose, outbox will deliver:`, queueErr);
      }
    }
  }
  const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';
  return {
    success: true,
    referenceUrl: `https://${cdnHost}/${canonicalKey}`,
    referenceSha256: candidate.candidate_sha256
  };
}
