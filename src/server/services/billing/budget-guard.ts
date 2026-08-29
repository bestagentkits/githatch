// ============================================================================
// GitHoot Daily AI Budget Hard-Cap Guard (src/server/services/billing/budget-guard.ts)
// ============================================================================

import type { Env } from '../../types';

export interface BudgetStatus {
  allowed: boolean;
  spentTodayUsd: number;
  capUsd: number;
  totalCallsToday: number;
  remainingCalls: number;
}

const COST_PER_NANO_BANANA_CALL_USD = 0.003; // ~$0.003 per generation
const DEFAULT_DAILY_CAP_USD = 20.0; // $20.00 / day hard limit

export async function checkDailyBudgetLimit(env: Env): Promise<BudgetStatus> {
  const todayKey = `budget:ai:${new Date().toISOString().split('T')[0]}`;
  const capUsd = DEFAULT_DAILY_CAP_USD;

  let callCount = 0;
  if (env.CACHE_KV) {
    try {
      const stored = await env.CACHE_KV.get(todayKey);
      if (stored) {
        callCount = parseInt(stored, 10) || 0;
      }
    } catch {
      // Fallback
    }
  }

  const spentTodayUsd = callCount * COST_PER_NANO_BANANA_CALL_USD;
  const maxCalls = Math.floor(capUsd / COST_PER_NANO_BANANA_CALL_USD);
  const remainingCalls = Math.max(0, maxCalls - callCount);

  return {
    allowed: spentTodayUsd < capUsd,
    spentTodayUsd,
    capUsd,
    totalCallsToday: callCount,
    remainingCalls
  };
}

export async function recordAiGenerationSpend(env: Env): Promise<void> {
  const todayKey = `budget:ai:${new Date().toISOString().split('T')[0]}`;

  if (env.CACHE_KV) {
    try {
      const stored = await env.CACHE_KV.get(todayKey);
      const current = stored ? parseInt(stored, 10) || 0 : 0;
      await env.CACHE_KV.put(todayKey, String(current + 1), {
        expirationTtl: 86400 * 2 // 2 days TTL
      });
    } catch (err) {
      console.warn('[BudgetGuard] Failed to record spend in KV:', err);
    }
  }
}
