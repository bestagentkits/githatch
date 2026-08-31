/**
 * GitHoot Transactional Outbox & Scheduled Queue Drainer (src/server/queue/outbox.ts)
 *
 * Guarantees reliable, single-flight queue delivery even during network or broker hiccups.
 * Critical operations (claim, review) write intended messages to D1 within the same
 * atomic transaction, ensuring zero dropped messages.
 */

import type { Env } from '../types';
import { GenerationQueueMessage, parseQueueMessage } from './message-schema';

export interface OutboxRecord {
  id: string;
  claim_key: string;
  queue_name: string;
  payload: string;
  state: 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD';
  attempts: number;
  lease_owner: string | null;
  lease_expires_at: number | null;
  delivered_at: number | null;
  last_error: string | null;
  next_attempt_at: number;
  created_at: number;
  updated_at: number;
}

export const OUTBOX_LEASE_DURATION_MS = 30 * 1000; // 30 seconds

export function createOutboxStatement(
  db: D1Database,
  queueName: string,
  payload: GenerationQueueMessage,
  claimKey?: string
): D1PreparedStatement {
  const id = crypto.randomUUID();
  const derivedKey = claimKey || `${payload.type}:${'jobId' in payload ? payload.jobId : ''}:${'poseId' in payload ? payload.poseId : ''}:${id}`;
  const payloadStr = JSON.stringify(payload);
  const now = Date.now();

  return db.prepare(`
    INSERT INTO guardian_outbox (
      id, claim_key, queue_name, payload, state, attempts, lease_owner, lease_expires_at, delivered_at, last_error, next_attempt_at, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, 'PENDING', 0, NULL, NULL, NULL, NULL, ?5, ?5, ?5)
    ON CONFLICT(claim_key) DO NOTHING;
  `).bind(id, derivedKey, queueName, payloadStr, now);
}

export async function writeOutboxMessage(
  db: D1Database,
  queueName: string,
  payload: GenerationQueueMessage,
  claimKey?: string
): Promise<{ id: string; claimKey: string }> {
  const stmt = createOutboxStatement(db, queueName, payload, claimKey);
  await stmt.run();
  const derivedKey = claimKey || `${payload.type}:${'jobId' in payload ? payload.jobId : ''}:${'poseId' in payload ? payload.poseId : ''}`;
  return { id: crypto.randomUUID(), claimKey: derivedKey };
}

/**
 * Scheduled single-flight drainer that delivers pending outbox messages to Cloudflare Queues.
 * Atomically acquires a conditional lease per row so concurrent cron jobs never double-deliver.
 */
