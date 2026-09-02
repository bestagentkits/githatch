---
title: "hatch-pipeline-production-hardening"
description: "Remediate the 12 Kongming NO-GO blockers on the GitHoot Hatch Pet pipeline: authentic telemetry, fail-closed image gate, resumable idempotent queue DAG, cryptographic publication integrity, hardened reviewer auth, deploy-artifact provenance, and a falsifiable staging E2E + Kongming zero-defect signoff. TDD-first, linear phase order, real Workers bindings."
status: in_progress
priority: P1
effort: "7-9d"
tags: ["production-hardening", "kongming-no-go-remediation", "tdd", "cloudflare-queue", "d1-cas", "r2-integrity", "gemini-nano-banana-2", "webp-wasm", "fail-closed", "cf-access-jwt", "content-addressed"]
created: 2026-08-31
blockedBy: []
blocks: []
supersedes_verification_of: "260830-1535-hatch-eggs-pipeline"
---

# Hatch Pipeline Production Hardening (Kongming NO-GO Remediation)

## Overview

The Hatch Pet pipeline (`260830-1535-hatch-eggs-pipeline`) is implemented and passes 81 Vitest + 35 determinism tests, but Kongming's autonomous review returned a **formal NO-GO**: the green checks are all mock-bound and do not prove the production Queue→Gemini→R2→D1→review→publish contract. This plan fixes every release blocker and replaces self-certifying QA with **falsifiable, real-binding verification**, ending in a fresh Kongming zero-defect signoff.

**Non-goals:** new gameplay features (arena, store, guilds, seasons), redesigning the DNA taxonomy, or changing the Cyber-Arcade design system. This is a correctness/reliability/security hardening pass on the existing contract only.

**Method:** strict TDD. Each phase writes a **failing** contract test that encodes the blocker first (with the exact baseline command and expected RED reason captured), then makes it pass. Verification uses real Workers-runtime bindings via `@cloudflare/vitest-plugin` on `workerd` (real WASM, D1, R2, KV) with controlled external-boundary doubles for Gemini and forced Queue-send faults — never business-logic mocks.

**Prior Kongming reviews banked (this session):** the implementation NO-GO (12 blockers), a plan-level NO-GO (12 required edits, folded in), and a remediation-verify NO-GO that corrected two misreadings from interim advisories — the actual on-disk `AGENTS.md` invariant #4 (lines 41–47) **mandates one pose per API call composited locally** (grid generation is empirically broken) and does **not** mandate a WASM contour detector. Generation is therefore **per-pose**, and contour detection is the existing TS bounding-box + `chroma-removal`. A fresh Kongming review is the Phase 8 exit gate.

## Blocker → Phase Traceability

| # | Kongming Blocker | Evidence Anchor | Phase |
|---|---|---|---|
| 1 | Production claim fabricates telemetry (stars/forks/PRs/reviews/weeks = 0) | `src/server/services/claim/transaction.ts:59-68` | 2 |
| 12 | `sha256StringSync` silently falls back to FNV-64 labeled SHA-256 | `src/server/services/dna/compiler.ts:16-25` | 2 |
| 2 | No authoritative image gate: blank/collage/oversized pass | `src/server/services/image/slicer.ts:30-98` | 3 |
| 3 | Pose generation proceeds with `referenceImage: null` | `generation-worker.ts` reference path | 3 |
| 11a | Dead fake fallback + fixed-grid slicing (replace with per-pose contour detect) | `src/server/services/image/slicer.ts:138-214` | 3 |
| 11c | `Queue<any>`, unchecked runtime `JSON.parse`, `as any`, synthesized identity defaults | `src/server/types/index.ts:10`; `generation-worker.ts:104-128` | 2 (identity defaults) + 4 (queue envelope/schema) |
| 4 | Sequential 16-pose invoke risks 15-min wall limit; no lease | `generation-worker.ts` pose loop; `wrangler.worker.toml:29-35,63-69` | 4 |
| 7a | Enqueue failures swallowed (return success) | `transaction.ts:160-179`; `reference-manager.ts:139-151` | 4 |
| 5 | Preflight checks hash-string presence, not R2 byte digests, and no cross-field agreement | `src/server/services/claim/publication-preflight.ts:105-184` | 5 |
| 7b | Publication CAS ignores affected-row counts; `changes:0` treated as success | `hatch-admin.ts:112-153`; `generation-worker.ts:380-437` | 5 |
| 6a | Final manifest stays `VERIFYING`; mutable-manifest-before-D1 cross-store race | `generation-worker.ts:380-389` | 5 |
| 8 | Mutable master keys served `immutable` (stale-byte risk) | R2 master key scheme | 5 |
| 10 | `identityHash` trusted from request body, not derived from D1; OAuth secret reused; no constant-time compare; JWKS bypass when static configured | `auth.ts:78-105`; `reference-manager.ts:50-89`; `admin-auth.ts:151-168` | 6 |
| 9 | CI deploys source worker before build; skips `--env production` | `.github/workflows/deploy.yml:29-107`; `scripts/build.js:37-63` | 7 |
| 11b | `max_concurrency` absent; required-secret checks are soft | `wrangler.worker.toml:29-35,63-69` | 7 |
| — | Self-certifying QA; no real-binding falsifiable tests; no isolated staging | `scripts/run-autonomous-qa.ts`; mock-only `queue-generation-worker.test.ts` | 1, 7 (staging), 8 |

