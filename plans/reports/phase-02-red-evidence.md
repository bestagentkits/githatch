# Phase 2: Authentic Telemetry & Deterministic Identity RED/GREEN Evidence Report

## 1. Executive Summary
- **Phase:** 2 — Authentic Telemetry & Deterministic Identity
- **Status:** GREEN (All acceptance gates, cryptographic invariants, and workerd parity tests passing)
- **Quality Gate:** 140 Unit Tests (including 8 resolver-telemetry tests and 17 deterministic-identity tests) + 12 workerd Integration Tests (including workerd D1 atomic quarantine and golden parity) + 35 Determinism Tests = 187 Tests Passing (100% Green, 0 Type Errors).

---

## 2. Characterized RED Vulnerabilities, Executed Mutation Proofs & Verified Remediations

### Blocker #11a: Fabricated `0`s in Telemetry Snapshot
- **Vulnerability:** `fetchTelemetrySnapshot` wrote measured-looking zeros for unmeasured fields (`mergedExternalPRs = 0`, `reviewRatio = 0`, `activeWeeks = 0`, `nightCommitRatio = 0`) with optional/partial provenance.
- **Executed Mutation Test:** In `src/server/services/github/resolver.ts`, bypassed Search API collection for `mergedExternalPRs`.
- **Command:** `npx vitest run tests/unit/resolver-telemetry.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/resolver-telemetry.test.ts > Phase 2: GitHub Telemetry Enrichment & Provenance Contracts > measures repos, languages, stars, and forks with complete measured provenance
  AssertionError: expected +0 to be 12 // Object.is equality

  - Expected
  + Received

  - 12
  + 0 

   ❯ tests/unit/resolver-telemetry.test.ts:60:40
       58|     expect(snapshot.forks).toBe(23);
       59|     expect(snapshot.topLanguages).toEqual(['typescript', 'rust']);
       60|     expect(snapshot.mergedExternalPRs).toBe(12);
         |                                        ^
  ```
- **Remediation & Verified Output:** Mandatory typed `provenance: Record<key, 'measured' | 'unavailable'>` across all 12 metrics; Search API queries for merged external PRs (`author:${login} type:pr is:merged -user:${login}`) and reviews (`reviewed-by:${login} type:pr`); `neutralIfUnavailable` assigned 0.25 neutral merit baseline for unmeasured fields. Verified 8/8 tests passing in `tests/unit/resolver-telemetry.test.ts`.

---

### Blocker #11b: Partial 100-Repo Page / 300-Event Truncation Marked Measured
- **Vulnerability:** First-page results (100 repos or 300 events) were marked `measured` even when the account had >100 repos or events were truncated at the 300-item window.
- **Executed Mutation Test:** In `src/server/services/github/resolver.ts`, disabled event truncation check on page 3.
- **Command:** `npx vitest run tests/unit/resolver-telemetry.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/resolver-telemetry.test.ts > Phase 2: GitHub Telemetry Enrichment & Provenance Contracts > fails closed to unavailable when public events are truncated across 3 full pages (300 events)
  AssertionError: expected 'measured' to be 'unavailable' // Object.is equality

  Expected: "unavailable"
  Received: "measured"

   ❯ tests/unit/resolver-telemetry.test.ts:187:45
      185|     const snapshot = await fetchTelemetrySnapshot(mockRawUser, mockEnv…
      186|
      187|     expect(snapshot.provenance.activeWeeks).toBe('unavailable');
         |                                             ^
  ```
- **Remediation & Verified Output:** Full repository pagination up to `public_repos` (up to 1000 repos max). If `public_repos > 1000` or pagination is interrupted/rate-limited, `stars`, `forks`, and `topLanguages` fail closed to `unavailable` rather than publishing incomplete numbers as measured. Event pagination up to 300 events fails closed to `unavailable` if truncated. Verified 8/8 tests passing in `tests/unit/resolver-telemetry.test.ts`.

---

