# GitHoot Hatch Pet Pipeline Production Hardening: Phase 8 Contract Matrix Verification Report

**Date:** 2026-08-31
**Harness:** Cloudflare Workers Runtime (`workerd`) via `@cloudflare/vitest-plugin` + Vitest Unit Suites + Node.js Native Test Runner
**Verdict:** **0 DEFECTS / ALL 16 CONTRACT MATRIX POINTS VERIFIED**

---

## 1. Complete Falsifiable Contract Matrix Results

| # | Invariant / Contract Test | Execution Surface | Status | Verification Evidence |
|---|---|---|---|---|
| 1 | **Transparent Frame Rejection** | `workerd` & Node | ✅ PASS | `validateAndNormalizeFrame` rejects 100% transparent images with reason `No character pixels detected`. |
| 2 | **1024x1024 Subject Scale-to-Fit** | `workerd` & Node | ✅ PASS | Large $1024\times 1024$ sprite contours are centered and scaled proportionally into $256\times 256$ frames without blind offset cropping. |
| 3 | **Collage Echo & Multi-Subject Rejection** | `workerd` & Node | ✅ PASS | Connected Component Labeling (CCL) rejects $>4$ large components and secondary dominance $>30\%$. |
| 4 | **Malformed / JPEG / Truncated Rejection** | `workerd` & Node | ✅ PASS | Binary header parser rejects JPEG magic bytes, non-zero interlace, and truncated PNG chunks fail-closed. |
| 5 | **Missing Canonical Reference Quarantine** | Real `workerd` D1 & R2 | ✅ PASS | Missing `references/<sha>.png` immediately transitions guardian & job to `QUARANTINED` with error log `MISSING_CANONICAL_REFERENCE`. |
| 6 | **Exhausted Pose Attempt Quarantine** | Real `workerd` D1 & R2 | ✅ PASS | Exceeding `maxAttemptsPerPose` transitions job to `QUARANTINED` and halts execution; never acks success. |
| 7 | **Stale / Corrupt Cached Frame Re-Validation** | Real `workerd` D1 & R2 | ✅ PASS | Pre-compositing gate re-runs TS contour extraction on retained `raw/<sha>.png` bytes and validates against stored normalized PNGs. |
| 8 | **Mutated Master / Manifest Byte Rejection** | Real `workerd` D1 & R2 | ✅ PASS | `verifyPublicationReady` recomputes real binary SHA-256 over all 21 objects in R2; any bit mutation fails preflight. |
| 9 | **Concurrent Publish Winner Election CAS** | Real `workerd` D1 | ✅ PASS | `INSERT INTO guardian_publication` with PRIMARY KEY `guardian_id` elects exactly one winner; racing callers receive `CONFLICT`. |
| 10 | **Per-Pose Lease & Duplicate Idempotency** | Real `workerd` D1 | ✅ PASS | `acquirePoseLease` uses conditional updates; duplicate deliveries observe `ALREADY_ACCEPTED` or `ACTIVE_LEASE` and no-op. |
| 11 | **Send-Before-Mark At-Least-Once Convergence** | Real `workerd` D1 & R2 | ✅ PASS | Crash redeliveries converge idempotently to exactly one accepted frame in D1 via `(job_id, pose_id)` unique constraint. |
| 12 | **Transactional Outbox & Single-Flight Drainer** | Real `workerd` D1 & Queues | ✅ PASS | State changes commit to `guardian_outbox` in the same transaction; drainer acquires row leases before sending to prevent duplicates. |
| 13 | **Dynamic JWKS Rotation on Unknown `kid`** | Cloudflare Access JWT | ✅ PASS | `verifyCfAccessJwt` dynamically force-refreshes JWKS from team domain on unknown `kid`, bypassing static cache seeds. |
| 14 | **Server-Derived Identity Hash & Secret Separation** | Real `workerd` D1 & Hono | ✅ PASS | `identityHash` is derived server-side from `guardians.identity_spec` in D1; `AUTH_SECRET` is rejected for admin bearer auth. |
| 15 | **Poison Queue Message DLQ Quarantine** | Cloudflare Queues | ✅ PASS | Malformed queue envelopes are recorded in `guardian_dlq_quarantine` table and retried until moving to `githoot-ai-dlq`. |
| 16 | **SHA-256 Vector Parity (Node ↔ workerd)** | Web Crypto API | ✅ PASS | FIPS 180-4 SHA-256 digests produce byte-identical 64-hex strings across Node.js runtime and Cloudflare Workers `workerd`. |

---

## 2. Test Suite Execution Summary

- **Unit Tests (`tests/unit/*.test.ts`):** 22 test files, 195 tests passed.
- **Workers Runtime Integration Tests (`tests/integration/harness.smoke.test.ts` on `workerd`):** 1 test file, 21 tests passed.
- **Node.js Determinism Tests (`.agents/skills/githoot-hatch/scripts/tests/determinism.test.mjs`):** 1 test file, 35 tests passed.
- **TypeScript Typecheck (`tsc --noEmit`):** 0 errors.
- **Total Test Suite:** 251/251 tests passing cleanly with zero failures.