## Goals

| # | Goal | Target Metric | Priority |
|---|------|---------------|----------|
| 1 | Falsifiable harness on real Workers runtime + provisioned isolated staging | `@cloudflare/vitest-plugin` green; each blocker has a captured RED baseline; staging resources + quota verified before coding | P1 |
| 2 | Authentic identity from real telemetry, one true SHA-256, no synthesized defaults | Zero fabricated metrics; identity fails closed on missing persisted spec; known SHA-256 vectors match Node↔workerd | P1 |
| 3 | One fail-closed image gate with exact dimension caps | Blank/collage/multi-subject/oversized/malformed quarantine; scale-to-fit within declared caps; gate-input bytes retained | P1 |
| 4 | Per-pose resumable, schema-validated, cost-bounded queue DAG | Versioned discriminated envelope; invalid payload → DLQ; durable attempt ledger + per-job/daily spend cap; no ack-on-failure; under wall limit | P1 |
| 5 | Atomic single-pointer publication with full cryptographic agreement | Preflight recomputes digests + cross-field agreement over every authoritative object; immutable content-addressed manifest; one D1-selected pointer; no mixed visible state at any crash point | P1 |
| 6 | Hardened reviewer auth & real review provenance | Identity hash server-derived; dedicated secret; constant-time; JWKS rotation; persisted exact-bytes review evidence | P1 |
| 7 | Deploy the single-source tested artifact, gated, to production env | Recorded bundle SHA-256; deployed==tested; `--env production` on deploy AND secrets; hard secret gates by component; explicit `max_concurrency` | P1 |
| 8 | Real staging E2E (full live hatch) + Kongming zero-defect GO | Full reference+16-pose live hatch reaches `ASSET_READY` only after real human review; digests agree; formal GO | P1 |

## Phases (linear order)

| # | Phase | File | Status | Priority | Blockers | Depends |
|---|-------|------|--------|----------|----------|---------|
| 1 | TDD Harness + Staging Bootstrap Foundation | [phase-01](./phase-01-start.md) | Completed | P1 | verification infra + staging | — |
| 2 | Authentic Telemetry & Deterministic Identity | [phase-02](./phase-02-authentic-telemetry-and-deterministic-identity.md) | Completed | P1 | #1, #12, #11c-defaults | P1 |
| 3 | Fail-Closed Image Acceptance Gate | [phase-03](./phase-03-fail-closed-image-acceptance-gate.md) | Completed | P1 | #2, #3, #11a | P2 |
| 4 | Resumable Per-Pose Queue DAG, Envelope & Cost Control | [phase-04](./phase-04-resumable-queue-dag-and-cost-control.md) | Completed | P1 | #4, #7a, #11c-envelope | P3 |
| 5 | Atomic Publication Integrity & Single Pointer | [phase-05](./phase-05-cryptographic-publication-integrity-and-cas.md) | Completed | P1 | #5, #6a, #7b, #8 | P4 |
| 6 | Reviewer Auth Hardening & Provenance | [phase-06](./phase-06-reviewer-auth-hardening-and-provenance.md) | Completed | P1 | #10 | P5 |
| 7 | Deploy Provenance, Staging & CI Gates | [phase-07](./phase-07-deploy-provenance-and-ci-gates.md) | Completed | P1 | #9, #11b | P6 |
| 8 | Full Live Staging E2E & Kongming Signoff | [phase-08](./phase-08-staging-e2e-verification-and-kongming-signoff.md) | In Progress | P1 | full-lifecycle | P7 |
## Dependency Order

```
P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8
```

