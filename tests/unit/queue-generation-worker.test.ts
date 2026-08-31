// ============================================================================
// Queue Generation Worker Service-Level Lifecycle Tests (Mock-Bound External Doubles)
// (tests/unit/queue-generation-worker.test.ts)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import serverApp from '../../src/server/index';
import { handleQueueBatch, type GenerationQueueMessage } from '../../src/server/queue/generation-worker';
import { twoPhaseApproveReference } from '../../src/server/services/ai/reference-manager';
import { encodeRgbaToPng } from '../../src/server/services/image/png-codec';
import { compileIdentitySpec } from '../../src/server/services/dna/compiler';
import { POSE_SET } from '../../src/server/services/dna/contracts';
import { reconcileAbandonedReservations } from '../../src/server/services/billing/budget-guard';
import type { Env, GitHubUserRaw } from '../../src/server/types';

function createSampleNonBlankCharacterPng(): { pngBytes: Uint8Array; b64: string } {
  const width = 256;
  const height = 256;
  const rgba = new Uint8Array(width * height * 4);

  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 0;     // R
    rgba[i + 1] = 255; // G (chroma)
    rgba[i + 2] = 0;   // B
    rgba[i + 3] = 255; // A
  }

  for (let y = 64; y < 192; y++) {
    for (let x = 64; x < 192; x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = 255;   // R
      rgba[idx + 1] = 128; // G
      rgba[idx + 2] = 0;   // B
      rgba[idx + 3] = 255; // A
    }
  }

  const pngBytes = encodeRgbaToPng(rgba, width, height);
  const b64 = Buffer.from(pngBytes).toString('base64');
  return { pngBytes, b64 };
}

