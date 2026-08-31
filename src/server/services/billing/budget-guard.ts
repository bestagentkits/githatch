// ============================================================================
// GitHoot Daily AI Budget Hard-Cap Guard (src/server/services/billing/budget-guard.ts)
// Atomic D1 SQLite Spend & Reservation Ledger with Strict Worst-Case Enforcement
// ============================================================================

import type { Env } from '../../types';

export interface BudgetStatus {
  allowed: boolean;
  reason?: string;
  spentTodayUsd: number;
  capUsd: number;
  totalCallsToday: number;
  remainingCalls: number;
}

// Worst-case pricing per official Gemini 3 Pro Image documentation:
// $0.134/image (1K/2K) - $0.24/image (4K) + input tokens.
// Hard worst-case charge: 25 cents ($0.25) booked per outbound generation attempt.
export const WORST_CASE_COST_PER_IMAGE_CENTS = 25; 
export const DEFAULT_DAILY_CAP_CENTS = 2000; // $20.00 / day hard limit (2000 cents) => exactly 80 outbound calls/day max
export const DEFAULT_JOB_CAP_CENTS = 500; // $5.00 / job hard limit (500 cents) => max 20 calls per hatch job

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Checks if the daily budget is within limits.
 * Fails closed if DB is unreachable or absent.
 */
export async function checkDailyBudgetLimit(env: Env): Promise<BudgetStatus> {
  const capUsd = DEFAULT_DAILY_CAP_CENTS / 100;

  if (!env.DB) {
    return {
      allowed: false,
      reason: 'DB_UNAVAILABLE: Authoritative D1 spend ledger required',
      spentTodayUsd: capUsd,
      capUsd,
      totalCallsToday: 0,
      remainingCalls: 0
    };
  }

  const today = getTodayDateString();

  try {
    const row = await env.DB.prepare(`
      SELECT reserved_cents, settled_cents, cap_cents, total_calls
      FROM ai_budget_ledger
      WHERE day = ?1;
    `)
      .bind(today)
      .first<{
        reserved_cents: number;
        settled_cents: number;
        cap_cents: number;
        total_calls: number;
      }>();

    const reserved = row ? row.reserved_cents || 0 : 0;
    const settled = row ? row.settled_cents || 0 : 0;
    const cap = row ? row.cap_cents || DEFAULT_DAILY_CAP_CENTS : DEFAULT_DAILY_CAP_CENTS;
    const totalCalls = row ? row.total_calls || 0 : 0;

    const totalReservedAndSettled = reserved + settled;
    const spentTodayUsd = totalReservedAndSettled / 100;
    const capUsdLive = cap / 100;
    const remainingCents = Math.max(0, cap - totalReservedAndSettled);
    const remainingCalls = Math.floor(remainingCents / WORST_CASE_COST_PER_IMAGE_CENTS);

    if (totalReservedAndSettled + WORST_CASE_COST_PER_IMAGE_CENTS > cap) {
      return {
        allowed: false,
        reason: 'DAILY_BUDGET_CAP_EXCEEDED',
        spentTodayUsd,
        capUsd: capUsdLive,
        totalCallsToday: totalCalls,
        remainingCalls: 0
      };
    }

    return {
      allowed: true,
      spentTodayUsd,
      capUsd: capUsdLive,
      totalCallsToday: totalCalls,
      remainingCalls
    };
  } catch (err) {
    console.error('[BudgetGuard] Failed to query daily spend ledger:', err);
    return {
      allowed: false,
      reason: `DB_QUERY_FAILED: ${(err as Error).message}`,
      spentTodayUsd: capUsd,
      capUsd,
      totalCallsToday: 0,
      remainingCalls: 0
    };
  }
}

/**
 * Atomically reserves budget in D1 before making a Gemini API call.
 * Enforces worst-case pricing ($0.25 / attempt) against the $20 daily cap.
 * Fails closed if DB is absent or cap reached.
 */