Boring linear order (per plan-review edit #4): P6 is **not** independent — it consumes P2's async hash and overlaps P4 (`reference-manager.ts`) and P5 (`hatch-admin.ts`), so it lands after P5. P7 needs the `ADMIN_REVIEW_SECRET` introduced in P6 plus the finished worker (P4) and publication path (P5). P8 needs everything, including provisioned staging stood up in P1 and wired in P7.

## Resolved Decisions

- **Generation granularity (P4): RESOLVED — per-pose fan-out.** Per binding `AGENTS.md` invariant #4 (lines 41–47): the model is never trusted to emit an exact grid, so generate **one pose per API call** (16 `HATCH_POSE` messages + a `HATCH_REFERENCE` + a `HATCH_COMPOSITE`) and composite the grid locally. Each single-subject frame is contour-detected (bounding-box, never fixed-slice) and centered on 256×256. The lease/retry/budget unit is the pose. This matches the existing code, the superseded `260830` plan, and Kongming's original review.
- **Master-asset + manifest key scheme (P5): RESOLVED — content-addressed masters AND a content-addressed final manifest.** Immutable bytes are written first, then a single authoritative D1 pointer selects the complete manifest. No fixed mutable manifest, no `immutable` cache on a mutable key.
- **Reviewer surface (P6/P8): RESOLVED — in-repo authenticated admin review route** `GET/POST /auth/admin/review/:jobId` behind Cloudflare Access. It serves an immutable review bundle (16 candidate frames + reference by content-addressed URL, plus their SHA-256s and a `bundleSha`), pauses the job in `VERIFYING` until an explicit approve/reject action, and on approve persists the reviewer principal, `bundleSha`, per-frame hashes, manifest hash, timestamp, and decision. P8 exercises this exact route, not a stamp.

## Success Criteria (Plan-Level Acceptance)

- [ ] Every blocker in the traceability table has a named test with a **captured baseline RED reason** (exact command + failure) and a post-fix GREEN result. An import/config failure alone is not blocker proof.
- [ ] Real `@cloudflare/vitest-plugin` suite green on `workerd`; legacy mock-only lifecycle test removed or relabeled non-E2E.
- [ ] Invalid queue/manifest/identity JSON cannot reach business logic and never synthesizes identity; invalid payloads quarantine to DLQ.
- [ ] No fabricated telemetry reaches `compileIdentitySpec`; known SHA-256 vectors match byte-for-byte in Node and workerd.
- [ ] Injected transparent / collage / multi-subject / malformed / oversized image, missing reference, altered frame, or altered master each **prevents `ASSET_READY`**.
- [ ] Concurrent duplicate delivery yields exactly one accepted pose in D1 (Cloudflare Queues is at-least-once, so duplicate deliveries are expected; deterministic `(job_id, pose_id, attempt)` claim keys + a unique `(job_id, pose_id)` accepted row in D1 as the cross-attempt backstop prevent duplicate accepted state); with a crash after Gemini-accept the durable attempt ledger + per-job/daily spend cap bound the blast radius and reconcile abandoned reservations (reference AND pose calls).
- [ ] Worst-case measured consumer duration is under a defined safety margin below the 15-minute Queue wall limit.
- [ ] Every publication crash point leaves either no public D1 pointer or one pointer to a complete immutable manifest — no mixed visible state; losers of the single-winner CAS get a truthful conflict.
- [ ] Reviewer identity hash is server-derived from D1; admin-review secret is separate from the OAuth state secret; token compare is constant-time; JWKS refreshes on unknown `kid`; approval persists reviewer principal + manifest hash + frame hashes + timestamp + exact artifact shown.
- [ ] One authoritative bundle: recorded SHA-256/version, deployed == tested, `--env production` on deploy and secret ops, hard secret gates by component (incl. `GITHUB_TOKENS`, distinguishing CI creds from runtime secrets), explicit `max_concurrency`.
- [ ] Internal project documentation in `docs/` (`system-architecture.md`, `code-standards.md`, `project-changelog.md`) continuously refreshed and synchronized along the way via `/ak:docs update`.
- [ ] Root `AGENTS.md` refreshed and reconciled via `/ak:docs agent-context` during Phase 7 to document the single-source deploy artifact, secrets pipeline, and zero-defect verification rules.
- [ ] Isolated staging (D1/R2/KV/Queue/DLQ/Worker/Pages) provisioned in P1; a **full live hatch (reference + 16 poses)** reaches `ASSET_READY` only after real human review via the named in-repo review surface, with D1/R2/manifest hashes agreeing.
- [ ] Fresh Kongming review returns a formal **GO** with zero defects. Missing integration infra, required secrets, staging quota, or reviewer evidence blocks GO.

## Supervision

Runs under `--advice` (kongming). Kongming is spawned after each phase gate for go/no-go, before high-stakes actions, and for the final Phase 8 zero-defect review. Three prior Kongming reviews are banked this session; per-pose generation (per binding `AGENTS.md` #4) and content-addressed publication are resolved. Kongming advises; the implementing agent owns every edit and gate.

## References

- Kongming implementation NO-GO: `agent://Kongming_Final_Review` — 12 blockers, cited anchors.
- Kongming plan NO-GO: `agent://Kongming_Plan_Review` — 12 required plan edits (folded into this revision).
- Superseded implementation plan: `plans/260830-1535-hatch-eggs-pipeline/`.
- Cloudflare Queue limits (15-min consumer wall, `max_concurrency` autoscale): https://developers.cloudflare.com/queues/platform/limits/ , https://developers.cloudflare.com/queues/configuration/configure-queues/
- D1 batch semantics (`changes: 0` on successful no-op; statement-level rollback): https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
- Workers Vitest integration (`@cloudflare/vitest-plugin`, `cloudflareTest()`, `readD1Migrations`/`applyD1Migrations`): https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/ , https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/

## Open Questions

- **Gemini idempotency:** does the image model expose a usable provider-side idempotency key? If yes, P4 can strengthen the external-charge invariant toward exactly-once; if no (assumed), the durable attempt ledger + spend cap + reconciliation is the ceiling.
- **Staging Gemini budget:** confirm a capped staging Gemini key funds one full live hatch (reference + 16 pose calls) for the P8 signoff; if quota is unavailable, P8 splits into a one-pose live canary + a clearly labeled fixture lifecycle smoke and GO is withheld until a full live hatch runs.

<!-- slug: hatch-pipeline-production-hardening -->
