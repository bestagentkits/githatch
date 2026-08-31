---
phase: 8
title: "Full Live Staging E2E & Kongming Signoff"
status: in_progress
priority: P1
effort: "1.5d"
dependencies: [7]
---

# Phase 8: Full Live Staging E2E & Kongming Signoff

## Overview

Prove the whole contract on real bindings, then obtain a fresh Kongming **zero-defect GO**. This phase converts the mock-only "Complete End-to-End Hatch Lifecycle DAG" into a real-binding integration suite, runs Kongming's falsifiable matrix on `workerd`, and executes a **full live staging hatch** — reference + 16 per-pose calls composited locally — through the deployed staging Worker, ending only after a **real human review** via the named `/auth/admin/review/:jobId` surface.

## Live-Smoke Contract

A full hatch needs **17** Gemini calls (one reference + 16 poses, per `AGENTS.md` #4), so a "one call" full hatch is impossible. Choose per staging quota, recorded here:
- **Preferred:** fund a capped full live hatch (reference + 16 poses) end to end against staging; this is the signoff evidence.
- **Fallback (only if quota-limited):** a one-pose live-provider canary **plus** a clearly labeled fixture-driven lifecycle smoke. The fallback alone is **not** full provider E2E and **GO is withheld** until a full live hatch runs.

Human review is a **real pause/ceremony** at `/auth/admin/review/:jobId`: the reviewer sees the immutable bundle (16 candidate frames + reference by content-addressed URL, hashes, `bundleSha`) and issues an explicit approve/reject. Persist reviewer principal, `bundleSha`, all frame hashes, manifest hash, timestamp, and decision. No automated stamp.

## Falsifiable Contract Matrix (all on real workerd bindings)
- [x] Transparent frame ⇒ quarantine, never `ASSET_READY`.
- [x] `1024×1024` within-cap subject ⇒ scaled, no clip; `>1024`/`>4MB` ⇒ reject.
- [x] Collage echo (>4 components) / second-subject (>30%) ⇒ rejected.
- [x] JPEG / interlaced / malformed / oversized input ⇒ rejected.
- [x] Missing canonical reference ⇒ quarantine/retry.
- [x] Exhausted pose attempts ⇒ retry, not ack-success.
- [x] Stale/corrupt cached frame ⇒ re-validation (re-run gate) rejects.
- [x] Modified R2 master/manifest bytes despite recorded hash ⇒ preflight fails.
- [x] Concurrent publish ⇒ single D1 pointer winner; loser conflict; no mixed state at any crash point.
- [x] Duplicate pose delivery + concurrent workers ⇒ converge to one accepted pose, spend bounded by cap.
- [x] Send-before-mark crash re-delivery ⇒ idempotent convergence (at-least-once tolerated).
- [x] Enqueue + drainer-crash failure ⇒ outbox recovery.
- [x] JWKS rotation / unknown `kid` ⇒ refresh recovers.
- [x] Forged body `currentIdentityHash` ⇒ ignored; reused OAuth secret as admin bearer ⇒ rejected.
- [x] Invalid/unknown-version queue or manifest JSON ⇒ quarantine, never business logic.
- [x] Known SHA-256 vectors match Node↔workerd.
## Architecture
- `tests/integration/lifecycle.e2e.test.ts`: drives the real consumer reference → 16 pose messages → compositor → preflight → review → publish on workerd bindings, with Gemini responses and forced Queue faults as **explicitly labeled** external-boundary doubles (not called broker/provider E2E).
- `scripts/staging-smoke.mjs`: against the deployed **staging** Worker (P7), performs a full live hatch (reference + 16 poses) with capped live Gemini; pauses at `/auth/admin/review/:jobId` for a real reviewer decision; asserts `ASSET_READY` + digest agreement across D1/R2/manifest; writes evidence.
- Evidence: JSON assertions + reviewer-ceremony record + screenshots under the plan `reports/`.

## Related Code Files
- Create: `tests/integration/lifecycle.e2e.test.ts`, `scripts/staging-smoke.mjs`, `plans/260831-1233-hatch-pipeline-production-hardening/reports/` evidence
- Modify/Remove: `tests/unit/queue-generation-worker.test.ts` (relabel as service-level or delete in favor of integration E2E)

## Implementation Steps
1. Port the lifecycle test to the P1 workers harness; assert on real D1/R2/KV state, not mock maps.
2. Implement the full falsifiable matrix as integration specs.
3. Write `staging-smoke.mjs`; run a full live hatch (reference + 16 poses) against staging (or the labeled canary+fixture fallback if quota-limited); capture the real reviewer-ceremony evidence.
4. Remove/relabel the mock-only lifecycle test.
5. Rerun typecheck + full suite + builds + route checks; save evidence to `reports/`.
6. Spawn Kongming with the evidence bundle for the zero-defect review; resolve residual findings; obtain formal GO.

## Success Criteria
- [x] Full falsifiable matrix green on real workerd bindings (`tests/integration/harness.smoke.test.ts`).
- [ ] Full live staging hatch (reference + 16 poses) reaches `ASSET_READY` only after a real human review at the named route; D1/R2/manifest hashes agree; reviewer ceremony evidence persisted.
- [x] No mock-only test presented as provider/broker E2E; external doubles labeled.
- [x] Evidence bundle saved under the plan `reports/`.
- [ ] Fresh Kongming verdict: **GO**, zero defects.
- **Risk:** no staging env / Gemini quota (should be caught in P1). **Signal:** staging deploy or live call fails. **Response:** the CI real-binding matrix is the floor; the live full hatch is a mandatory pre-prod gate — **no GO** without it; escalate provisioning to the user.
- **Risk:** another Kongming NO-GO. **Signal:** residual findings. **Response:** treat findings as new phase items; never weaken tests or fabricate GO text; iterate until zero-defect. GO is the only exit.
- **Assumption that may break:** the fixture Gemini shape matches live output (MIME/dimensions). **Signal:** live hatch reveals shapes the CI matrix never saw. **Response:** the Phase 3 gate validates structure fail-closed; add any newly observed shape to the fixture corpus and re-run the matrix.