export async function reserveAiSpend(
  env: Env,
  estimatedCostCents = WORST_CASE_COST_PER_IMAGE_CENTS
): Promise<{ ok: boolean; reason?: string }> {
  if (!env.DB) {
    return { ok: false, reason: 'DB_UNAVAILABLE: Authoritative D1 spend ledger required' };
  }

  const today = getTodayDateString();

  try {
    const query = `
      INSERT INTO ai_budget_ledger (day, reserved_cents, settled_cents, cap_cents, total_calls, updated_at)
      VALUES (?1, ?2, 0, ?3, 1, unixepoch())
      ON CONFLICT(day) DO UPDATE SET
        reserved_cents = reserved_cents + ?2,
        total_calls = total_calls + 1,
        updated_at = unixepoch()
      WHERE (reserved_cents + settled_cents + ?2) <= cap_cents;
    `;
    const res = await env.DB.prepare(query)
      .bind(today, estimatedCostCents, DEFAULT_DAILY_CAP_CENTS)
      .run();

    const changes = Number(res.meta?.changes ?? (res as unknown as { changes?: number }).changes ?? 0);
    if (changes === 0) {
      return { ok: false, reason: 'DAILY_BUDGET_CAP_EXCEEDED' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[BudgetGuard] D1 reservation failed, failing closed:', err);
    return { ok: false, reason: `BUDGET_RESERVATION_FAILED: ${(err as Error).message}` };
  }
}

/**
 * Settles an attempted budget spend after Gemini call finishes.
 */
export async function settleAiSpend(
  env: Env,
  costCents = WORST_CASE_COST_PER_IMAGE_CENTS,
  reservedCents = WORST_CASE_COST_PER_IMAGE_CENTS
): Promise<void> {
  if (!env.DB) return;

  const today = getTodayDateString();

  try {
    await env.DB.prepare(`
      UPDATE ai_budget_ledger
      SET reserved_cents = MAX(0, reserved_cents - ?1),
          settled_cents = settled_cents + ?2,
          updated_at = unixepoch()
      WHERE day = ?3;
    `)
      .bind(reservedCents, costCents, today)
      .run();
  } catch (err) {
    console.error('[BudgetGuard] Failed to settle AI spend in D1:', err);
  }
}

/**
 * Reserves budget for a specific job and pose attempt in guardian_budget_reservations and daily ledger.
 * Atomically enforces both per-job and per-day caps in a single indivisible D1 batch transaction.
 * Idempotent: replaying the same (jobId, poseId, attemptNumber) will not double-reserve.
 */
export async function reserveJobAndDailySpend(
  env: Env,
  jobId: string,
  poseId: string,
  attemptNumber: number,
  costCents = WORST_CASE_COST_PER_IMAGE_CENTS
): Promise<{ ok: boolean; reason?: string }> {
  if (!env.DB) {
    return { ok: false, reason: 'DB_UNAVAILABLE: Authoritative D1 spend ledger required' };
  }

  const today = getTodayDateString();
  const resId = crypto.randomUUID();
  const now = Date.now();

  try {
    // 1. Fast check: is this attempt already reserved?
    const existingRes = await env.DB.prepare(`
      SELECT id, state FROM guardian_budget_reservations
      WHERE job_id = ?1 AND pose_id = ?2 AND attempt_number = ?3;
    `).bind(jobId, poseId, attemptNumber).first<{ id: string; state: string }>();

    if (existingRes) {
      if (existingRes.state === 'RESERVED' || existingRes.state === 'COMMITTED') {
        // Already reserved under this exact attempt, do not double-increment
        return { ok: true };
      }
    }

    // 2. Atomic Indivisible Batch:
    // Statement 1: Insert reservation row ONLY IF under job cap and under daily cap
    // Statement 2: Increment job counter ONLY IF statement 1 succeeded
    // Statement 3: Increment daily ledger ONLY IF statement 1 succeeded
    const batchResults = await env.DB.batch([
      // 1. Conditional reservation row insert
      env.DB.prepare(`
        INSERT INTO guardian_budget_reservations (
          id, job_id, pose_id, attempt_number, day, amount_cents, state, created_at, updated_at
        )
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'RESERVED', ?7, ?7
        WHERE NOT EXISTS (
          SELECT 1 FROM guardian_budget_reservations
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4
        )
        AND (
          SELECT COALESCE(reserved_cents + spent_cents, 0) FROM guardian_hatch_jobs WHERE id = ?2
        ) + ?6 <= ?8
        AND (
          SELECT COALESCE(reserved_cents + settled_cents, 0) FROM ai_budget_ledger WHERE day = ?5
        ) + ?6 <= ?9;
      `).bind(resId, jobId, poseId, attemptNumber, today, costCents, now, DEFAULT_JOB_CAP_CENTS, DEFAULT_DAILY_CAP_CENTS),

      // 2. Increment Job spend counters
      env.DB.prepare(`
        UPDATE guardian_hatch_jobs
        SET reserved_cents = reserved_cents + ?1, updated_at = ?2
        WHERE id = ?3
          AND EXISTS (
            SELECT 1 FROM guardian_budget_reservations
            WHERE id = ?4 AND state = 'RESERVED' AND created_at = ?2
          );
      `).bind(costCents, now, jobId, resId),

      // 3. Increment Daily Budget Ledger
      env.DB.prepare(`
        INSERT INTO ai_budget_ledger (day, reserved_cents, settled_cents, cap_cents, total_calls, updated_at)
        SELECT ?1, ?2, 0, ?3, 1, unixepoch()
        WHERE EXISTS (
          SELECT 1 FROM guardian_budget_reservations
          WHERE id = ?4 AND state = 'RESERVED' AND created_at = ?5
        )
        ON CONFLICT(day) DO UPDATE SET
          reserved_cents = reserved_cents + ?2,
          total_calls = total_calls + 1,
          updated_at = unixepoch()
        WHERE EXISTS (
          SELECT 1 FROM guardian_budget_reservations
          WHERE id = ?4 AND state = 'RESERVED' AND created_at = ?5
        );
      `).bind(today, costCents, DEFAULT_DAILY_CAP_CENTS, resId, now)
    ]);

    const resInserted = Number(batchResults[0]?.meta?.changes ?? (batchResults[0] as unknown as { changes?: number })?.changes ?? 0);
    if (resInserted === 0) {
      // Check which cap was exceeded for informative error
      const jobCheck = await env.DB.prepare('SELECT (reserved_cents + spent_cents) as total FROM guardian_hatch_jobs WHERE id = ?1').bind(jobId).first<{ total: number }>();
      if ((jobCheck?.total || 0) + costCents > DEFAULT_JOB_CAP_CENTS) {
        return { ok: false, reason: `JOB_BUDGET_CAP_EXCEEDED: Exceeds ${DEFAULT_JOB_CAP_CENTS}c job limit` };
      }
      return { ok: false, reason: 'DAILY_BUDGET_CAP_EXCEEDED: Exceeds daily spend limit' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[BudgetGuard] Job & Daily reservation failed:', err);
    return { ok: false, reason: `JOB_RESERVATION_FAILED: ${(err as Error).message}` };
  }
}

/**
 * Settles or releases job budget reservation and daily ledger.
 */
export async function settleJobAndDailySpend(
  env: Env,
  jobId: string,
  poseId: string,
  attemptNumber: number,
  success: boolean,
  costCents = WORST_CASE_COST_PER_IMAGE_CENTS
): Promise<void> {
  if (!env.DB) return;

  const now = Date.now();
  const today = getTodayDateString();

  try {
    if (success) {
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE guardian_budget_reservations
          SET state = 'COMMITTED', updated_at = ?1
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND state = 'RESERVED';
        `).bind(now, jobId, poseId, attemptNumber),

        env.DB.prepare(`
          UPDATE guardian_hatch_jobs
          SET reserved_cents = MAX(0, reserved_cents - ?1), spent_cents = spent_cents + ?1, updated_at = ?2
          WHERE id = ?3;
        `).bind(costCents, now, jobId),

        env.DB.prepare(`
          UPDATE ai_budget_ledger
          SET reserved_cents = MAX(0, reserved_cents - ?1),
              settled_cents = settled_cents + ?1,
              updated_at = unixepoch()
          WHERE day = ?2;
        `).bind(costCents, today)
      ]);
    } else {
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE guardian_budget_reservations
          SET state = 'RELEASED', updated_at = ?1
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND state = 'RESERVED';
        `).bind(now, jobId, poseId, attemptNumber),

        env.DB.prepare(`
          UPDATE guardian_hatch_jobs
          SET reserved_cents = MAX(0, reserved_cents - ?1), updated_at = ?2
          WHERE id = ?3;
        `).bind(costCents, now, jobId),

        env.DB.prepare(`
          UPDATE ai_budget_ledger
          SET reserved_cents = MAX(0, reserved_cents - ?1),
              updated_at = unixepoch()
          WHERE day = ?2;
        `).bind(costCents, today)
      ]);
    }
  } catch (err) {
    console.error('[BudgetGuard] Failed to settle job spend:', err);
  }
}

/**
 * Sweeps abandoned reservations older than maxAgeMinutes (e.g. from crashed workers)
 * and restores both job-level and daily held budget limits.
 */
export async function reconcileAbandonedReservations(
  env: Env,
  maxAgeMinutes = 30
): Promise<{ reconciledCount: number }> {
  if (!env.DB) return { reconciledCount: 0 };

  const cutoff = Date.now() - (maxAgeMinutes * 60 * 1000);
  const now = Date.now();

  try {
    const staleRows = await env.DB.prepare(`
      SELECT id, job_id, pose_id, attempt_number, day, amount_cents
      FROM guardian_budget_reservations
      WHERE state = 'RESERVED' AND created_at < ?1;
    `).bind(cutoff).all<{ id: string; job_id: string; pose_id: string; attempt_number: number; day: string; amount_cents: number }>();

    const items = staleRows.results || [];
    if (items.length === 0) return { reconciledCount: 0 };

    for (const item of items) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE guardian_budget_reservations SET state = 'TIMED_OUT', updated_at = ?1 WHERE id = ?2 AND state = 'RESERVED'`).bind(now, item.id),
        env.DB.prepare(`UPDATE guardian_hatch_jobs SET reserved_cents = MAX(0, reserved_cents - ?1), updated_at = ?2 WHERE id = ?3`).bind(item.amount_cents, now, item.job_id),
        env.DB.prepare(`UPDATE ai_budget_ledger SET reserved_cents = MAX(0, reserved_cents - ?1), updated_at = unixepoch() WHERE day = ?2`).bind(item.amount_cents, item.day)
      ]);
    }

    console.log(`[BudgetGuard] Reconciled ${items.length} abandoned reservations across job and daily ledgers.`);
    return { reconciledCount: items.length };
  } catch (err) {
    console.error('[BudgetGuard] Error reconciling abandoned reservations:', err);
    return { reconciledCount: 0 };
  }
}

export async function recordAiGenerationSpend(env: Env): Promise<void> {
  await settleAiSpend(env, WORST_CASE_COST_PER_IMAGE_CENTS, WORST_CASE_COST_PER_IMAGE_CENTS);
}
