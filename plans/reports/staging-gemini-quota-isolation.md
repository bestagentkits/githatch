# Staging Gemini Project Quota & Spending Isolation Evidence

**Plan:** `plans/260831-1233-hatch-pipeline-production-hardening/plan.md`  
**Phase:** Phase 1: TDD Harness + Staging Bootstrap Foundation  
**Environment:** Staging (`githoot-staging`)  
**Date:** 2026-08-31  

---

## 1. Project-Level Scope & Budget Control Architecture
Per Google Cloud Architecture, rate limits, spending thresholds, and quotas are enforced **per Google Cloud Project**, not per individual API key.

- **Staging Project Scope:** Dedicated isolated Google Cloud Project for GitHoot Staging.
- **Billing Budget & Notification Rules:** Cloud Billing threshold rules set at 50% ($10.00), 80% ($16.00), and 100% ($20.00) monthly targets with automated alert notifications.
- **Fail-Closed Runtime Budget Guard:** GitHoot's production and staging runtime enforces a deterministic daily spend cap ($20/day) via `src/server/services/billing/budget-guard.ts` before every Gemini call.
- **Service Account / API Key:** Key restricted strictly to Google Generative Language API.

---

## 2. Model Allowlist Single Source of Truth & Endpoint Configuration
- **Allowlist Source:** `src/server/services/dna/model-allowlist.json` consumed by both server contracts and staging bootstrap.
- **Allowed Models:** `nano-banana-pro-preview`, `gemini-3-pro-image`, `gemini-3-pro-image-preview`.
- **Configured Staging Tier:** `nano-banana-pro-preview`.
- **Canary Protocol:** `scripts/staging-bootstrap.mjs` probes `GET /v1beta/models`, verifies `configuredModel` presence in the returned list, and executes a live `POST /v1beta/models/{model}:generateContent` call requiring a 2xx response, canonical base64 decoding, and verified `image/*` binary bytes.

---

## 3. Staging Resource Hierarchy Summary
| Resource | Staging Name / ID | Configuration Source | Isolation Level |
|---|---|---|---|
| D1 Database | `githoot_db_staging` (`d9ccb357-a59c-44e7-a50a-236e51991d65`) | `wrangler.staging.toml` | Isolated Remote D1 Database |
| R2 Bucket | `githoot-staging` | `wrangler.staging.toml` | Isolated Remote R2 Bucket |
| KV Namespace | `GITHOOT_CACHE_STAGING` (`efa9aa71d9104284976966dcbdfb111b`) | `wrangler.staging.toml` | Isolated Remote KV Namespace |
| Queue | `githoot-ai-queue-staging` | `wrangler.staging.toml` | Isolated Remote Cloudflare Queue |
| DLQ | `githoot-ai-dlq-staging` | `wrangler.worker.toml:[env.staging]` | Isolated Remote Dead-Letter Queue |
| Worker Consumer | `githoot-generation-consumer-staging` | `wrangler.worker.toml:[env.staging]` | Dedicated Queue Consumer Worker |
| Pages Frontend | `githoot-staging` | `wrangler.staging.toml` | Dedicated Cloudflare Pages Project |
