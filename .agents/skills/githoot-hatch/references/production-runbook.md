# Production Runbook

## Never render inline

A 16-pose set took ~6 minutes of sequential model calls in a measured batch. A
hatch HTTP request must only: verify authorization, reserve budget, enqueue, and
return a pending state. Measure real latency/cost operationally — do not hardcode
that figure as an SLA.

## Queue DAG

```
claim (authorized)
  └─ reserve budget ──> create job (PENDING)
        └─ compile identity + prompts (deterministic, no spend)
              └─ ensure pinned reference (render once if absent)
                    └─ N pose jobs (bounded concurrency, ≤3 attempts each)  [GENERATING]
                          └─ compose sheet + strip, emit PNG+WebP           [VERIFYING]
                                └─ browser verify + semantic identity verdict
                                      ├─ all pass ─> publish (ASSET_READY)
                                      └─ any doubt ─> QUARANTINED
```

`JOB_STATES` in `contracts.mjs`. Only the publisher may write `ASSET_READY`.

## Authorization and cost gate

Before any pose job: verified OAuth claim plus quota/payment, and an **atomic**
budget reservation. Anonymous or unauthenticated views must cost 0 AI calls —
they get the deterministic egg. Cap total attempts at
`poseCount × GATES.maxAttemptsPerPose`. Idempotent retries must not re-bill
already-accepted frames.

## Idempotency

Key work by `requestFingerprint()`. Duplicate queue delivery must produce zero
duplicate accepted work. A fingerprint hit permits reuse of stored bytes **only
after re-validating them with the current policy** — versions may have moved.

Cached frames go through the same `validateFrame()` as fresh ones. No exceptions.

## Publication manifest

Publication requires a complete, content-addressed manifest:

- all versions (`dna`, `telemetrySnapshot`, `identitySpec`, `promptCompiler`,
  `poseSet`, `processingPolicy`) and `identityHash`, `telemetrySnapshotHash`
- exact model id + direct-provider provenance
- `reference_sha256`
- every `promptHash`
- per-frame gate `metrics`
- PNG and WebP hashes + dimensions
- browser report and screenshot paths
- per-frame semantic identity verdict

Missing any element → not publishable. A deterministic silhouette may be shown as
a clearly labeled *pending* placeholder, never silently published as the finished
Guardian.

## Credentials

Resolution order: `process.env.GEMINI_API_KEY` → untracked dotenv at
`GITHOOT_ENV_PATH`. Production runtime uses the platform secret store
(`wrangler pages secret put GEMINI_API_KEY --project-name=githoot`); CI shell
`env:` only sets the runner, not the edge runtime.

Never print, log, commit, or embed the value. Report the source name only.
Redact credentials from provider error text before logging.

## Failure handling

| Exit | Meaning | Action |
|---|---|---|
| 2 | no credential | fix env/secret; never hardcode |
| 3 | generation failed on the configured model | check `ListModels`, quota, network; do not switch model as a workaround |
| 4 | model not allowlisted | correct config; never widen the allowlist to unblock |
| 5 | pinned reference missing | restore from durable storage; do not re-invent identity |
| 6 | gate failed after max attempts | inspect frame metrics; treat as art defect, not a gate bug, until proven otherwise |
| 7 | browser verification failed | read the report/screenshots; fix wiring or artifacts |

Identity drift or ambiguous semantic verdict → `QUARANTINED` + human review.
Never publish to clear a queue.

## Known follow-ups in this repo

- `src/server/services/ai/prompt-compiler.ts` and
  `src/server/queue/generation-worker.ts` still request a model-generated 4x2
  grid, and `src/server/services/image/slicer.ts` still fixed-slices cells. That
  conflicts with the per-pose invariant here. Migrating it is an accepted-scope
  decision, not a silent edit — until then, two conventions coexist and this
  skill's convention is the verified one.
- The reference generator/verifier pair (`scripts/gen-landing16.mjs`,
  `scripts/verify-landing16.mjs`) should converge on `scripts/lib/` here so
  production and skill behaviour cannot drift apart.
