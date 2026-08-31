# Phase 1 TDD Baseline & RED Evidence Report

**Plan:** `plans/260831-1233-hatch-pipeline-production-hardening/plan.md`  
**Phase:** Phase 1: TDD Harness + Staging Bootstrap Foundation  
**Date:** 2026-08-31  

---

## 1. Observed Workers Runtime Integration RED Baselines

### Baseline 1: Node-Specific Imports Inside workerd
**Command:**
```bash
npx vitest run --config vitest.workers.config.ts
```
**Observed Failure (Verbatim from transcript):**
```text
FAIL  tests/integration/harness.smoke.test.ts [ tests/integration/harness.smoke.test.ts ]
Error: No such module "node:process".
 ❯ node_modules/.pnpm/chalk@5.3.0/node_modules/chalk/source/vendor/supports-color/index.js:1:21
```
**Resolution:** Separated Node-side migration reading (`readD1Migrations` in `vitest.workers.config.ts`) from worker-side execution (`applyD1Migrations` via `cloudflare:test`), eliminating Node module imports from the worker isolate.

---

### Baseline 2: Unhandled WASM WebP Binary Module in Vitest
**Command:**
```bash
npx vitest run --config vitest.workers.config.ts
```
**Observed Failure (Verbatim from transcript):**
```text
FAIL  tests/integration/harness.smoke.test.ts [ tests/integration/harness.smoke.test.ts ]
Error: "ESM integration proposal for Wasm" is not supported currently. Use vite-plugin-wasm or other community plugins to handle this.
```
**Resolution:** Inlined `wasmPlugin` in `vitest.workers.config.ts` to transform `.wasm` binaries into base64 Uint8Arrays for `@jsquash/webp`.

---

### Baseline 3: D1 Binding Resolution in cloudflareTest Options
**Command:**
```bash
npx vitest run --config vitest.workers.config.ts
```
**Observed Failure (Verbatim from transcript):**
```text
FAIL  tests/integration/harness.smoke.test.ts > Workers Runtime Harness Smoke
TypeError: Failed to execute 'applyD1Migrations': parameter 1 is not of type 'D1Database'.
```
**Resolution:** Configured `wrangler: { configPath: path.resolve(__dirname, 'wrangler.worker.toml') }` so Miniflare correctly instantiates real `D1Database`, `R2Bucket`, `KVNamespace`, and `Queue` bindings.

---

## 2. Vulnerability Characterization Baseline: Transparent Preflight

### Test Case
`tests/integration/harness.smoke.test.ts` → `characterizes baseline vulnerability: verifyPublicationReady currently returns ready=true on real workerd D1/R2 storage when master bytes are 100% transparent`

### Observable Flaw
When D1 contains valid record metadata and R2 holds 100% transparent PNG/WebP assets (`createTransparentPng()`), calling the production `verifyPublicationReady(guardianId, env)` returns `ready: true`:
```json
{
  "ready": true,
  "reasons": []
}
```
**Cause:** Preflight currently checks only object presence (`head`/`get`) and truthy JSON strings on R2 without inspecting byte contents or calculating contours/hashes.

### Remediation Roadmap
- **Phase 3:** Authoritative fail-closed contour gate rejecting transparent/collage/multi-subject frames.
- **Phase 5:** Cryptographic preflight recomputing SHA-256 digests over all 21 R2 objects and re-running contour gates over retained raw bytes, flipping this check to `ready: false`.

---

## 3. Staging Provisioning Evidence
- Two consecutive runs of `verifyOrProvisionStaging` executed and confirmed idempotent:
  - `plans/reports/staging-bootstrap-manifest-run1.json`
  - `plans/reports/staging-bootstrap-manifest-run2.json`
- Remote D1 database `githoot_db_staging` migrations applied and verified (`0001_initial.sql`, `0002_hatch_pipeline_v2.sql`).
- Dedicated `ADMIN_REVIEW_SECRET` (distinct from `AUTH_SECRET`, length: 64) verified with zero fallback aliases.
- All 7 resource classes verified: D1, R2, KV, Queue, DLQ, Worker script, Pages project.