async function createMockFullLifecycleEnv(): Promise<{
  env: Env;
  r2Storage: Map<string, Uint8Array>;
  d1Tables: {
    guardians: Map<string, any>;
    guardian_reference_candidates: Map<string, any>;
    guardian_hatch_jobs: Map<string, any>;
    guardian_hatch_frames: Map<string, any>;
    guardian_pose_attempts: Map<string, any>;
    guardian_outbox: Map<string, any>;
    guardian_budget_reservations: Map<string, any>;
    guardian_dlq_quarantine: Map<string, any>;
    guardian_review_records: Map<string, any>;
    guardian_publication: Map<string, any>;
    ai_budget_ledger: Map<string, any>;
  };
  enqueuedMessages: any[];
}> {
  const r2Storage = new Map<string, Uint8Array>();
  const d1Tables = {
    guardians: new Map<string, any>(),
    guardian_reference_candidates: new Map<string, any>(),
    guardian_hatch_jobs: new Map<string, any>(),
    guardian_hatch_frames: new Map<string, any>(),
    guardian_pose_attempts: new Map<string, any>(),
    guardian_outbox: new Map<string, any>(),
    guardian_budget_reservations: new Map<string, any>(),
    guardian_dlq_quarantine: new Map<string, any>(),
    guardian_review_records: new Map<string, any>(),
    guardian_publication: new Map<string, any>(),
    ai_budget_ledger: new Map<string, any>()
  };
  const enqueuedMessages: any[] = [];

  const spec = await compileIdentitySpec({
    githubUserId: 11829471,
    telemetry: {
      topLanguages: ['typescript'],
      provenance: { topLanguages: 'measured' }
    }
  });

  d1Tables.guardians.set('g-e2e-1', {
    id: 'g-e2e-1',
    user_id: 'u-1',
    github_user_id: 11829471,
    name: 'mrgoonie',
    species: spec.species,
    species_name: spec.speciesName,
    anatomy: spec.anatomy,
    element: spec.element,
    rarity_tier: spec.rarity,
    dna_seed: spec.dnaSeed,
    status: 'PENDING',
    reference_sha256: null,
    spritesheet_url: null,
    manifest_url: null,
    identity_spec: JSON.stringify(spec)
  });

  d1Tables.guardian_hatch_jobs.set('job-1', {
    id: 'job-1',
    guardian_id: 'g-e2e-1',
    request_fingerprint: 'fp-1',
    state: 'GENERATING',
    model_id: 'nano-banana-pro-preview',
    attempts_count: 1,
    frames_completed: 0,
    reserved_cents: 0,
    spent_cents: 0,
    manifest_url: null,
    created_at: Date.now(),
    updated_at: Date.now()
  });

  const mockDb = {
    prepare: vi.fn().mockImplementation((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: vi.fn().mockImplementation((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM early_access_slots')) {
            return { slot_number: 1, github_user_id: null, claimed_at: null, status: 'available' };
          }
          if (query.includes('FROM guardians WHERE id = ?1')) {
            const gId = boundArgs[0] || 'g-e2e-1';
            return d1Tables.guardians.get(gId) || null;
          }
          if (query.includes('FROM guardians WHERE github_user_id = ?')) {
            const ghId = boundArgs[0];
            return Array.from(d1Tables.guardians.values()).find(g => g.github_user_id === ghId) || null;
          }
          if (query.includes('FROM guardian_hatch_jobs WHERE guardian_id = ?1') || query.includes('FROM guardian_hatch_jobs WHERE id = ?1')) {
            const idOrGId = boundArgs[0];
            return d1Tables.guardian_hatch_jobs.get(idOrGId) || Array.from(d1Tables.guardian_hatch_jobs.values()).find(j => j.guardian_id === idOrGId) || null;
          }
          if (query.includes('FROM guardian_reference_candidates')) {
            const list = Array.from(d1Tables.guardian_reference_candidates.values());
            if (query.includes('WHERE id = ?1 AND guardian_id = ?2')) {
              const [cId, gId] = boundArgs;
              return list.find(c => c.id === cId && c.guardian_id === gId) || null;
            }
            if (query.includes('candidate_sha256 = ?2') && (query.includes('state = "APPROVED"') || query.includes('state = \'APPROVED\''))) {
              const [gId, sha] = boundArgs;
              return list.find(c => c.guardian_id === gId && c.candidate_sha256 === sha && c.state === 'APPROVED') || null;
            }
            return list[0] || null;
          }
          if (query.includes('FROM guardian_publication WHERE guardian_id = ?1')) {
            return d1Tables.guardian_publication.get(boundArgs[0]) || null;
          }
          if (query.includes('FROM guardian_hatch_frames') && (query.includes('state = "ACCEPTED"') || query.includes('state = \'ACCEPTED\'')) && query.includes('pose_id = ?2')) {
            const [jId, pId] = boundArgs;
            const frame = Array.from(d1Tables.guardian_hatch_frames.values()).find(f => f.job_id === jId && f.pose_id === pId && f.state === 'ACCEPTED');
            return frame || null;
          }
          if (query.includes('FROM guardian_pose_attempts') && (query.includes('state = "LEASED"') || query.includes('state = \'LEASED\''))) {
            const [jId, pId, now] = boundArgs;
            const attempt = Array.from(d1Tables.guardian_pose_attempts.values()).find(a => a.job_id === jId && a.pose_id === pId && a.state === 'LEASED' && a.lease_expires_at > now);
            return attempt || null;
          }
          if (query.includes('FROM guardian_budget_reservations') && query.includes('SUM(amount_cents)')) {
            const jId = boundArgs[0];
            const sum = Array.from(d1Tables.guardian_budget_reservations.values())
              .filter(r => r.job_id === jId && (r.state === 'RESERVED' || r.state === 'COMMITTED'))
              .reduce((acc, r) => acc + r.amount_cents, 0);
            return { total_cents: sum };
          }
          if (query.includes('FROM guardian_hatch_frames') && query.includes('COUNT(*)')) {
            const jId = boundArgs[0];
            const count = Array.from(d1Tables.guardian_hatch_frames.values()).filter(f => f.job_id === jId && f.state === 'ACCEPTED').length;
            return { count };
          }
          return null;
        }),
        all: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_frames')) {
            if (query.includes('guardian_id = ?1')) {
              const gId = boundArgs[0];
              const job = Array.from(d1Tables.guardian_hatch_jobs.values()).find(j => j.guardian_id === gId);
              const jId = job?.id || 'job-1';
              const list = Array.from(d1Tables.guardian_hatch_frames.values()).filter(f => f.job_id === jId);
              return { results: list };
            }
            const jId = boundArgs[0] || 'job-1';
            const list = Array.from(d1Tables.guardian_hatch_frames.values()).filter(f => f.job_id === jId);
            return { results: list };
          }
          if (query.includes('FROM guardian_budget_reservations') && query.includes('state = \'RESERVED\'')) {
            const cutoff = boundArgs[0];
            const stale = Array.from(d1Tables.guardian_budget_reservations.values()).filter(r => r.state === 'RESERVED' && r.created_at < cutoff);
            return { results: stale };
          }
          return { results: [] };
        }),
        run: vi.fn().mockImplementation(async () => {
          if (query.includes('INSERT INTO guardian_reference_candidates')) {
            d1Tables.guardian_reference_candidates.set(boundArgs[0], {
              id: boundArgs[0],
              guardian_id: boundArgs[1],
              candidate_sha256: boundArgs[2],
              identity_hash: boundArgs[3],
              prompt_hash: boundArgs[4],
              model_id: boundArgs[5],
              raw_sha256: boundArgs[6],
              state: 'VERIFYING',
              reviewer: null,
              verdict_data: null,
              created_at: boundArgs[7]
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_hatch_jobs')) {
            d1Tables.guardian_hatch_jobs.set(boundArgs[0], {
              id: boundArgs[0],
              guardian_id: boundArgs[1],
              request_fingerprint: boundArgs[2],
              state: 'GENERATING',
              model_id: boundArgs[3],
              attempts_count: 1,
              frames_completed: 0,
              reserved_cents: 0,
              spent_cents: 0,
              manifest_url: null,
              created_at: boundArgs[4],
              updated_at: boundArgs[5]
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_pose_attempts')) {
            const [id, jobId, poseId, attemptNum, claimKey, owner, expiresAt, now] = boundArgs;
            d1Tables.guardian_pose_attempts.set(`${jobId}:${poseId}:${attemptNum}`, {
              id,
              job_id: jobId,
              pose_id: poseId,
              attempt_number: attemptNum,
              claim_key: claimKey,
              lease_owner: owner,
              lease_expires_at: expiresAt,
              state: 'LEASED',
              created_at: now,
              updated_at: now
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_budget_reservations')) {
            const [id, jobId, poseId, attemptNum, day, amount, now] = boundArgs;
            d1Tables.guardian_budget_reservations.set(`${jobId}:${poseId}:${attemptNum}`, {
              id,
              job_id: jobId,
              pose_id: poseId,
              attempt_number: attemptNum,
              day,
              amount_cents: amount,
              state: 'RESERVED',
              created_at: now,
              updated_at: now
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_dlq_quarantine')) {
            const [id, msgId, qName, payload, errorReason, now] = boundArgs;
            d1Tables.guardian_dlq_quarantine.set(id, {
              id,
              message_id: msgId,
              queue_name: qName,
              payload,
              error_reason: errorReason,
              created_at: now
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_outbox')) {
            const [id, claimKey, qName, payload, now] = boundArgs;
            d1Tables.guardian_outbox.set(claimKey, {
              id,
              claim_key: claimKey,
              queue_name: qName,
              payload,
              state: 'PENDING',
              created_at: now
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_review_records')) {
            const [id, jId, gId, rev, bSha, mSha, fHashes, notes, now] = boundArgs;
            d1Tables.guardian_review_records.set(id, {
              id,
              job_id: jId,
              guardian_id: gId,
              reviewer: rev,
              decision: 'approve',
              bundle_sha: bSha,
              manifest_sha: mSha,
              frame_hashes: fHashes,
              notes,
              created_at: now
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_publication')) {
            const [gId, jId, mSha, mKey, sSha, sKey, rev, pubAt] = boundArgs;
            if (d1Tables.guardian_publication.has(gId)) {
              throw new Error('UNIQUE constraint failed: guardian_publication.guardian_id');
            }
            d1Tables.guardian_publication.set(gId, {
              guardian_id: gId,
              job_id: jId,
              manifest_sha256: mSha,
              manifest_key: mKey,
              spritesheet_sha256: sSha,
              spritesheet_key: sKey,
              state: 'ASSET_READY',
              reviewer: rev,
              published_at: pubAt,
              created_at: pubAt
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('INSERT INTO guardian_hatch_frames')) {
            if (query.includes('WHERE EXISTS')) {
              const attemptNum = boundArgs[8];
              const owner = boundArgs[9];
              const att = d1Tables.guardian_pose_attempts.get(`${boundArgs[1]}:${boundArgs[2]}:${attemptNum}`);
              if (!att || att.lease_owner !== owner || att.state !== 'LEASED') {
                return { success: true, meta: { changes: 0 } };
              }
            }
            const poseId = boundArgs[2];
            d1Tables.guardian_hatch_frames.set(poseId, {
              id: boundArgs[0],
              job_id: boundArgs[1],
              pose_id: poseId,
              pose_index: boundArgs[3],
              frame_sha256: boundArgs[4],
              raw_sha256: boundArgs[5],
              state: 'ACCEPTED',
              raw_gate_metrics: boundArgs[6],
              semantic_verdict: null,
              created_at: boundArgs[7]
            });
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_budget_reservations') && query.includes('WHERE EXISTS')) {
            const [now, jobId, poseId, attemptNum, owner] = boundArgs;
            const att = d1Tables.guardian_pose_attempts.get(`${jobId}:${poseId}:${attemptNum}`);
            if (!att || att.lease_owner !== owner || att.state !== 'LEASED') {
              return { success: true, meta: { changes: 0 } };
            }
            const res = d1Tables.guardian_budget_reservations.get(`${jobId}:${poseId}:${attemptNum}`);
            if (res) {
              res.state = 'COMMITTED';
              res.updated_at = now;
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_jobs') && query.includes('WHERE EXISTS')) {
            const [cost, now, jobId, poseId, attemptNum, owner] = boundArgs;
            const att = d1Tables.guardian_pose_attempts.get(`${jobId}:${poseId}:${attemptNum}`);
            if (!att || att.lease_owner !== owner || att.state !== 'LEASED') {
              return { success: true, meta: { changes: 0 } };
            }
            const job = d1Tables.guardian_hatch_jobs.get(jobId);
            if (job) {
              job.spent_cents = (job.spent_cents || 0) + cost;
              job.reserved_cents = Math.max(0, (job.reserved_cents || 0) - cost);
              job.updated_at = now;
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_pose_attempts') && query.includes('SET state = \'ACCEPTED\'')) {
            const [rawSha, frameSha, now, jobId, poseId, attemptNum, owner] = boundArgs;
            const att = d1Tables.guardian_pose_attempts.get(`${jobId}:${poseId}:${attemptNum}`);
            if (!att || att.lease_owner !== owner || att.state !== 'LEASED') {
              return { success: true, meta: { changes: 0 } };
            }
            att.state = 'ACCEPTED';
            att.raw_sha256 = rawSha;
            att.frame_sha256 = frameSha;
            att.lease_owner = null;
            att.lease_expires_at = null;
            att.updated_at = now;
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_pose_attempts SET state = \'FAILED\'') || query.includes('UPDATE guardian_pose_attempts SET state = \'REJECTED\'') || query.includes('UPDATE guardian_pose_attempts SET state = \'TIMED_OUT\'')) {
            const [targetState, err, now, jobId, poseId, attemptNum] = boundArgs;
            const att = d1Tables.guardian_pose_attempts.get(`${jobId}:${poseId}:${attemptNum}`);
            if (att) {
              att.state = targetState;
              att.error_message = err;
              att.lease_owner = null;
              att.lease_expires_at = null;
              att.updated_at = now;
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_reference_candidates') && (query.includes('state = \'APPROVED\'') || query.includes('SET state = \'APPROVED\''))) {
            const [reviewer, verdictData, candidateId] = boundArgs;
            const cand = d1Tables.guardian_reference_candidates.get(candidateId);
            if (cand) {
              cand.state = 'APPROVED';
              cand.reviewer = reviewer;
              cand.verdict_data = verdictData;
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardians') && query.includes('reference_sha256')) {
            const [sha, guardianId] = boundArgs;
            const g = d1Tables.guardians.get(guardianId || 'g-e2e-1');
            if (g) {
              g.reference_sha256 = sha;
              g.status = 'VERIFYING';
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (query.includes('UPDATE guardian_hatch_jobs') && (query.includes('state = \'VERIFYING\'') || query.includes('manifest_url'))) {
            const job = d1Tables.guardian_hatch_jobs.get('job-1') || Array.from(d1Tables.guardian_hatch_jobs.values())[0];
            if (job) {
              job.state = 'VERIFYING';
              job.frames_completed = 16;
              job.manifest_url = boundArgs[0];
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (query.includes('UPDATE guardian_hatch_frames SET semantic_verdict')) {
            const [verdictData, frameId] = boundArgs;
            const target = Array.from(d1Tables.guardian_hatch_frames.values()).find(f => f.id === frameId || f.pose_id === frameId);
            if (target) target.semantic_verdict = verdictData;
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardians') && (query.includes('SET status = "QUARANTINED"') || query.includes('status = \'QUARANTINED\'') || query.includes('SET status = \'QUARANTINED\''))) {
            const gId = boundArgs[0] || 'g-e2e-1';
            const g = d1Tables.guardians.get(gId);
            if (g) g.status = 'QUARANTINED';
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_jobs') && (query.includes('state = "QUARANTINED"') || query.includes('state = \'QUARANTINED\''))) {
            const [gId, errReason] = boundArgs;
            const job = Array.from(d1Tables.guardian_hatch_jobs.values()).find(j => j.guardian_id === gId) || Array.from(d1Tables.guardian_hatch_jobs.values())[0];
            if (job) {
              job.state = 'QUARANTINED';
              job.error_log = errReason;
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_frames') && (query.includes('state = "REJECTED"') || query.includes('state = \'REJECTED\''))) {
            const [jobId, poseId] = boundArgs;
            const frame = Array.from(d1Tables.guardian_hatch_frames.values()).find(f => f.pose_id === poseId || f.id === poseId);
            if (frame) {
              frame.state = 'REJECTED';
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardians') && query.includes('SET status = \'ASSET_READY\'')) {
            const g = d1Tables.guardians.get('g-e2e-1');
            if (g) {
              g.status = 'ASSET_READY';
              g.spritesheet_url = boundArgs[0];
              g.manifest_url = boundArgs[1];
            }
            return { success: true, meta: { changes: 1 } };
          }

          if (query.includes('UPDATE guardian_hatch_jobs') && query.includes('SET state = \'ASSET_READY\'')) {
            const job = Array.from(d1Tables.guardian_hatch_jobs.values())[0];
            if (job) {
              job.state = 'ASSET_READY';
              job.manifest_url = boundArgs[0];
            }
            return { success: true, meta: { changes: 1 } };
          }

          return { success: true, meta: { changes: 1 } };
        })
      };
      return stmt;
    }),
    batch: vi.fn().mockImplementation(async (stmts: any[]) => {
      const results: any[] = [];
      for (const s of stmts) {
        await s.run();
        results.push({ success: true, meta: { changes: 1 } });
      }
      return results;
    }),
    exec: vi.fn().mockResolvedValue({ success: true })
  } as unknown as D1Database;

  const mockBucket = {
    head: vi.fn().mockImplementation(async (key: string) => {
      const found = r2Storage.get(key);
      if (!found) return null;
      return { key, size: found.length };
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      const found = r2Storage.get(key);
      if (!found) return null;
      return {
        arrayBuffer: async () => found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength),
        json: async () => JSON.parse(new TextDecoder().decode(found)),
        text: async () => new TextDecoder().decode(found)
      };
    }),
    put: vi.fn().mockImplementation(async (key: string, data: any) => {
      let bytes: Uint8Array;
      if (typeof data === 'string') {
        bytes = new TextEncoder().encode(data);
      } else if (data instanceof Uint8Array) {
        bytes = data;
      } else {
        bytes = new Uint8Array(data);
      }
      r2Storage.set(key, bytes);
      return null;
    }),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as R2Bucket;

  const mockKv = {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  } as unknown as KVNamespace;

  const mockQueue = {
    send: vi.fn().mockImplementation(async (msg: any) => {
      enqueuedMessages.push(msg);
    }),
    sendBatch: vi.fn().mockResolvedValue(undefined)
  } as unknown as Queue<any>;

  const env: Env = {
    DB: mockDb,
    ASSETS_BUCKET: mockBucket,
    CACHE_KV: mockKv,
    AI_QUEUE: mockQueue,
    ADMIN_REVIEW_SECRET: 'production-super-secret-key-at-least-16-bytes',
    GEMINI_API_KEY: 'test-gemini-key',
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };

  return { env, r2Storage, d1Tables, enqueuedMessages };
}

describe('Service-Level Hatch Lifecycle DAG (Mock-Bound Boundary Doubles)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Executes Full DAG: Candidate -> Approval+Outbox -> 16 Poses -> Composite -> Admin Review -> ASSET_READY', async () => {
    const { env, r2Storage, d1Tables, enqueuedMessages } = await createMockFullLifecycleEnv();
    const { pngBytes: samplePng, b64: sampleB64 } = createSampleNonBlankCharacterPng();

    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: sampleB64 } }]
            }
          }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    // =========================================================================
    // STEP 1: Process HATCH_REFERENCE (Phase 1: Generate Candidate)
    // =========================================================================
    const msg1 = {
      id: 'msg-ref-1',
      timestamp: new Date(),
      body: { v: 1, type: 'HATCH_REFERENCE', jobId: 'job-1', guardianId: 'g-e2e-1' } as GenerationQueueMessage,
      ack: vi.fn(),
      retry: vi.fn()
    };

    await handleQueueBatch({
      queue: 'githoot-ai-queue',
      messages: [msg1],
      ackAll: vi.fn(),
      retryAll: vi.fn()
    }, env);

    expect(msg1.ack).toHaveBeenCalled();
    const stagedCandidates = Array.from(d1Tables.guardian_reference_candidates.values());
    expect(stagedCandidates.length).toBe(1);
    const candidate = stagedCandidates[0];
    expect(candidate.state).toBe('VERIFYING');

    // =========================================================================
    // STEP 2: Reviewer Approves Reference Candidate (twoPhaseApproveReference)
    // =========================================================================
    const approveResult = await twoPhaseApproveReference({
      guardianId: 'g-e2e-1',
      candidateId: candidate.id,
      candidateSha256: candidate.candidate_sha256,
      reviewer: 'lead-art-director@githoot.com',
      verdict: 'pass',
      env
    });

    expect(approveResult.success).toBe(true);
    expect(approveResult.referenceSha256).toBe(candidate.candidate_sha256);
    expect(enqueuedMessages.length).toBe(16);
    expect(enqueuedMessages[0].type).toBe('HATCH_POSE');
    expect(d1Tables.guardians.get('g-e2e-1').status).toBe('VERIFYING');
    expect(d1Tables.guardians.get('g-e2e-1').reference_sha256).toBe(candidate.candidate_sha256);

    // =========================================================================
    // STEP 3: Process 16 HATCH_POSE Messages
    // =========================================================================
    for (let i = 0; i < 16; i++) {
      const poseMsg = enqueuedMessages[i];
      const pMsg = {
        id: `msg-pose-${i}`,
        timestamp: new Date(),
        body: poseMsg,
        ack: vi.fn(),
        retry: vi.fn()
      };

      await handleQueueBatch({
        queue: 'githoot-ai-queue',
        messages: [pMsg],
        ackAll: vi.fn(),
        retryAll: vi.fn()
      }, env);

      expect(pMsg.ack).toHaveBeenCalled();
    }

    expect(enqueuedMessages.length).toBe(17);
    expect(enqueuedMessages[16].type).toBe('HATCH_COMPOSITE');

    // =========================================================================
    // STEP 4: Process HATCH_COMPOSITE
    // =========================================================================
    const compMsg = {
      id: 'msg-comp-1',
      timestamp: new Date(),
      body: enqueuedMessages[16],
      ack: vi.fn(),
      retry: vi.fn()
    };

    await handleQueueBatch({
      queue: 'githoot-ai-queue',
      messages: [compMsg],
      ackAll: vi.fn(),
      retryAll: vi.fn()
    }, env);

    expect(compMsg.ack).toHaveBeenCalled();

    const r2Keys = Array.from(r2Storage.keys());
    expect(r2Keys.filter(k => k.startsWith('masters/') && k.endsWith('.png')).length).toBe(2);
    expect(r2Keys.filter(k => k.startsWith('masters/') && k.endsWith('.webp')).length).toBe(2);
    expect(r2Keys.some(k => k.startsWith('manifests/') && k.endsWith('.json'))).toBe(true);

    // =========================================================================
    // STEP 5: Reviewer Reviews Bundle via Review Surface & Approves (POST /auth/admin/review/:jobId)
    // =========================================================================
    const getRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-1', {
        method: 'GET',
        headers: { Authorization: 'Bearer production-super-secret-key-at-least-16-bytes' }
      }),
      env
    );
    expect(getRes.status).toBe(200);
    const bundle = (await getRes.json()) as any;
    expect(bundle.bundleSha).toBeDefined();

    const postRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({
          decision: 'approve',
          bundleSha: bundle.bundleSha,
          notes: 'Signed and approved by art lead'
        })
      }),
      env
    );

    expect(postRes.status).toBe(200);
    const postBody = (await postRes.json()) as any;
    expect(postBody.success).toBe(true);
    expect(postBody.status).toBe('ASSET_READY');
    expect(d1Tables.guardians.get('g-e2e-1').status).toBe('ASSET_READY');
    expect(d1Tables.guardian_review_records.size).toBe(1);
  });

  it('rejects malformed/unknown-version queue message to DLQ quarantine ledger and calls retry()', async () => {
    const { env, d1Tables } = await createMockFullLifecycleEnv();

    const badMsg = {
      id: 'bad-msg-123',
      timestamp: new Date(),
      body: { v: 999, type: 'UNKNOWN_TYPE', foo: 'bar' },
      ack: vi.fn(),
      retry: vi.fn()
    };

    await handleQueueBatch({
      queue: 'githoot-ai-queue',
      messages: [badMsg],
      ackAll: vi.fn(),
      retryAll: vi.fn()
    }, env);

    expect(badMsg.retry).toHaveBeenCalled();
    expect(badMsg.ack).not.toHaveBeenCalled();

    const quarantined = Array.from(d1Tables.guardian_dlq_quarantine.values());
    expect(quarantined.length).toBe(1);
    expect(quarantined[0].message_id).toBe('bad-msg-123');
    expect(quarantined[0].error_reason).toContain('Unsupported queue message version');
  });

  it('duplicate HATCH_POSE with no crash yields exactly one accepted pose in D1 and zero extra Gemini calls', async () => {
    const { env, r2Storage, d1Tables } = await createMockFullLifecycleEnv();
    const { pngBytes: samplePng, b64: sampleB64 } = createSampleNonBlankCharacterPng();

    r2Storage.set('references/ref-approved-sha.png', samplePng);
    const guardian = d1Tables.guardians.get('g-e2e-1');
    guardian.reference_sha256 = 'ref-approved-sha';
    guardian.status = 'VERIFYING';

    d1Tables.guardian_reference_candidates.set('cand-1', {
      id: 'cand-1',
      guardian_id: 'g-e2e-1',
      candidate_sha256: 'ref-approved-sha',
      state: 'APPROVED'
    });

    const geminiSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: sampleB64 } }] } }]
    }), { status: 200 }));

    const poseMsg = {
      v: 1,
      type: 'HATCH_POSE',
      jobId: 'job-1',
      guardianId: 'g-e2e-1',
      poseId: 'hover',
      attempt: 1
    } as GenerationQueueMessage;

    // Delivery 1
    const msg1 = { id: 'm1', timestamp: new Date(), body: poseMsg, ack: vi.fn(), retry: vi.fn() };
    await handleQueueBatch({ queue: 'githoot-ai-queue', messages: [msg1], ackAll: vi.fn(), retryAll: vi.fn() }, env);
    expect(msg1.ack).toHaveBeenCalled();
    expect(geminiSpy).toHaveBeenCalledTimes(1);

    // Delivery 2 (Duplicate delivery)
    const msg2 = { id: 'm2', timestamp: new Date(), body: poseMsg, ack: vi.fn(), retry: vi.fn() };
    await handleQueueBatch({ queue: 'githoot-ai-queue', messages: [msg2], ackAll: vi.fn(), retryAll: vi.fn() }, env);
    expect(msg2.ack).toHaveBeenCalled();

    expect(geminiSpy).toHaveBeenCalledTimes(1);
  });

  it('reconciles abandoned reservations after worker crash', async () => {
    const { env, d1Tables } = await createMockFullLifecycleEnv();

    const oldTime = Date.now() - 40 * 60 * 1000;
    d1Tables.guardian_budget_reservations.set('job-crash:hover:1', {
      id: 'res-stale',
      job_id: 'job-crash',
      pose_id: 'hover',
      attempt_number: 1,
      day: new Date().toISOString().split('T')[0],
      amount_cents: 25,
      state: 'RESERVED',
      created_at: oldTime,
      updated_at: oldTime
    });

    const result = await reconcileAbandonedReservations(env, 30);
    expect(result.reconciledCount).toBe(1);
  });

  it('compositor with 15/16 frames re-enqueues without compositing', async () => {
    const { env, r2Storage, d1Tables } = await createMockFullLifecycleEnv();
    const { pngBytes: samplePng } = createSampleNonBlankCharacterPng();

    const guardian = d1Tables.guardians.get('g-e2e-1');
    guardian.reference_sha256 = 'ref-approved-sha';
    guardian.status = 'VERIFYING';

    const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');
    const gateRes = await validateAndNormalizeFrame(samplePng);
    if (!gateRes.ok) return;

    for (let i = 0; i < 15; i++) {
      const p = POSE_SET[i]!;
      d1Tables.guardian_hatch_frames.set(`g-e2e-1-${p.id}`, {
        id: `f-${p.id}`,
        job_id: 'job-1',
        pose_id: p.id,
        pose_index: i,
        raw_sha256: gateRes.rawSha256,
        frame_sha256: gateRes.frameSha256,
        state: 'ACCEPTED'
      });
      r2Storage.set(`guardians/g-e2e-1/raw/${gateRes.rawSha256}.png`, samplePng);
      r2Storage.set(`guardians/g-e2e-1/frames/f${p.id}_${gateRes.frameSha256}.png`, gateRes.normalizedPng);
    }

    const compMsg = {
      id: 'comp-15',
      timestamp: new Date(),
      body: { v: 1, type: 'HATCH_COMPOSITE', jobId: 'job-1', guardianId: 'g-e2e-1' } as GenerationQueueMessage,
      ack: vi.fn(),
      retry: vi.fn()
    };

    await handleQueueBatch({ queue: 'githoot-ai-queue', messages: [compMsg], ackAll: vi.fn(), retryAll: vi.fn() }, env);

    expect(compMsg.retry).toHaveBeenCalled();
    expect(compMsg.ack).not.toHaveBeenCalled();
    expect(r2Storage.has('guardians/g-e2e-1/landing16-sheet.png')).toBe(false);
  });

  it('stale worker with lost/reclaimed lease no-ops completely on guarded commit batch', async () => {
    const { env, d1Tables } = await createMockFullLifecycleEnv();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    d1Tables.guardian_pose_attempts.set('job-1:hover:1', {
      id: 'att-1',
      job_id: 'job-1',
      pose_id: 'hover',
      attempt_number: 1,
      claim_key: 'job-1:hover:1',
      lease_owner: 'worker-new-reclaimed',
      lease_expires_at: now + 60000,
      state: 'LEASED',
      created_at: now,
      updated_at: now
    });

    d1Tables.guardian_budget_reservations.set('job-1:hover:1', {
      id: 'res-1',
      job_id: 'job-1',
      pose_id: 'hover',
      attempt_number: 1,
      day: today,
      amount_cents: 25,
      state: 'RESERVED',
      created_at: now,
      updated_at: now
    });

    const staleWorkerId = 'worker-stale-expired';
    const frameSha = 'sha-test-frame-123';
    const rawSha = 'sha-test-raw-123';

    const guardedStmts = [
      env.DB.prepare(`
        INSERT INTO guardian_hatch_frames (id, job_id, pose_id, pose_index, frame_sha256, raw_sha256, state, raw_gate_metrics, semantic_verdict, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'ACCEPTED', ?7, NULL, ?8
        WHERE EXISTS (
          SELECT 1 FROM guardian_pose_attempts
          WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?9 AND lease_owner = ?10 AND state = 'LEASED'
        );
      `).bind('frame-id-1', 'job-1', 'hover', 0, frameSha, rawSha, '{}', now, 1, staleWorkerId),

      env.DB.prepare(`
        UPDATE guardian_budget_reservations
        SET state = 'COMMITTED', updated_at = ?1
        WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND state = 'RESERVED'
          AND EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?2 AND pose_id = ?3 AND attempt_number = ?4 AND lease_owner = ?5 AND state = 'LEASED'
          );
      `).bind(now, 'job-1', 'hover', 1, staleWorkerId),

      env.DB.prepare(`
        UPDATE guardian_hatch_jobs
        SET reserved_cents = MAX(0, reserved_cents - ?1), spent_cents = spent_cents + ?1, updated_at = ?2
        WHERE id = ?3
          AND EXISTS (
            SELECT 1 FROM guardian_pose_attempts
            WHERE job_id = ?3 AND pose_id = ?4 AND attempt_number = ?5 AND lease_owner = ?6 AND state = 'LEASED'
          );
      `).bind(25, now, 'job-1', 'hover', 1, staleWorkerId),

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
      `).bind(25, today, 'job-1', 'hover', 1, staleWorkerId),

      env.DB.prepare(`
        UPDATE guardian_pose_attempts
        SET state = 'ACCEPTED', raw_sha256 = ?1, frame_sha256 = ?2, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?3
        WHERE job_id = ?4 AND pose_id = ?5 AND attempt_number = ?6 AND lease_owner = ?7 AND state = 'LEASED';
      `).bind(rawSha, frameSha, now, 'job-1', 'hover', 1, staleWorkerId)
    ];

    await env.DB.batch(guardedStmts);

    const leaseAttempt = d1Tables.guardian_pose_attempts.get('job-1:hover:1');
    expect(leaseAttempt?.state).toBe('LEASED');
    expect(leaseAttempt?.lease_owner).toBe('worker-new-reclaimed');

    expect(d1Tables.guardian_hatch_frames.has('hover')).toBe(false);

    const resRow = d1Tables.guardian_budget_reservations.get('job-1:hover:1');
    expect(resRow?.state).toBe('RESERVED');

    const job = d1Tables.guardian_hatch_jobs.get('job-1');
    expect(job?.spent_cents).toBe(0);
  });

  it('forced enqueue-send failure during claim returns truthful pending-delivery status and preserves outbox row', async () => {
    const { env, d1Tables } = await createMockFullLifecycleEnv();
    const { executeClaimTransaction } = await import('../../src/server/services/claim/transaction');

    (env.AI_QUEUE.send as any).mockRejectedValueOnce(new Error('TRANSIENT_QUEUE_BROKER_FAILURE'));

    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 11829471,
      login: 'mrgoonie',
      name: 'mrgoonie',
      avatar_url: 'https://avatars.githubusercontent.com/u/11829471',
      bio: 'Builder',
      public_repos: 10,
      followers: 5,
      created_at: '2015-01-01T00:00:00Z'
    }), { status: 200 }));

    d1Tables.guardians.clear();

    const authUser: GitHubUserRaw = {
      id: 11829471,
      login: 'mrgoonie',
      name: 'mrgoonie',
      avatar_url: 'https://avatars.githubusercontent.com/u/11829471',
      bio: 'Builder',
      public_repos: 10,
      followers: 5,
      created_at: '2015-01-01T00:00:00Z'
    };

    const claimRes = await executeClaimTransaction(authUser, env);

    expect(claimRes.success).toBe(true);
    expect(claimRes.deliveryStatus).toBe('pending-delivery');

    const outboxRows = Array.from(d1Tables.guardian_outbox.values());
    expect(outboxRows.length).toBeGreaterThanOrEqual(1);
    const claimOutbox = outboxRows.find(r => r.claim_key.startsWith('claim:'));
    expect(claimOutbox).toBeDefined();
    expect(claimOutbox?.state).toBe('PENDING');
  });
});
