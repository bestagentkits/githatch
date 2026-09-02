---
phase: 4
title: "Resumable Per-Pose Queue DAG, Envelope & Cost Control"
status: completed
priority: P1
effort: "2.5d"
dependencies: [3]
---

# Phase 4: Resumable Per-Pose Queue DAG, Envelope & Cost Control

## Overview

Make the hatch DAG **per-pose, schema-validated, resumable, and cost-bounded** on an at-least-once queue. Today one invocation runs up to 16 sequential poses (worst case ≈ 24.8 min > the 15-min wall limit), exhausted poses and missing frames fall through to `message.ack()`, enqueue failures in claim/approval are swallowed as success, the queue is `Queue<any>` with unchecked `JSON.parse`, and no lease exists so duplicate deliveries can double Gemini spend.

## Binding Generation Contract (`AGENTS.md` invariant #4, lines 41–47)

The model is never trusted to emit an exact grid; generate **one pose per API call** and composite locally. The DAG emits `HATCH_REFERENCE`, sixteen `HATCH_POSE {jobId,poseId,attempt}`, and one `HATCH_COMPOSITE {jobId}`. The **lease / retry / budget unit is the pose.** Each pose output is a single-subject frame validated by the Phase 3 contour gate. `AGENTS.md` is the standing rule and is not edited to fit this plan; the older 4×2 phrasing elsewhere is superseded by the checked-in per-pose rule.

## At-Least-Once Reality (Cloudflare Queues)

Cloudflare Queues deliver **at least once** — duplicates are expected, not a bug. The goal is not "no double delivery" but an **idempotent consumer**: a deterministic per-attempt claim key + a durable ledger + a unique accepted row so any duplicate delivery converges to exactly one accepted pose in D1 and keeps provider spend within the ledger/caps. A crash after send-before-mark legitimately re-delivers; the test asserts convergence, not suppression of the redelivery.