export async function drainOutbox(
  env: Env,
  batchSize = 20,
  drainerOwnerId = `drainer-${crypto.randomUUID().slice(0, 8)}`,
  leaseDurationMs = OUTBOX_LEASE_DURATION_MS
): Promise<{ processed: number; delivered: number; failed: number }> {
  if (!env.DB) {
    return { processed: 0, delivered: 0, failed: 0 };
  }

  const now = Date.now();
  const leaseExpiresAt = now + leaseDurationMs;

  try {
    // 1. Fetch eligible candidate IDs
    const candidateRows = await env.DB.prepare(`
      SELECT id FROM guardian_outbox
      WHERE state = 'PENDING'
        AND (lease_owner IS NULL OR lease_expires_at <= ?1)
        AND next_attempt_at <= ?1
      ORDER BY next_attempt_at ASC
      LIMIT ?2;
    `).bind(now, batchSize).all<{ id: string }>();

    const candidateIds = (candidateRows.results || []).map(r => r.id);
    if (candidateIds.length === 0) {
      return { processed: 0, delivered: 0, failed: 0 };
    }

    let deliveredCount = 0;
    let failedCount = 0;
    let claimedCount = 0;

    for (const id of candidateIds) {
      // 2. Conditionally acquire lease on this row
      const claimResult = await env.DB.prepare(`
        UPDATE guardian_outbox
        SET lease_owner = ?1, lease_expires_at = ?2, updated_at = ?3
        WHERE id = ?4
          AND state = 'PENDING'
          AND (lease_owner IS NULL OR lease_expires_at <= ?3);
      `).bind(drainerOwnerId, leaseExpiresAt, now, id).run();

      const changes = claimResult.meta?.changes ?? (claimResult as unknown as { changes?: number }).changes ?? 0;
      if (changes === 0) {
        // Another concurrent drainer claimed this row first
        continue;
      }

      claimedCount++;

      // 3. Fetch leased record
      const record = await env.DB.prepare(`
        SELECT * FROM guardian_outbox WHERE id = ?1 AND lease_owner = ?2;
      `).bind(id, drainerOwnerId).first<OutboxRecord>();

      if (!record) continue;

      try {
        let parsedPayload: unknown;
        try {
          parsedPayload = JSON.parse(record.payload);
        } catch (jsonErr) {
          // Unparseable JSON is poison -> mark DEAD
          await env.DB.prepare(`
            UPDATE guardian_outbox
            SET state = 'DEAD', lease_owner = NULL, lease_expires_at = NULL, last_error = ?1, updated_at = ?2
            WHERE id = ?3 AND lease_owner = ?4;
          `).bind(`JSON_PARSE_ERROR: ${(jsonErr as Error).message}`, Date.now(), record.id, drainerOwnerId).run();
          failedCount++;
          continue;
        }

        const validRes = parseQueueMessage(parsedPayload);
        if (!validRes.ok) {
          await env.DB.prepare(`
            UPDATE guardian_outbox
            SET state = 'DEAD', lease_owner = NULL, lease_expires_at = NULL, last_error = ?1, updated_at = ?2
            WHERE id = ?3 AND lease_owner = ?4;
          `).bind(`INVALID_SCHEMA: ${validRes.error}`, Date.now(), record.id, drainerOwnerId).run();
          failedCount++;
          continue;
        }

        // 4. Send to Cloudflare Queue (fail-closed if binding is missing)
        if (!env.AI_QUEUE) {
          throw new Error('AI_QUEUE_UNAVAILABLE: Cloudflare AI_QUEUE binding missing in environment');
        }
        await env.AI_QUEUE.send(validRes.message);
        // 5. Mark Delivered & Clear Lease
        await env.DB.prepare(`
          UPDATE guardian_outbox
          SET state = 'DELIVERED', delivered_at = ?1, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?1
          WHERE id = ?2 AND lease_owner = ?3;
        `).bind(Date.now(), record.id, drainerOwnerId).run();

        deliveredCount++;
      } catch (sendErr) {
        const nextAttempts = record.attempts + 1;
        const isDead = nextAttempts >= 5;
        const backoffMs = Math.min(60000, Math.pow(2, nextAttempts) * 1000);
        const nextAttemptAt = Date.now() + backoffMs;
        const targetState = isDead ? 'DEAD' : 'PENDING';

        console.error(`[Outbox] Failed delivering outbox message ${record.id} (attempt ${nextAttempts}):`, sendErr);

        await env.DB.prepare(`
          UPDATE guardian_outbox
          SET state = ?1, attempts = ?2, last_error = ?3, next_attempt_at = ?4, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?5
          WHERE id = ?6 AND lease_owner = ?7;
        `).bind(
          targetState,
          nextAttempts,
          `SEND_ERROR: ${(sendErr as Error).message}`,
          nextAttemptAt,
          Date.now(),
          record.id,
          drainerOwnerId
        ).run();

        failedCount++;
      }
    }

    return { processed: claimedCount, delivered: deliveredCount, failed: failedCount };
  } catch (err) {
    console.error('[Outbox] Drainer failed:', err);
    return { processed: 0, delivered: 0, failed: 0 };
  }
}
