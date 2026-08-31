/**
 * GitHoot Per-Pose Conditional Lease Manager (src/server/queue/lease-manager.ts)
 *
 * Implements deterministic claim keys and conditional leases to prevent duplicate
 * Gemini executions and ensure exactly-one accepted frame per (job_id, pose_id).
 */

import type { Env } from '../types';

export interface LeaseAcquisitionResult {
  acquired: boolean;
  attemptId?: string;
  claimKey?: string;
  reason?: 'ALREADY_ACCEPTED' | 'ACTIVE_LEASE' | 'DB_ERROR';
  error?: string;
}

export const LEASE_DURATION_MS = 60 * 1000; // 60 seconds lease window per pose

/**
 * Atomically attempts to acquire a lease for (jobId, poseId, attemptNumber).
 * Uses atomic conditional SQL checking that no frame is ACCEPTED and no active unexpired lease exists.
 */
export async function acquirePoseLease(
  env: Env,
  jobId: string,
  poseId: string,
  attemptNumber: number,
  leaseOwner: string,
  leaseDurationMs = LEASE_DURATION_MS
): Promise<LeaseAcquisitionResult> {
  if (!env.DB) {
    return { acquired: false, reason: 'DB_ERROR', error: 'Database unavailable' };
  }

  const now = Date.now();
  const claimKey = `${jobId}:${poseId}:${attemptNumber}`;
  const attemptId = crypto.randomUUID();
  const leaseExpiresAt = now + leaseDurationMs;

  try {
    // 1. Fast check: is pose already accepted in D1?
    const acceptedCheck = await env.DB.prepare(`
      SELECT id FROM guardian_hatch_frames
      WHERE job_id = ?1 AND pose_id = ?2 AND state = 'ACCEPTED'
      UNION ALL
      SELECT id FROM guardian_pose_attempts
      WHERE job_id = ?1 AND pose_id = ?2 AND state = 'ACCEPTED'
      LIMIT 1;
    `).bind(jobId, poseId).first();

    if (acceptedCheck) {
      return { acquired: false, reason: 'ALREADY_ACCEPTED' };
    }

    // 2. Atomic conditional INSERT / UPDATE with strict lease guard
    const query = `
      INSERT INTO guardian_pose_attempts (
        id, job_id, pose_id, attempt_number, claim_key, lease_owner, lease_expires_at, state, created_at, updated_at
      )
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'LEASED', ?8, ?8
      WHERE NOT EXISTS (
        SELECT 1 FROM guardian_hatch_frames WHERE job_id = ?2 AND pose_id = ?3 AND state = 'ACCEPTED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM guardian_pose_attempts WHERE job_id = ?2 AND pose_id = ?3 AND state = 'ACCEPTED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM guardian_pose_attempts
        WHERE job_id = ?2 AND pose_id = ?3 AND state = 'LEASED' AND lease_owner != ?6 AND lease_expires_at > ?8
      )
      ON CONFLICT(job_id, pose_id, attempt_number) DO UPDATE SET
        lease_owner = ?6,
        lease_expires_at = ?7,
        state = 'LEASED',
        updated_at = ?8
      WHERE (guardian_pose_attempts.lease_owner IS NULL OR guardian_pose_attempts.lease_owner = ?6 OR guardian_pose_attempts.lease_expires_at <= ?8)
        AND guardian_pose_attempts.state != 'ACCEPTED';
    `;

    const res = await env.DB.prepare(query)
      .bind(attemptId, jobId, poseId, attemptNumber, claimKey, leaseOwner, leaseExpiresAt, now)
      .run();

    const changes = res.meta?.changes ?? (res as unknown as { changes?: number }).changes ?? 0;
    if (changes === 0) {
      return { acquired: false, reason: 'ACTIVE_LEASE' };
    }

    return {
      acquired: true,
      attemptId,
      claimKey
    };
  } catch (err) {
    console.error('[LeaseManager] Failed to acquire pose lease:', err);
    return { acquired: false, reason: 'DB_ERROR', error: (err as Error).message };
  }
}

/**
 * Atomically commits a pose lease to ACCEPTED state with cryptographic SHA-256 hashes.
 */
export async function commitPoseLease(
  env: Env,
  jobId: string,
  poseId: string,
  attemptNumber: number,
  rawSha256: string,
  frameSha256: string,
  leaseOwner?: string
): Promise<{ success: boolean; error?: string }> {
  if (!env.DB) return { success: false, error: 'DB unavailable' };

  const now = Date.now();

  try {
    const query = leaseOwner
      ? `UPDATE guardian_pose_attempts
         SET state = 'ACCEPTED', raw_sha256 = ?1, frame_sha256 = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
         WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6 AND lease_owner = ?7 AND state = 'LEASED';`
      : `UPDATE guardian_pose_attempts
         SET state = 'ACCEPTED', raw_sha256 = ?1, frame_sha256 = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
         WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6 AND state = 'LEASED';`;

    const stmt = leaseOwner
      ? env.DB.prepare(query).bind(rawSha256, frameSha256, now, jobId, poseId, attemptNumber, leaseOwner)
      : env.DB.prepare(query).bind(rawSha256, frameSha256, now, jobId, poseId, attemptNumber);

    const res = await stmt.run();
    const changes = Number(res.meta?.changes ?? (res as unknown as { changes?: number }).changes ?? 0);

    return { success: changes > 0 };
  } catch (err) {
    console.error('[LeaseManager] Failed to commit pose lease:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Releases or marks a pose lease as FAILED or REJECTED.
 */
export async function releasePoseLease(
  env: Env,
  jobId: string,
  poseId: string,
  attemptNumber: number,
  targetState: 'FAILED' | 'REJECTED' | 'TIMED_OUT' = 'FAILED',
  errorMessage?: string,
  leaseOwner?: string
): Promise<void> {
  if (!env.DB) return;

  const now = Date.now();

  try {
    const query = leaseOwner
      ? `UPDATE guardian_pose_attempts
         SET state = ?1, error_message = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
         WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6 AND lease_owner = ?7;`
      : `UPDATE guardian_pose_attempts
         SET state = ?1, error_message = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
         WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6;`;

    const stmt = leaseOwner
      ? env.DB.prepare(query).bind(targetState, errorMessage || null, now, jobId, poseId, attemptNumber, leaseOwner)
      : env.DB.prepare(query).bind(targetState, errorMessage || null, now, jobId, poseId, attemptNumber);

    await stmt.run();
  } catch (err) {
    console.error('[LeaseManager] Failed to release pose lease:', err);
  }
}
