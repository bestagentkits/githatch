// ============================================================================
// GitHoot Early Access 100-Slot Atomic Ledger (src/server/services/claim/quota.ts)
// ============================================================================

import type { Env, EarlyAccessStatus } from '../../types';

export interface SlotReservationResult {
  isFree: boolean;
  slotNumber: number | null;
  status: 'reserved_new' | 'already_claimed' | 'quota_exhausted';
}

export async function getEarlyAccessStatus(env: Env, currentUserId?: number): Promise<EarlyAccessStatus> {
  const total = parseInt(env.EARLY_ACCESS_TOTAL_SLOTS || '100', 10);
  
  try {
    const claimedRow = await env.DB.prepare("SELECT count(*) as count FROM early_access_slots WHERE status = 'claimed'")
      .first<{ count: number }>();
    
    const claimed = claimedRow ? claimedRow.count : 0;
    const remaining = Math.max(0, total - claimed);

    let userHasClaimed = false;
    if (currentUserId) {
      const userSlot = await env.DB.prepare('SELECT slot_number FROM early_access_slots WHERE github_user_id = ? AND status = "claimed"')
        .bind(currentUserId)
        .first<{ slot_number: number }>();
      userHasClaimed = Boolean(userSlot);
    }

    return {
      total,
      claimed,
      remaining,
      is_free: remaining > 0,
      user_has_claimed: userHasClaimed,
      degraded: false
    };
  } catch (err) {
    console.warn('[Quota] Failed to get quota status:', err);
    return {
      total: 100,
      claimed: null,
      remaining: null,
      is_free: true,
      user_has_claimed: false,
      degraded: true
    };
  }
}

export async function reserveEarlyAccessSlot(githubUserId: number, env: Env): Promise<SlotReservationResult> {
  // 1. Check if user already owns a slot
  const existingSlot = await env.DB.prepare('SELECT slot_number FROM early_access_slots WHERE github_user_id = ?')
    .bind(githubUserId)
    .first<{ slot_number: number }>();

  if (existingSlot) {
    return {
      isFree: true,
      slotNumber: existingSlot.slot_number,
      status: 'already_claimed'
    };
  }

  // 2. Atomically reserve the lowest available slot
  const now = Date.now();
  const updateResult = await env.DB.prepare(`
    UPDATE early_access_slots
    SET github_user_id = ?1, claimed_at = ?2, status = 'claimed'
    WHERE slot_number = (
      SELECT slot_number FROM early_access_slots
      WHERE status = 'available'
      ORDER BY slot_number ASC
      LIMIT 1
    )
    RETURNING slot_number
  `).bind(githubUserId, now).first<{ slot_number: number }>();

  if (updateResult && updateResult.slot_number) {
    return {
      isFree: true,
      slotNumber: updateResult.slot_number,
      status: 'reserved_new'
    };
  }

  // Quota is exhausted (All 100 slots claimed)
  return {
    isFree: false,
    slotNumber: null,
    status: 'quota_exhausted'
  };
}
