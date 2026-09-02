---
phase: 5
title: "Atomic Publication Integrity & Single Pointer"
status: completed
priority: P1
effort: "2d"
dependencies: [4]
---

# Phase 5: Atomic Publication Integrity & Single Pointer

## Overview

Make publication prove **byte integrity + full cross-field agreement** and be an **atomic single-winner transition** with no cross-store race. Today preflight checks only object presence and truthy manifest hash strings (gate metrics need only a >5-char string), the final CAS checks nothing, the manifest is written `VERIFYING` before D1 and never updated to `ASSET_READY`, and four fixed master keys are served `immutable` despite being overwritable.

## Committed Scheme (per plan-review edit #8)

Content-addressed everything, immutable-first, one D1-selected pointer:
1. Write immutable content-addressed bytes to R2 first: `masters/<sheetSha>.png/.webp`, `masters/<stripSha>.png/.webp`, and a **content-addressed manifest** `manifests/<manifestSha>.json` whose own body lists all frame + master digests and identity/reference/model/version fields. Immutable objects are safe to cache long.
2. Then perform **one authoritative single-row D1 CAS** — a unique insert into `guardian_publication(guardian_id)` electing exactly one winner that carries `<manifestSha>` + `state='ASSET_READY'`. A duplicate insert violates the unique constraint (the loser signal); no multi-row batch is the primitive. Readers resolve the guardian's public manifest **only** via this pointer row.
3. **After** the CAS wins, apply `guardians.status` and `guardian_hatch_jobs.state` as **idempotent projections** of the winning pointer — each a standalone update safe to re-apply and tolerant of `changes:0` (a crash between CAS and projection is recovered by re-running the projection from the pointer, or lazily by readers who already trust only the pointer). The projections are **not** part of the atomic decision; the pointer row is the single source of publication truth.
4. Because bytes are immutable and the decision is a single-row insert, every crash point leaves either no pointer or a pointer to a complete manifest — never mixed visible state. Orphaned pre-pointer objects are swept by lifecycle cleanup.

Checking `meta.changes` after a multi-statement batch is **not** rollback (D1 rolls back on statement failure, not on a successful `changes:0`); the single-primitive design avoids the mixed-commit window entirely.

## Requirements
- Preflight recomputes SHA-256 over **every authoritative object** in R2 (16 frames + 4 masters + the manifest) and requires each to equal the value recorded in D1. The manifest's identity is its content-addressed key (`manifests/<manifestSha>.json`) and the D1 pointer — the manifest body is **not** required to contain its own SHA-256; it lists the frame + master digests. No sampling (plan-review edit #10).
- Preflight verifies **cross-field agreement** between D1 and the manifest body: identity hash, telemetry-snapshot hash, reference hash, model id, prompt/version fields, pose ids/indices (0–15 unique), object keys, and per-object digests.
- Gate metrics are re-parsed **and recomputed** by re-running the Phase 3 (TS contour) extraction over the retained `raw/<sha>` input and matching the accepted normalized frame hash — not a string-length check.
- **Verdict contract owned here (executable closure):** P5 defines `manifest-schema.ts`'s `SemanticVerdict` type + a `verdict-contract.ts` (verdict bound to `frame_sha256`, reviewer, timestamp) so P5 tests can seed fully-specified passing/failing verdicts and turn green **without** P6. P5 enforces the 16 hash-bound verdicts are present and structurally valid; **exact-review-provenance enforcement** (that a real reviewer saw the exact bytes) is deferred to P6, which populates the contract from the named review route.
- Publication is the single D1 pointer primitive; a loser observes no state change and returns a truthful `conflict`; an already-published guardian with matching digests returns idempotent success.
- Master + manifest objects are content-addressed and may keep long `immutable` caching **because** their keys are digests.