### Blocker #11c: Ad-Hoc Synthesized Identity Defaults in Background Worker
- **Vulnerability:** `generation-worker.ts` synthesized fallback IdentitySpec objects from ad-hoc defaults when `guardian.identity_spec` was missing or malformed.
- **Executed Mutation Test:** In `src/server/queue/generation-worker.ts`, bypassed `validateIdentitySpec` and synthesized fallback spec.
- **Command:** `npx vitest run tests/unit/deterministic-identity.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/deterministic-identity.test.ts > Phase 2: Fail-Closed Worker Identity Validation (Blocker #11c) > quarantines job when guardian row has missing or malformed identity_spec (zero synthesized defaults)
  AssertionError: expected [] to include 'QUARANTINED'
   ❯ tests/unit/deterministic-identity.test.ts:555:27
      553|
      554|     // Assert that job was quarantined and NO synthesized default iden…
      555|     expect(updatedStatus).toContain('QUARANTINED');
         |                           ^
  ```
- **Remediation & Verified Output:** Replaced fallback with `validateIdentitySpec` runtime verification (versions, enums, canonical anatomy/speciesName, recomputed dnaSeed, githubUserId context matching, unique pinnedFields, canonical identityHash). Missing/malformed identities execute atomic `env.DB.batch` to quarantine guardian and job with zero Gemini calls and zero R2 writes. Valid degraded claims with `github_user_id = 0` resolve `login` from `github_accounts` and pass validation cleanly. Verified 17/17 tests passing in `tests/unit/deterministic-identity.test.ts`, 12/12 in `tests/integration/harness.smoke.test.ts`.

---

### Blocker #11d: Handwritten Sync SHA / Non-Compliant Digest Output
- **Vulnerability:** Reliance on handwritten sync SHA or platform-specific `node:crypto` divergence on multi-byte non-ASCII UTF-8 strings.
- **Executed Mutation Test:** In `src/server/services/crypto/web-crypto.ts`, returned non-compliant sliced 32-char digest.
- **Command:** `npx vitest run tests/unit/deterministic-identity.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/deterministic-identity.test.ts > Phase 2: Deterministic SHA-256 Cryptographic Invariants > computes exact published SHA-256 hash of multi-byte non-ASCII UTF-8 string
  AssertionError: expected '4e8468e3a1f0f4edda9fd5089e11ab79' to be '4e8468e3a1f0f4edda9fd5089e11ab7915e5d…' // Object.is equality

  Expected: "4e8468e3a1f0f4edda9fd5089e11ab7915e5d43f82b00ac5c301703fed9ababb"
  Received: "4e8468e3a1f0f4edda9fd5089e11ab79"

   ❯ tests/unit/deterministic-identity.test.ts:37:36
       35|     const input = 'GitHoot 🦉 ấp trứng & sinh linh thần thoại 2026';
       36|     const expected = '4e8468e3a1f0f4edda9fd5089e11ab7915e5d43f82b00ac5…
       37|     expect(await sha256Hex(input)).toBe(expected);
         |                                    ^
  ```
- **Remediation & Verified Output:** Pure single-source async Web Crypto `crypto.subtle.digest('SHA-256', ...)` used exclusively across Node and workerd. All callers migrated to `await sha256Hex(...)`. Tested exact NIST FIPS 180-4 test vectors (`""`, `"abc"`, and UTF-8 string) in both Node and workerd. Verified 17/17 tests passing in `deterministic-identity.test.ts`, 12/12 in `harness.smoke.test.ts`.

---

### Blocker #11e: Node ↔ workerd Full Golden Parity
- **Vulnerability:** Discrepancies in canonical JSON formatting, locus order, or prompt template assembly across runtimes.
- **Command:** `vitest run --config vitest.workers.config.ts`
- **Verified Golden Values (Identical in Node and workerd):**
  - `dnaSeed`: `ed9c4578553149045f9b8c1d46d3e801a59324a0657c7c87bd70391ab06c76cb`
  - `telemetrySnapshotHash`: `8bcaad92f6581d5bbb75a4acafb835615288cc280ddeb6b812b7351f240bce4f`
  - `identityHash`: `244a6529d022e63b94a6fec175c6d198d8312854fda560e5d83f283def293983`
  - `refPromptHash`: `5172e615740545bbff7035214c48ace85286024b6c1530f1dacf8c8fd6cd7d76`
  - `posePromptHash`: `6083d37bd222cee8da2dab1c8bcdc9fba5a83e0362381019f177f4cf0a2f2c04`
  - `requestFingerprint`: `f790a42382815ea76b978db31aebcad07ef2e652b93abee2ba5fdfde755d86c5`
- **Verified Output:** Passing in both `tests/unit/deterministic-identity.test.ts` (17/17) and `tests/integration/harness.smoke.test.ts` (12/12).
