---
phase: 7
title: "Deploy Provenance, Staging & CI Gates"
status: completed
priority: P1
effort: "1d"
dependencies: [6]
---

# Phase 7: Deploy Provenance, Staging & CI Gates

## Overview

Guarantee the deployed Worker is the **tested** artifact from a **single source**, that deployment is hard-gated and environment-complete, and that **isolated staging** exists for the Phase 8 live smoke. Today CI deploys the consumer from source (Wrangler's own bundling) **before** `npm run build` runs esbuild, so the cited `dist-worker/index.js` never ships; the Worker deploy omits `--env production`; required-secret checks are soft conditionals; `max_concurrency` is unset; and no separate staging resources exist (configs point at named production resources).

## Requirements
- **Single-source artifact (plan-review edit #10):** remove the "deploy esbuild artifact OR let Wrangler build" fork. Choose **one** authoritative bundle, build it, record its **SHA-256 + version metadata**, deploy exactly that output, and verify the deployed version corresponds to it. No two unverified bundling paths.
- **Environment-complete:** `--env production` on the consumer **deploy AND every secret operation** (`wrangler secret put ... --env production`). The `[env.production]` block exists in `wrangler.worker.toml` and its bindings are asserted at parity with default.
- **Hard secret gates by component:** a preflight step that exits nonzero listing any missing secret, split by component and by role — CI **deploy credentials** (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) vs **Worker/Pages runtime secrets** (`GEMINI_API_KEY`, `AUTH_SECRET`, `ADMIN_REVIEW_SECRET`, `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_NAME`, `GITHUB_TOKENS`, GitHub OAuth id/secret, R2 keys). No soft `[ -n ... ] &&` skips.
- **Staging deploy/config (plan-review edit #11):** the isolated staging D1/R2/KV/Queue/DLQ + Worker/Pages resources are **provisioned in P1** by `staging-bootstrap.mjs`; P7 only wires the `[env.staging]` block, deploys/configures onto those finished resources, sets staging secrets, and runs the P1 bootstrap in create-or-verify mode in CI before the P8 smoke.
- CI runs Node-unit + Workers-integration + determinism suites; all pass before any deploy.

## Architecture
- Reorder `.github/workflows/deploy.yml`: checkout → node → `npm ci` → typecheck → **build (record `dist-worker/index.js` SHA-256/version)** → unit+integration+determinism tests → secret-preflight gate (by component/role) → D1 migrate → **set runtime secrets (`--env production`) FIRST** → deploy the recorded bundle `wrangler deploy dist-worker/index.js --no-bundle --config wrangler.worker.toml --env production` → deploy Pages → post-deploy provenance assertion (deployed == recorded). Secrets always precede the code that needs them.
- `wrangler.worker.toml`: `[env.production]` and `[env.staging]` consumer configs with explicit `max_concurrency`, `max_batch_size`, `max_retries`, `dead_letter_queue`, Cron trigger; single-source `main`/build so the tested entry and deployed entry are identical.
- A `scripts/bundle-provenance.mjs` computes/records the bundle SHA-256 and asserts the deployed Worker version matches.

## Related Code Files
- Modify: `.github/workflows/deploy.yml` (reorder; component/role secret gate; `--env production` on deploy+secrets; run all test projects; provenance assertion)
- Modify: `wrangler.worker.toml` (`[env.production]` + `[env.staging]`, explicit `max_concurrency`, DLQ, Cron)
- Modify: `scripts/build.js` (single authoritative bundle output)
- Modify: `AGENTS.md` (reconciled via `/ak:docs agent-context` to reflect the single-bundle deploy, secrets pipeline, and zero-defect QA rules)
- Create: `scripts/bundle-provenance.mjs`, staging migration/secret bootstrap notes
- Reference: P4 worker shape; P5 publication; P1 `staging-bootstrap.mjs`

## Implementation Steps
1. **Committed mechanism:** deploy the esbuild output with Wrangler bundling disabled — `wrangler deploy dist-worker/index.js --no-bundle --config wrangler.worker.toml --env production` — so the tested bytes are the deployed bytes. `scripts/bundle-provenance.mjs` records the `dist-worker/index.js` SHA-256 pre-deploy and asserts the deployed Worker version/`etag` corresponds. No Wrangler re-bundle, no alternative path.
2. `[env.production]` + `[env.staging]` in `wrangler.worker.toml` with explicit `max_concurrency=2`, `max_batch_size=1`, `max_retries`, DLQ, Cron; assert default/env binding parity.
3. Deploy job order: build (record SHA-256) → tests → secret gate → migrate → **set runtime secrets (`--env production`) BEFORE deploying code that needs them** → `wrangler deploy ... --no-bundle --env production` → Pages → post-deploy provenance assertion (deployed == recorded).
4. Component/role secret-preflight script; hard-fail listing any missing secret; separate CI creds from runtime secrets.
5. Run `staging-bootstrap.mjs` (create-or-verify, from P1) in CI ahead of P8; wire `[env.staging]` deploy/config onto the finished resources — P7 does not provision from scratch.
6. **Update Agent Context (`/ak:docs agent-context`):** run `/ak:docs agent-context` to refresh the root `AGENTS.md` file with the new production CI/CD workflows, runtime secrets hierarchy (`ADMIN_REVIEW_SECRET`, `CF_ACCESS_*`), dual test suites (`@cloudflare/vitest-plugin`), and exact invariant enforcement.

## TDD Gate (tests-first)
- [x] **RED:** a CI provenance/lint check (`actionlint` + `bundle-provenance.mjs`) fails on the current deploy-before-build ordering and missing `--env production` (fails today).
- [x] **RED:** secret-preflight exits nonzero when any component/role secret (incl. `GITHUB_TOKENS`, `ADMIN_REVIEW_SECRET`) is unset (fails today: soft-skips).
- [x] **RED:** config assertion parses `wrangler.worker.toml` and fails when `max_concurrency` is absent or `[env.production]`/`[env.staging]` binding parity is violated (fails today).
- [x] **GREEN:** workflow lints clean; build precedes deploy; deployed bundle SHA-256 == recorded; secrets/staging gates enforced.

## Success Criteria
- [x] One authoritative bundle with recorded SHA-256/version; post-deploy assertion proves deployed == tested.
- [x] `--env production` on deploy AND secret ops; `[env.production]` parity asserted.
- [x] Component/role secret gate hard-fails before migrate/deploy (CI creds vs runtime secrets; incl. `GITHUB_TOKENS`).
- [x] Explicit `max_concurrency` (1–2), `max_batch_size=1`, DLQ + Cron bound.
- [x] Isolated staging provisioned and preflighted in CI; CI runs unit+integration+determinism before deploy.
- [x] Root `AGENTS.md` updated and reconciled via `/ak:docs agent-context` to document the single-source deploy artifact, secrets pipeline, and zero-defect verification rules.
- **Risk:** `@cloudflare/vitest-plugin` cannot run in the CI image ⇒ integration gate blocks deploys. **Signal:** CI integration job fails on runner setup. **Response:** per P1 fallback, run integration via Wrangler `--local`; if impossible in CI, gate on the P8 manual staging smoke and keep the CI job required once the runner supports it — never drop the gate silently.
- **Risk:** `--env production`/`[env.staging]` config drift. **Signal:** post-deploy binding mismatch. **Response:** single-source bindings; the parity assertion test blocks drift.
- **Assumption that may break:** staging credentials/quota are grantable (resources auto-created by P1 bootstrap). **Signal:** `staging-bootstrap.mjs` cannot authenticate. **Response:** hard block; request credentials/quota (surfaced already in P1) before P8.
