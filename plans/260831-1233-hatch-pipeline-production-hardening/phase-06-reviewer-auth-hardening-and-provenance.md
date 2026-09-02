---
phase: 6
title: "Reviewer Auth Hardening & Provenance"
status: completed
priority: P1
effort: "1d"
dependencies: [5]
---

# Phase 6: Reviewer Auth Hardening & Provenance

## Overview

Close the reviewer-authorization and identity-provenance gaps. The RS256/aud/iss/exp/nbf checks are sound, but the approval path trusts a caller-supplied `currentIdentityHash`, reuses the OAuth state-signing secret as the admin bearer secret, compares the fallback token non-constant-time, and bypasses dynamic JWKS entirely whenever `CF_ACCESS_JWKS` is statically configured (so key rotation cannot recover an unknown `kid`).

## Requirements
- Functional: derive `currentIdentityHash` **server-side from D1** (the guardian's stored identity spec) inside the approval path; never accept it from the request body.
- Functional: use a dedicated `ADMIN_REVIEW_SECRET` for the bearer fallback, distinct from `AUTH_SECRET` (OAuth state signing).
- Functional: constant-time comparison for the bearer token.
- Functional: on an unknown `kid`, refresh JWKS once (dynamic fetch) before rejecting — even when a static `CF_ACCESS_JWKS` is present (static becomes a seed/cache, not a hard override that disables rotation).
- Functional: implement the **named in-repo review surface** `GET/POST /auth/admin/review/:jobId` behind Cloudflare Access. `GET` returns the immutable review bundle (16 candidate frames + reference by content-addressed URL, each SHA-256, plus a computed `bundleSha`) while the job is paused in `VERIFYING`. `POST` records an explicit approve/reject; on approve it populates the P5 verdict contract (16 verdicts bound to `frame_sha256`) and persists reviewer principal, `bundleSha`, per-frame + manifest hashes, timestamp, and decision. No automated 16-pass stamp path exists.

## Architecture
- `reference-manager.ts` / `hatch-admin.ts`: fetch the guardian's `identity_spec` from D1, recompute its `identityHash` (Phase 2 single SHA-256), and use that as `currentIdentityHash` in `verifyCandidateProvenance`. Drop the body-supplied field from the route contract.
- `admin-auth.ts`: add `ADMIN_REVIEW_SECRET` to `Env`; bearer path compares against it with a constant-time equality (`crypto.subtle` HMAC compare or timing-safe byte compare). Keep length ≥ 16 gate.
- JWKS: treat `CF_ACCESS_JWKS` as an initial cache; on `kid` miss, call `fetchTeamJwks` once and retry before 401. Preserve existing aud/iss/exp/nbf checks.
- Provenance evidence: when an approval is recorded, persist the exact `boundToSha256` set (already in `verdict_data`) plus a `reviewed_artifact_manifest_sha` so the record proves what was shown.

## Related Code Files
- Create: `src/server/routes/review.ts` (the `GET/POST /auth/admin/review/:jobId` surface + immutable bundle assembly)
- Modify: `src/server/routes/auth.ts` (drop body `currentIdentityHash`; derive server-side; mount review route under Access)
- Modify: `src/server/services/ai/reference-manager.ts` (server-derived identity hash)
- Modify: `src/server/services/ai/hatch-admin.ts` (persist reviewed-artifact provenance)
- Modify: `src/server/services/auth/admin-auth.ts` (dedicated secret, constant-time compare, JWKS refresh on unknown kid)
- Modify: `src/server/types/index.ts` (`ADMIN_REVIEW_SECRET`)

## Implementation Steps
1. Add `ADMIN_REVIEW_SECRET` to `Env` and to the bearer comparison; make the compare constant-time; keep JWT path primary.
2. In both approval endpoints, load `identity_spec` from D1 and recompute `identityHash`; remove the request-body field.
3. Change JWKS logic: static config seeds the cache; unknown `kid` triggers one dynamic refresh + retry before reject.
4. Persist reviewed-artifact provenance (manifest sha + bound frame shas) in the verdict record.

## TDD Gate (tests-first)
- [x] **RED:** approval request supplying a forged `currentIdentityHash` in the body ⇒ ignored; server-derived hash used; provenance check still binds (fails today: body value trusted).
- [x] **RED:** bearer path with `AUTH_SECRET` (OAuth secret) ⇒ rejected; only `ADMIN_REVIEW_SECRET` accepted (fails today: reused secret).
- [x] **RED:** valid JWT with a `kid` absent from static JWKS ⇒ dynamic refresh recovers and accepts (fails today: hard reject).
- [x] **RED:** timing test / structural assertion that token compare is constant-time (no early-return branch on first mismatch byte).
- [x] **RED:** `GET /auth/admin/review/:jobId` returns the immutable bundle with a `bundleSha` while the job is `VERIFYING`; `POST` approve populates 16 hash-bound verdicts and persists reviewer principal + bundleSha + hashes + timestamp; there is no code path that stamps verdicts without a `POST` decision (fails today: no review surface).
- [x] **GREEN:** all pass; **regression:** existing 8 admin-auth tests still green.

## Success Criteria
- [x] Identity hash is server-derived from D1 in both approval paths; body field removed.
- [x] Admin bearer uses a dedicated secret; OAuth secret no longer grants admin.
- [x] Token comparison is constant-time.
- [x] Unknown `kid` triggers one JWKS refresh before rejection.
- [x] Approval records persist exactly-what-was-shown provenance.
- **Risk:** dynamic JWKS refresh on every unknown kid enables a fetch-amplification DoS. **Signal:** refresh call rate spikes. **Response:** rate-limit/coalesce refreshes (single-flight + short negative cache) so a bad-kid flood triggers at most one fetch per window.
