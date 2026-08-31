// ============================================================================
// Runtime Daily AI Budget Guard & Gemini Client Reservation Unit Tests
// (tests/unit/budget-guard.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import {
  checkDailyBudgetLimit,
  reserveAiSpend,
  settleAiSpend,
  reserveJobAndDailySpend,
  settleJobAndDailySpend,
  reconcileAbandonedReservations,
  WORST_CASE_COST_PER_IMAGE_CENTS,
  DEFAULT_DAILY_CAP_CENTS,
  DEFAULT_JOB_CAP_CENTS
} from '../../src/server/services/billing/budget-guard';
import { generatePoseWithGemini } from '../../src/server/services/ai/gemini-client';

describe('Runtime Daily AI Budget Guard Invariants', () => {
  it('enforces worst case cost per image is 25 cents and cap is 2000 cents ($20)', () => {
    expect(WORST_CASE_COST_PER_IMAGE_CENTS).toBe(25);
    expect(DEFAULT_DAILY_CAP_CENTS).toBe(2000);
    expect(DEFAULT_DAILY_CAP_CENTS / WORST_CASE_COST_PER_IMAGE_CENTS).toBe(80); // Exactly 80 outbound calls max
  });

  it('fails closed when DB is not configured (no non-atomic fallback allowed for hard cap)', async () => {
    const status = await checkDailyBudgetLimit({} as any);
    expect(status.allowed).toBe(false);
    expect(status.remainingCalls).toBe(0);

    const reserveRes = await reserveAiSpend({} as any, 25);
    expect(reserveRes.ok).toBe(false);
    expect(reserveRes.reason).toContain('DB_UNAVAILABLE');
  });

  it('fails closed when DB query throws an error', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('D1 connection timeout'))
        })
      })
    };

    const status = await checkDailyBudgetLimit({ DB: mockDb } as any);
    expect(status.allowed).toBe(false);
    expect(status.remainingCalls).toBe(0);
  });

  it('reserves budget atomically in D1 when within cap', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
        })
      })
    };

    const result = await reserveAiSpend({ DB: mockDb } as any, 25);
    expect(result.ok).toBe(true);
  });

  it('rejects reservation when daily cap is exceeded (0 rows modified in D1)', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }) // Cap exceeded!
        })
      })
    };

    const result = await reserveAiSpend({ DB: mockDb } as any, 25);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('DAILY_BUDGET_CAP_EXCEEDED');
  });

  it('settles full 25 cents per attempt and decrements reserved_cents in D1', async () => {
    const bindFn = vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
    });
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: bindFn
      })
    };

    await settleAiSpend({ DB: mockDb } as any, 25, 25);
    expect(bindFn).toHaveBeenCalledWith(25, 25, expect.any(String));
  });

  it('gemini-client reserves and settles per outbound attempt, failing closed if budget is exhausted', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }) // Budget exhausted!
        })
      })
    };

    const env = {
      GEMINI_API_KEY: 'test-key',
      AI_MODEL_TIER: 'nano-banana-pro-preview',
      DB: mockDb
    };

    const res = await generatePoseWithGemini({ prompt: 'test prompt' }, env as any);
    expect(res.success).toBe(false);
    expect(res.error).toBe('DAILY_BUDGET_CAP_EXCEEDED');
  });

  it('gemini-client retries make per-attempt reservations, booking 25 cents per attempted outbound fetch', async () => {
    let reservationCount = 0;
    let settlementCount = 0;

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation(() => ({
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO ai_budget_ledger')) {
              reservationCount++;
              return { meta: { changes: 1 } };
            }
            if (query.includes('UPDATE ai_budget_ledger')) {
              settlementCount++;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1 } };
          })
        }))
      }))
    };

    // Mock fetch to fail attempt 1 and succeed attempt 2
    let fetchAttempts = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchAttempts++;
      if (fetchAttempts === 1) {
        return { ok: false, status: 503, text: async () => 'Service unavailable' };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  mimeType: 'image/png',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                }
              }]
            }
          }]
        })
      };
    });

    const env = {
      GEMINI_API_KEY: 'test-key',
      AI_MODEL_TIER: 'nano-banana-pro-preview',
      DB: mockDb
    };

    const res = await generatePoseWithGemini({ prompt: 'test prompt' }, env as any);
    expect(res.success).toBe(true);
    expect(fetchAttempts).toBe(2);
    expect(reservationCount).toBe(2); // 2 reservations
    expect(settlementCount).toBe(2);  // 2 settlements booked (50 cents total)
  });

  it('simulates concurrent D1 reservations enforcing the 80-call hard cap exactly', async () => {
    let reservedCents = 0;
    let settledCents = 0;
    const capCents = 2000;

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation((...args: any[]) => ({
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO ai_budget_ledger')) {
              const amount = args[1];
              if (reservedCents + settledCents + amount <= capCents) {
                reservedCents += amount;
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            }
            if (query.includes('UPDATE ai_budget_ledger')) {
              const resAmount = args[0];
              const costAmount = args[1];
              reservedCents = Math.max(0, reservedCents - resAmount);
              settledCents += costAmount;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 1 } };
          })
        }))
      }))
    };

    const env = { DB: mockDb } as any;

    // Run 100 parallel racing concurrent reservations via Promise.all
    const promises = Array.from({ length: 100 }, async () => {
      await Promise.resolve(); // Microtask tick for async scheduling
      const res = await reserveAiSpend(env, 25);
      if (res.ok) {
        await Promise.resolve();
        await settleAiSpend(env, 25, 25);
      }
      return res.ok;
    });

    const results = await Promise.all(promises);
    const granted = results.filter(r => r === true).length;
    const rejected = results.filter(r => r === false).length;

    expect(granted).toBe(80); // Exactly 80 calls granted
    expect(rejected).toBe(20); // Exactly 20 calls rejected
    expect(settledCents).toBe(2000); // Exactly $20.00 spent
    expect(reservedCents).toBe(0);
  });

  it('reserveJobAndDailySpend atomically reserves under per-job and per-day caps', async () => {
    const jobTable = new Map<string, any>();
    const dailyTable = new Map<string, any>();
    const resTable = new Map<string, any>();

    jobTable.set('job-1', { id: 'job-1', reserved_cents: 0, spent_cents: 0 });

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_budget_reservations')) {
              const [jId, pId, att] = boundArgs;
              return resTable.get(`${jId}:${pId}:${att}`) || null;
            }
            if (query.includes('FROM guardian_hatch_jobs')) {
              const j = jobTable.get(boundArgs[0]);
              return j ? { total: j.reserved_cents + j.spent_cents } : null;
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => ({ success: true, meta: { changes: 1 } }))
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        // Execute batch simulation
        resTable.set('job-1:hover:1', { id: 'res-1', job_id: 'job-1', pose_id: 'hover', attempt_number: 1, state: 'RESERVED', amount_cents: 25 });
        const j = jobTable.get('job-1');
        if (j) j.reserved_cents += 25;
        return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }, { meta: { changes: 1 } }];
      })
    } as unknown as D1Database;

    const env = { DB: mockDb } as any;
    const res = await reserveJobAndDailySpend(env, 'job-1', 'hover', 1, 25);
    expect(res.ok).toBe(true);

    // Replay of same attempt returns ok without double-incrementing
    const replayRes = await reserveJobAndDailySpend(env, 'job-1', 'hover', 1, 25);
    expect(replayRes.ok).toBe(true);
    expect(jobTable.get('job-1').reserved_cents).toBe(25);
  });

  it('reserveJobAndDailySpend rejects when per-job spend cap is exceeded', async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation(() => ({
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_budget_reservations')) return null;
            if (query.includes('FROM guardian_hatch_jobs')) return { total: 500 }; // At cap!
            return null;
          })
        }))
      })),
      batch: vi.fn().mockImplementation(async () => {
        // Zero rows inserted because cap exceeded
        return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }, { meta: { changes: 0 } }];
      })
    } as unknown as D1Database;

    const env = { DB: mockDb } as any;
    const res = await reserveJobAndDailySpend(env, 'job-capped', 'hover', 1, 25);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('JOB_BUDGET_CAP_EXCEEDED');
  });

  it('reconcileAbandonedReservations restores both job and daily counters', async () => {
    const jobTable = new Map<string, any>();
    jobTable.set('job-crash', { id: 'job-crash', reserved_cents: 25, spent_cents: 0 });

    let dailyReservedCents = 25;

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_budget_reservations')) {
              return {
                results: [{
                  id: 'res-stale',
                  job_id: 'job-crash',
                  pose_id: 'hover',
                  attempt_number: 1,
                  day: '2026-08-31',
                  amount_cents: 25
                }]
              };
            }
            return { results: [] };
          }),
          run: vi.fn().mockImplementation(async () => ({ success: true }))
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        const j = jobTable.get('job-crash');
        if (j) j.reserved_cents = Math.max(0, j.reserved_cents - 25);
        dailyReservedCents = Math.max(0, dailyReservedCents - 25);
        return [{ success: true }, { success: true }, { success: true }];
      })
    } as unknown as D1Database;

    const env = { DB: mockDb } as any;
    const sweepResult = await reconcileAbandonedReservations(env, 30);
    expect(sweepResult.reconciledCount).toBe(1);
    expect(jobTable.get('job-crash').reserved_cents).toBe(0);
    expect(dailyReservedCents).toBe(0);
  });
});
