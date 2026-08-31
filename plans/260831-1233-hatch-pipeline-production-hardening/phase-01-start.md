---
phase: 1
title: "TDD Harness + Staging Bootstrap Foundation"
status: completed
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: TDD Harness + Staging Bootstrap Foundation

## Overview

Stand up a **real Workers-runtime** test harness (current Cloudflare stack) so every later phase writes a failing contract test on `workerd` with genuine WASM, D1, R2, KV, and Queue semantics — and verify up front that isolated staging resources, Cloudflare credentials, a capped Gemini key, and reviewer credentials actually exist. Kongming's core finding: the green suite is mock-bound and cannot falsify the production contract, and staging/quota must be proven before coding, not deferred to Phase 8.

## Requirements
- Functional: `@cloudflare/vitest-plugin` on Vitest **4.1+** using `cloudflareTest()`, importing `cloudflare:workers`/`cloudflare:test`; bindings mirror `wrangler.worker.toml` (D1 `githoot_db`, R2 `githoot`, KV `GITHOOT_CACHE`, Queue `githoot-ai-queue` + DLQ) plus the WASM module rule for `@jsquash/webp`.
- Functional: D1 migrations loaded with `readD1Migrations()` in the Node-side config and applied via `applyD1Migrations(env.DB, migrations)` **inside** the Workers test (a Node `globalSetup` cannot touch the worker-scoped D1 binding).
- Functional: deterministic image fixture factory producing six byte classes with **exact declared caps** (see Dimension Contract below).
- Functional: `scripts/staging-bootstrap.mjs` — an **idempotent create-or-verify** provisioner that stands up isolated staging D1/R2/KV/Queue/DLQ + Worker/Pages names if absent and verifies them if present, applies staging D1 migrations, and confirms external prerequisites (Cloudflare API token, a capped staging Gemini key answers, reviewer credentials). It provisions rather than merely checking, so the plan can reach its own later phases on a fresh account; it exits nonzero only when a prerequisite it cannot create (credentials, quota) is missing.
- Non-functional: `npm test` runs a fast Node-unit project and the Workers-integration project; both in CI.

## Dimension Contract (single source, resolves the P1/P3/P8 caps)
- Accepted decoded frame input: width and height each **≤ 1024 px**, byte size ≤ 4 MB, PNG only.
- `1024×1024` is **within cap** and is the canonical **scale-to-fit** fixture (scales down to the 256 box, no clip).
- `oversized` negative fixture is **> 1024** on a side (e.g. `1600×1600`) or `> 4 MB` and must **reject**.
- These constants live in `dna/contracts.ts` `GATES` and are imported by fixtures, gate, and E2E so no phase can contradict another.

## Test-Boundary Honesty (declared once, used everywhere)
- Real: D1, R2, KV, WASM, and workerd ack/retry via `createMessageBatch`/`getQueueResult`.
- Controlled doubles: Gemini responses and forced Queue-send failures are explicit external-boundary fault injections — the resulting suite is **handler-semantics integration**, not a broker/provider E2E. Real broker delivery, DLQ, and deployed-bundle proof live in Phase 8 staging.

## Related Code Files
- Create: `vitest.workers.config.ts` (Node config: `readD1Migrations`, plugin), `tests/integration/setup/migrations.ts`, `tests/integration/fixtures/images.ts`, `tests/integration/harness.smoke.test.ts`, `scripts/staging-bootstrap.mjs`
- Modify: `package.json` (upgrade Vitest to 4.1+; add `@cloudflare/vitest-plugin`; `test` runs unit + workers projects), `.github/workflows/deploy.yml` (Phase 7 wires full gating)
- Modify: `src/server/services/dna/contracts.ts` (`GATES` dimension caps)

## Implementation Steps
1. Upgrade Vitest to 4.1+; add `@cloudflare/vitest-plugin`; confirm `workerd` resolves in sandbox/CI.
2. Author `vitest.workers.config.ts` with `cloudflareTest()`, bindings, WASM module rule; `readD1Migrations()` for both migration files.
3. In-test setup calls `applyD1Migrations(env.DB, migrations)` and seeds one `PENDING` guardian.
4. Build the fixture factory honoring the Dimension Contract (valid centered subject, transparent, two-subject collage, 1024×1024 scale case, 1600×1600 oversized, truncated-PNG, JPEG-magic buffer).
5. `harness.smoke.test.ts`: assert D1 query, R2 put/head/get, KV get/put, workerd Queue ack/retry, and real `@jsquash/webp` encode/decode.
6. Write `staging-bootstrap.mjs`; run it to **create-or-verify** isolated staging resources + apply staging migrations; record what was created/verified. It provisions here so P7 only deploys/configures onto finished resources; it hard-stops only on an uncreatable prerequisite (credentials/quota).

## TDD Gate (tests-first)
- [ ] **RED:** `harness.smoke.test.ts` fails (plugin/bindings absent) — capture the exact command + reason.
- [ ] **GREEN:** all five binding classes + WASM pass on `workerd`.
- [ ] Meta: current `verifyPublicationReady` returns `ready:true` on a transparent frame — captured baseline the P3/P5 fixes flip to `false`.
- [ ] Staging bootstrap creates-or-verifies isolated resources idempotently and applies staging migrations.

## Success Criteria
- [ ] `npm test` runs Node-unit + Workers-integration; both green on `workerd`.
- [ ] Migrations applied in-test via `applyD1Migrations`; six fixture classes deterministic and cap-consistent.
- [ ] `GATES` dimension caps are the single source shared by fixtures, gate, and E2E.
- [ ] Staging bootstrap provisions isolated resources in P1 (so P7 only deploys onto them); uncreatable prerequisites are surfaced now, not in P8.

## Risk Assessment
- **Risk:** `@cloudflare/vitest-plugin` / `workerd` cannot run in the sandbox or CI image. **Signal:** plugin/binding init errors. **Response:** fall back to a Wrangler `--local` integration harness driven from Node `--test`; if even that is blocked, escalate to the user with the exact missing capability and gate Phase 8 on a manual `wrangler dev` staging smoke — never silently revert to business-logic mocks.
- **Risk:** Vitest 3→4 upgrade breaks existing unit specs. **Signal:** unrelated unit failures after upgrade. **Response:** fix on the migration guide; keep the determinism `node --test` suite independent of Vitest.
- **Assumption that may break:** Cloudflare credentials + capped Gemini quota are grantable (resources themselves are auto-created by the bootstrap). **Signal:** `staging-bootstrap.mjs` cannot authenticate or the Gemini key is quota-zero. **Response:** stop and request credentials/quota from the user before Phase 2; resource creation itself is automated and not a blocker.
