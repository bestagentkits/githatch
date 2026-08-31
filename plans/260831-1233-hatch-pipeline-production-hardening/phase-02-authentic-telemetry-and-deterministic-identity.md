---
phase: 2
title: "Authentic Telemetry & Deterministic Identity"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Authentic Telemetry & Deterministic Identity

## Overview

Make the production claim consume **real** GitHub telemetry and derive identity from **one true SHA-256**. Today the claim path writes measured-looking zeros for stars, forks, merged PRs, reviews, and active weeks, and the identity hasher silently substitutes FNV-64 when `require('node:crypto')` is unavailable — both violate the "zero fake data" and byte-identical-identity invariants.

## Requirements

- Functional: resolve and freeze an enriched telemetry snapshot (stars, forks, merged external PRs, review ratio, active weeks, chronotype, top languages) from the GitHub API before `compileIdentitySpec`.
- Functional: never represent an unavailable field as a measured `0`. Each field carries explicit provenance (`measured` | `unavailable`) and the compiler treats `unavailable` deterministically (documented neutral, not silently zero-weighted as if measured).
- Functional: a single deterministic SHA-256 used everywhere (Web Crypto `crypto.subtle.digest`), identical in Node and workerd. Remove the FNV fallback entirely.
- Non-functional: identity + prompt fingerprint byte-identical across runtimes for the same snapshot.

## Architecture

- Reuse the existing resolver enrichment (`src/server/services/github/resolver.ts`) that already fetches languages/stars; extend it to the full metric set with a typed `TelemetrySnapshot` carrying per-field provenance.
- `transaction.ts` awaits the enriched snapshot (or a fail-closed/`unavailable`-tagged snapshot on rate-limit) and passes it to `compileIdentitySpec`; delete the hardcoded `0` literals.
- Replace `sha256StringSync` with an async `sha256Hex` (already exists in `crypto/web-crypto.ts`) at every call site; if a sync signature is unavoidable, precompute the digest upstream and thread the value — never a non-SHA fallback.
- Degraded/seed mode stays deterministic: on GitHub 429/403, build identity from `SHA-256(username)` seed with all metrics tagged `unavailable`, not fabricated zeros.

## Related Code Files
- Modify: `src/server/services/claim/transaction.ts` (remove fabricated zeros; await real snapshot)
- Modify: `src/server/services/github/resolver.ts` (full metric enrichment + provenance)
- Modify: `src/server/services/dna/compiler.ts` (drop FNV fallback; single async SHA-256; deterministic `unavailable` handling)
- Modify: `src/server/types/index.ts` (`TelemetrySnapshot` provenance fields)
- Reference: `src/server/services/crypto/web-crypto.ts` (`sha256Hex`)

## Implementation Steps
1. Extend `TelemetrySnapshot` with `{ value, provenance }` per metric; update `IdentitySpec` derivation to read provenance.
2. Extend resolver enrichment to fetch stars/forks/PRs/reviews/active-weeks/chronotype; map to snapshot with `measured`/`unavailable`.
3. Rewrite `transaction.ts` claim to await the snapshot and pass it through; delete all `0` placeholders.
4. Replace `sha256StringSync` FNV branch: export async `sha256Hex`; migrate call sites; delete the fallback and its `require`.
5. Ensure degraded mode tags all metrics `unavailable` and still yields a stable identity.
6. Delete synthesized identity defaults (blocker #11c): a missing/invalid persisted `identity_spec` must **fail closed** (quarantine the job), never be reconstructed from ad-hoc defaults inside the worker (`generation-worker.ts:104-128`). Identity is written once at claim; downstream only reads and validates it.
7. **Update Internal Documentation (`/ak:docs update`):** refresh `docs/system-architecture.md` and `docs/code-standards.md` to document the new `TelemetrySnapshot` provenance schema, single Web Crypto SHA-256 requirement, and fail-closed identity contracts.

## TDD Gate (tests-first)
- [x] **RED:** no `compileIdentitySpec` input field is a fabricated `0` when the API returned no data (fails today).
- [x] **RED (discriminating):** assert exact SHA-256 of known vectors — `""`, `"abc"`, and a non-ASCII UTF-8 string — equals the published digests **in both Node and workerd**. This catches the FNV fallback even when both runtimes happen to agree with each other (an import/config failure is not acceptable as the RED reason; the digest value must be wrong today).
- [x] **RED:** a guardian row with missing/garbage `identity_spec` fed to the worker ⇒ job quarantines, no synthesized identity (fails today: defaults synthesized).
- [x] **GREEN:** all pass after real snapshot + single SHA-256 + fail-closed identity read.
- [x] Regression: determinism suite still byte-identical over 1000 derivations.

## Success Criteria
- [x] No fabricated telemetry literals remain in `transaction.ts` (grep clean).
- [x] `compiler.ts` has exactly one SHA-256 implementation, no FNV, no dynamic `require`.
- [x] Identity + prompt fingerprints byte-identical Node↔workerd.
- [x] Degraded mode is deterministic with `unavailable` provenance, not zeros.
- [x] Worker reads identity fail-closed: missing/invalid `identity_spec` quarantines; no synthesized defaults remain (grep clean for the default block).
- [x] Internal documentation in `docs/system-architecture.md` and `docs/code-standards.md` synchronized via `/ak:docs update`.
- **Risk:** `unavailable` handling changes existing identities. **Signal:** determinism snapshot diff for already-claimed users. **Response:** this is a pre-launch pipeline; document the identity-version bump and gate on no live users, or pin prior identities by `dnaVersion`. Confirm with user before altering any already-issued identity.