## Requirements
- **Typed, versioned envelope (#11c):** `Queue<GenerationQueueMessage>` = versioned discriminated union `{v:1,type:'HATCH_REFERENCE',jobId}` | `{v:1,type:'HATCH_POSE',jobId,poseId,attempt}` | `{v:1,type:'HATCH_COMPOSITE',jobId}`. Every consume and every `JSON.parse` boundary runs a runtime schema parse (omptype/zod); invalid/unknown payloads quarantine to the DLQ, never reaching business logic.
- **Per-pose lease + idempotency:** a D1 attempt ledger with a **deterministic claim key** (`(job_id,pose_id,attempt)`), a conditional lease (`lease_owner`,`lease_expires_at`), and a unique `(job_id,pose_id)` accepted row. A duplicate `HATCH_POSE` finds the pose already accepted or leased and no-ops.
- **Retry-not-ack:** any incomplete pose or absent frame object persists state and retries with delay; never ack success. DLQ with alerting + a replay runbook.
- **Operational outbox (#6):** an idempotent scheduled drainer (Cron Trigger) with claim keys, delivery marking, reclaim timeout, exponential backoff, poison handling, an oldest-age alert, and a replay procedure. Claim/approval write the intended message to a D1 `outbox` row in the **same transaction** as the state change, then best-effort send; the drainer guarantees eventual delivery. Claim returns `accepted`/`pending-delivery` truthfully; failure only if the durable commit failed.
- **Corrected external-charge invariant (#7):** a lease bounds concurrency, not provider billing after a crash. Guarantee: (a) no concurrent/unleased Gemini call; (b) exactly one accepted frame per `(job,pose)` in D1; (c) a durable per-attempt ledger; (d) bounded retries; (e) a per-job **and** per-day hard spend cap in `budget-guard` before every call; (f) reconciliation of abandoned reservations. Covers **reference and pose calls**. Exactly-one *external call* holds only in the no-crash duplicate-delivery test; after a crash the ledger + caps bound (not eliminate) an extra call.
- Non-functional: worst-case measured single-pose invocation under a defined safety margin below 15 min.

## Architecture
- Migration `0003`: `guardian_pose_attempts` (deterministic claim key, lease, attempt counter, reservation state, unique accepted `(job,pose)`), `outbox` (message, claim_key, state, next_attempt_at), per-job/day spend counters.
- Consumer dispatch by `type` after schema parse: `HATCH_REFERENCE` (reference gen + Phase 3 gate under lease), `HATCH_POSE` (one pose gen + gate + checkpoint under lease + budget reserve/commit), `HATCH_COMPOSITE` (verify 16 accepted, composite, hand to P5).
- Budget: `budget-guard` atomically reserves (lease + spend decrement) before a call; commits on success, releases on failure; a sweeper reconciles reservations older than the lease timeout.
- Outbox drainer: a scheduled Worker handler drains due rows single-flight, marks delivered, backs off, DLQs poison after N attempts.

## Related Code Files
- Modify: `src/worker/queue-consumer.ts` (thin adapter), `src/server/queue/generation-worker.ts` (schema dispatch; per-pose lease; compositor split; retry-not-ack)
- Create: `src/server/queue/message-schema.ts`, `src/server/queue/outbox.ts`, `src/server/db/migrations/0003_pose_leases_outbox_budget.sql`
- Modify: `src/server/services/claim/transaction.ts`, `src/server/services/ai/reference-manager.ts`, `src/server/services/billing/budget-guard.ts`, `src/server/types/index.ts` (`Queue<GenerationQueueMessage>`)
- Modify: `wrangler.worker.toml` (DLQ; Cron Trigger for drainer; `max_batch_size=1`; `max_concurrency` set in P7)

## Implementation Steps
1. Write `message-schema.ts` (versioned discriminated union incl. `poseId`); type the queue; parse at every consume/`JSON.parse`; quarantine invalid to DLQ.
2. Migration `0003`: pose attempt ledger + deterministic claim key + lease + unique accepted row + outbox + spend counters.
3. Split the consumer into reference / pose / compositor handlers with schema dispatch.
4. Pose handler: conditional lease claim → budget reserve → Gemini call → Phase 3 gate → checkpoint accepted → commit. Failure to acquire lease ⇒ ack (another worker owns it) since state is durable.
5. `budget-guard` atomic reserve before each call; commit/release; per-job+per-day caps; reconciliation sweeper.
6. Transactional outbox in claim/approval; Cron drainer; remove all swallowed `catch → success`.
7. Compositor re-enqueues with delay on <16 accepted frames; wire DLQ + alerts.
8. **Update Internal Documentation (`/ak:docs update`):** refresh `docs/system-architecture.md` to document the per-pose Queue DAG topology, versioned message schema, at-least-once idempotency ledger, and transactional outbox drainer architecture.

## TDD Gate (tests-first)
- [x] **RED:** malformed/unknown-version queue payload ⇒ DLQ quarantine, never reaches business logic (fails today).
- [x] **RED:** duplicate `HATCH_POSE` with no crash ⇒ exactly one accepted pose in D1, exactly one Gemini call (fails today).
- [x] **RED (at-least-once):** send-before-mark crash re-delivers the pose ⇒ deterministic claim key + unique accepted row converge to one accepted pose and spend stays within the cap; the redelivery is expected, not suppressed (fails today).
- [x] **RED:** worker crash after Gemini-accept before commit ⇒ reservation reconciled, retry bounded, per-job/day cap not exceeded (fails today).
- [x] **RED:** exhausted pose attempts ⇒ resumable/retried, message NOT acked success (fails today).
- [x] **RED:** forced enqueue-send failure in claim ⇒ claim returns `pending-delivery`; outbox row persists; drainer later delivers (fails today).
- [x] **RED:** compositor with 15/16 frames ⇒ re-enqueue, no composite (fails today).
- [x] **GREEN:** all pass; **timing:** measured worst-case single-pose invocation under the safety margin.

## Success Criteria
- [x] Per-pose fan-out (16 pose messages + reference + compositor); each frame single-subject contour-validated (Phase 3), never fixed-slice.
- [x] Typed versioned envelope; invalid payloads DLQ; no `Queue<any>`/unchecked `JSON.parse` remain (grep clean).
- [x] Idempotent consumer: any duplicate delivery converges to one accepted pose; spend bounded by per-job/day caps; abandoned reservations reconciled (reference + poses).
- [x] No code path acks success on incomplete/failed generation.
- [x] Outbox operational (drainer, claim keys, backoff, poison, alert, replay runbook); claim returns truthful status.
- [x] Measured worst-case single-pose duration under the margin below 15 min; DLQ replay documented.
- [x] Internal documentation in `docs/system-architecture.md` refreshed via `/ak:docs update`.
## Risk Assessment
- **Risk:** lease orphans on worker death. **Signal:** poses stuck leased. **Response:** `lease_expires_at` + reclaim + stuck-pose sweeper + alert.
- **Risk:** duplicate delivery still causes a duplicate accepted row. **Signal:** two accepted rows for one `(job,pose)`. **Response:** the unique `(job_id,pose_id)` accepted constraint is the backstop; the deterministic claim key prevents the second call from committing.
- **Assumption that may break:** no Gemini provider idempotency key exists. **Signal:** provider docs reveal one. **Response:** strengthen the post-crash bound toward exactly-once using it; otherwise ledger+cap+reconcile is the ceiling.