## Related Code Files
- Modify: `src/server/services/claim/publication-preflight.ts` (byte-digest over all objects; cross-field agreement; gate re-run; reference-binding)
- Modify: `src/server/services/ai/hatch-admin.ts` (single D1 pointer primitive; conflict/idempotent semantics)
- Modify: `src/server/queue/generation-worker.ts` (compositor writes content-addressed immutable masters + manifest; no mutable final manifest)
- Create: `src/server/services/claim/manifest-schema.ts` (typed parse), `src/server/db/migrations/0004_publication_pointer.sql` (one-winner pointer)
- Reference: `src/server/services/crypto/web-crypto.ts`; Phase 3 retained `raw/<sha>` objects

## Implementation Steps
1. Define `manifest-schema.ts` typed parser (identity/reference/model/version/pose map/digests); preflight rejects on parse failure.
2. Compositor: write content-addressed immutable masters + content-addressed manifest; record digests + keys in D1.
3. Preflight: recompute SHA-256 over all 16 frames + 4 masters + manifest; require D1==manifest==bytes; verify cross-field agreement; re-run the Phase 3 TS contour extraction over retained `raw/<sha>` to reproduce accepted frame hashes; verify 16 hash-bound verdicts.
4. Replace both publish sites with the single D1 pointer primitive; loser ⇒ conflict; already-published+matching ⇒ idempotent success.
5. Migration `0004`: one-winner `guardian_publication` pointer + state transition; readers resolve via it.
6. Lifecycle cleanup for orphaned pre-pointer objects.
7. **Update Internal Documentation (`/ak:docs update`):** refresh `docs/system-architecture.md` to document the single-row D1 pointer publication protocol, content-addressed manifest schema, and cryptographic byte-digest verification rules.

## TDD Gate (tests-first)
- [x] **RED:** manifest lists a correct hash but the R2 bytes are mutated ⇒ preflight fails (fails today: passes on presence).
- [x] **RED:** D1 identity/reference/model/pose-map disagrees with the manifest ⇒ preflight fails (fails today: not checked).
- [x] **RED:** `raw_gate_metrics` junk / gate re-run does not reproduce the accepted frame hash ⇒ preflight fails (fails today: >5-char string passes).
- [x] **RED:** concurrent publish ⇒ exactly one winner points the guardian; the loser gets `conflict`, no mixed state (fails today).
- [x] **RED (crash matrix):** inject a crash after each R2 write, before/after the single-row CAS, and **between the CAS and the guardian/job projection** ⇒ readers still resolve `ASSET_READY` via the pointer, re-running the projection converges, and no partial/mutable manifest or mixed state is ever visible (fails today).
- [x] **RED:** resolved public manifest state is `ASSET_READY` and equals the pointer target (fails today: stays VERIFYING).
- [x] **GREEN:** all pass; **regression:** happy-path publish reaches `ASSET_READY` with agreeing surfaces.

## Success Criteria
- [x] Preflight recomputes digests over all 16 frames + 4 masters + manifest (no sampling) and verifies full cross-field agreement.
- [x] Gate metrics verified by re-running the Phase 3 TS contour extraction, not string length.
- [x] Publication is a single-row D1 CAS; losers hit the unique constraint and get a truthful conflict; idempotent on re-publish; guardian/job status are idempotent projections applied after the CAS, tolerant of `changes:0`.
- [x] No crash point leaves mixed visible state; readers resolve only the D1-selected content-addressed manifest.
- [x] Masters + manifest content-addressed; long `immutable` caching is safe by construction.
- [x] Internal documentation in `docs/system-architecture.md` updated via `/ak:docs update`.
- **Risk:** reading + hashing 21 objects per publish is slow/expensive. **Signal:** publish latency/cost spikes. **Response:** publish is rare (admin-triggered, once per guardian); cache digests in D1 at write time and compare, but the release gate still recomputes over the actual bytes — no sampling shortcut at the gate.
- **Risk:** content-addressed URLs change what clients embed. **Signal:** broken share cards. **Response:** clients resolve via the D1 pointer/manifest indirection, never a hardcoded key — verify the client reads manifest URLs before/with this phase.
- **Assumption that may break:** D1 offers a single-statement conditional sufficient for the pointer CAS. **Signal:** no atomic primitive expresses the one-winner flip. **Response:** use a unique-constraint insert on `guardian_publication` as the winner election; the unique violation is the loser signal.
