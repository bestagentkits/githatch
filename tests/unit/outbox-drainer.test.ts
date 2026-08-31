// ============================================================================
// GitHoot Transactional Outbox & Drainer Tests (tests/unit/outbox-drainer.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { drainOutbox, writeOutboxMessage, type OutboxRecord } from '../../src/server/queue/outbox';
import type { Env } from '../../src/server/types';
import type { GenerationQueueMessage } from '../../src/server/queue/message-schema';

describe('Transactional Outbox & Single-Flight Drainer', () => {
  function createMockEnv() {
    const outboxTable = new Map<string, OutboxRecord>();
    const deliveredToQueue: GenerationQueueMessage[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_outbox WHERE id = ?1 AND lease_owner = ?2')) {
              const [id, owner] = boundArgs;
              const rec = outboxTable.get(id);
              if (rec && rec.lease_owner === owner) return rec;
              return null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_outbox')) {
              const now = boundArgs[0] || Date.now();
              const limit = boundArgs[1] || 20;
              const eligible = Array.from(outboxTable.values())
                .filter(r => r.state === 'PENDING' && (r.lease_owner === null || (r.lease_expires_at !== null && r.lease_expires_at <= now)) && r.next_attempt_at <= now)
                .slice(0, limit);
              return { results: eligible.map(e => ({ id: e.id })) };
            }
            return { results: [] };
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO guardian_outbox')) {
              const [id, claimKey, qName, payload, nextAttempt] = boundArgs;
              if (Array.from(outboxTable.values()).some(r => r.claim_key === claimKey)) {
                return { success: true, meta: { changes: 0 } };
              }
              outboxTable.set(id, {
                id,
                claim_key: claimKey,
                queue_name: qName,
                payload,
                state: 'PENDING',
                attempts: 0,
                lease_owner: null,
                lease_expires_at: null,
                delivered_at: null,
                last_error: null,
                next_attempt_at: nextAttempt,
                created_at: nextAttempt,
                updated_at: nextAttempt
              });
              return { success: true, meta: { changes: 1 } };
            }

            if (query.includes('UPDATE guardian_outbox') && query.includes('SET lease_owner = ?1')) {
              const [owner, expiresAt, now, id] = boundArgs;
              const rec = outboxTable.get(id);
              if (rec && rec.state === 'PENDING' && (rec.lease_owner === null || (rec.lease_expires_at !== null && rec.lease_expires_at <= now))) {
                rec.lease_owner = owner;
                rec.lease_expires_at = expiresAt;
                rec.updated_at = now;
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }

            if (query.includes('SET state = \'DELIVERED\'')) {
              const [now, id, owner] = boundArgs;
              const rec = outboxTable.get(id);
              if (rec && rec.lease_owner === owner) {
                rec.state = 'DELIVERED';
                rec.delivered_at = now;
                rec.lease_owner = null;
                rec.lease_expires_at = null;
                rec.updated_at = now;
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }

            if (query.includes('SET state = \'DEAD\'')) {
              const [err, now, id, owner] = boundArgs;
              const rec = outboxTable.get(id);
              if (rec && rec.lease_owner === owner) {
                rec.state = 'DEAD';
                rec.last_error = err;
                rec.lease_owner = null;
                rec.lease_expires_at = null;
                rec.updated_at = now;
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }

            if (query.includes('attempts = ?2')) {
              const [targetState, attempts, err, nextAttempt, now, id, owner] = boundArgs;
              const rec = outboxTable.get(id);
              if (rec && rec.lease_owner === owner) {
                rec.state = targetState;
                rec.attempts = attempts;
                rec.last_error = err;
                rec.next_attempt_at = nextAttempt;
                rec.lease_owner = null;
                rec.lease_expires_at = null;
                rec.updated_at = now;
                return { success: true, meta: { changes: 1 } };
              }
              return { success: true, meta: { changes: 0 } };
            }

            return { success: true, meta: { changes: 1 } };
          })
        };
        return stmt;
      })
    } as unknown as D1Database;

    const mockQueue = {
      send: vi.fn().mockImplementation(async (msg: any) => {
        deliveredToQueue.push(msg);
      })
    } as unknown as Queue<any>;

    const env: Env = {
      DB: mockDb,
      AI_QUEUE: mockQueue,
      ASSETS_BUCKET: {} as any,
      CACHE_KV: {} as any,
      GEMINI_API_KEY: 'test-key',
      ENVIRONMENT: 'test',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      AI_MODEL_TIER: 'nano-banana-pro-preview'
    };

    return { env, outboxTable, deliveredToQueue };
  }

  it('delivers pending outbox messages and clears leases', async () => {
    const { env, outboxTable, deliveredToQueue } = createMockEnv();

    const msg: GenerationQueueMessage = {
      v: 1,
      type: 'HATCH_REFERENCE',
      jobId: 'job-1',
      guardianId: 'g-1'
    };

    await writeOutboxMessage(env.DB, 'githoot-ai-queue', msg, 'claim:g-1');

    const result = await drainOutbox(env, 10, 'drainer-1');
    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);

    expect(deliveredToQueue.length).toBe(1);
    expect(deliveredToQueue[0].type).toBe('HATCH_REFERENCE');

    const record = Array.from(outboxTable.values())[0];
    expect(record.state).toBe('DELIVERED');
    expect(record.lease_owner).toBeNull();
  });

  it('concurrent racing drainers never double-deliver messages', async () => {
    const { env, deliveredToQueue } = createMockEnv();

    // Insert 5 pending messages
    for (let i = 0; i < 5; i++) {
      const msg: GenerationQueueMessage = {
        v: 1,
        type: 'HATCH_POSE',
        jobId: 'job-race',
        guardianId: 'g-race',
        poseId: 'hover',
        attempt: 1
      };
      await writeOutboxMessage(env.DB, 'githoot-ai-queue', msg, `claim:${i}`);
    }

    // Run Drainer A and Drainer B concurrently
    const [resA, resB] = await Promise.all([
      drainOutbox(env, 5, 'drainer-A'),
      drainOutbox(env, 5, 'drainer-B')
    ]);

    expect(resA.delivered + resB.delivered).toBe(5);
    expect(deliveredToQueue.length).toBe(5);
  });

  it('fails closed and retries when AI_QUEUE binding is missing', async () => {
    const { env, outboxTable } = createMockEnv();
    delete (env as any).AI_QUEUE; // Remove binding

    const msg: GenerationQueueMessage = {
      v: 1,
      type: 'HATCH_COMPOSITE',
      jobId: 'job-no-queue',
      guardianId: 'g-no-queue'
    };

    await writeOutboxMessage(env.DB, 'githoot-ai-queue', msg, 'comp:1');

    const result = await drainOutbox(env, 10, 'drainer-err');
    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);

    const record = Array.from(outboxTable.values())[0];
    expect(record.state).toBe('PENDING');
    expect(record.attempts).toBe(1);
    expect(record.last_error).toContain('AI_QUEUE_UNAVAILABLE');
    expect(record.lease_owner).toBeNull();
  });

  it('marks poison message with unparseable payload as DEAD', async () => {
    const { env, outboxTable } = createMockEnv();

    // Insert bad row directly
    const badId = 'bad-json-id';
    outboxTable.set(badId, {
      id: badId,
      claim_key: 'bad-json',
      queue_name: 'githoot-ai-queue',
      payload: '{ not-valid-json',
      state: 'PENDING',
      attempts: 0,
      lease_owner: null,
      lease_expires_at: null,
      delivered_at: null,
      last_error: null,
      next_attempt_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now()
    });

    const result = await drainOutbox(env, 10, 'drainer-poison');
    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);

    const record = outboxTable.get(badId);
    expect(record?.state).toBe('DEAD');
    expect(record?.last_error).toContain('JSON_PARSE_ERROR');
  });
});
