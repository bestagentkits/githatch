# GitHoot Engineering & Code Standards

## 1. Cryptographic & Hashing Invariants

- **Single True SHA-256:** All hashing must use pure FIPS 180-4 SHA-256 (`crypto.subtle.digest` via `sha256Hex` / `sha256Digest` in `src/server/services/crypto/web-crypto.ts`).

## 2. Telemetry & Provenance Standards

- **Zero Fake Data:** Never represent an unmeasured field as a measured `0`.
- **Mandatory Typed Provenance:** Every metric in `TelemetrySnapshot` must have an explicit `provenance: Record<key, 'measured' | 'unavailable'>`.
- **Neutral Unavailable Baseline:** When metrics are `unavailable` (e.g. rate-limited or degraded mode), merit evaluation must assign the documented neutral baseline ($0.25$) rather than penalizing the user with a measured zero.

## 3. Worker Fail-Closed Identity Contracts

- **Identity Written Once at Claim:** Identity (`IdentitySpec`) is immutably derived and persisted to D1 at claim time.
- **Fail-Closed Consumption:** Downstream Queue Workers must strictly validate the persisted `identity_spec`. If missing, malformed, or invalid, the job must be quarantined immediately (`status: 'QUARANTINED'`). Workers must never synthesize default or ad-hoc identities.

## 4. Image Processing & Acceptance Gate Standards

- **One Authoritative Gate:** All generated and cached frames must pass `validateAndNormalizeFrame` in `src/server/services/image/frame-gate.ts`.
- **Dimension & Format Bounds:** Only valid 8-bit non-interlaced PNGs with $\le 1024 \times 1024$ pixels and $\le 4\text{MB}$ size are accepted.
- **Chroma De-Spill Invariant:** Green chroma background must be removed with $g = \min(g, (r+b)/2)$.
- **Contour & CCL Quality Bounds (`AGENTS.md:46`):**
  - Reject transparent/empty frames.
  - Reject fill ratio $< 6\%$ of frame area (`minBboxFill = 0.06`).
  - Reject aspect ratio $> 3.2$ (`maxBboxAspect = 3.2`).
  - Reject collage echo with $> 4$ large components (`maxLargeComponents = 4`).
  - Reject multi-subject composition where 2nd component $> 30\%$ of main (`dominanceRatio = 0.30`).
- **Scale-To-Fit:** Bounding boxes must be scaled to fit within $256 \times 256$ preserving aspect ratio; blind cropping is strictly prohibited.
- **Raw Gate Retention:** Exact pre-normalization bytes must be stored at `guardians/{id}/raw/{rawSha256}.png` for cryptographic audit.
- **Cached Re-Validation:** Cached frames in R2 must be re-validated through the gate before compositing.

## 5. Queue DAG, Leases & Outbox Standards

- **Versioned Message Envelopes:** All queue communications must adhere to versioned discriminated unions (`GenerationQueueMessage`). Unparsed/unknown payloads must fail closed to the DLQ quarantine ledger.
- **Per-Pose Leasing:** Outbound AI generation requires an active conditional lease in `guardian_pose_attempts`.
- **Single-Winner Constraint:** Exactly one accepted attempt row is permitted per `(job_id, pose_id)` via `idx_pose_attempts_accepted`.
- **Crash-Consistent Batch Writes:** Frame checkpoints, budget settlements, job spend increments, and lease completions must execute in a single atomic batch guarded with `WHERE EXISTS (SELECT 1 FROM guardian_pose_attempts WHERE ... lease_owner = ? AND state = 'LEASED')`.
- **Single-Flight Outbox:** Transactional outbox rows must be claimed via conditional lease (`lease_owner`, `lease_expires_at`) before dispatch. Missing queue bindings must throw and back off; simulated deliveries are forbidden.
- **Atomic Hard Spend Limits:** Spend reservations must be committed against both per-job and per-day caps before external API calls. Abandoned reservations must be swept and restored.

## 6. Publication Integrity & Single Pointer Standards

- **Content-Addressed Immutable Assets:** All final master spritesheets, strips, and manifests must be stored at content-addressed keys (`masters/<sha>.png/.webp`, `manifests/<sha>.json`) with immutable cache headers.
- **Complete Preflight Verification:** Preflight gates must recompute SHA-256 digests over all 21 objects (16 raw frames, 16 normalized frames, 4 masters, and manifest) without sampling.
- **Contour Gate Re-Execution:** Preflight must re-run Phase 3 contour extraction on retained raw frame bytes to ensure cryptographic reproducibility.
- **Single-Row D1 Pointer Winner Election:** The authoritative publication decision must be a single-row insert into `guardian_publication(guardian_id)`. Duplicate concurrent publishes must fail on the unique constraint (`CONFLICT`).
- **Idempotent Post-CAS Projections:** `guardians.status` and `guardian_hatch_jobs.state` are non-authoritative projections applied after the pointer row commits and must be tolerant of `changes: 0`.

## 7. Reviewer Authorization & Provenance Standards

- **Dual-Auth Enforcement:** Admin routes strictly require Cloudflare Access RS256 JWT assertions or dedicated `ADMIN_REVIEW_SECRET` ($\ge 16$ bytes) with `constantTimeEqual`. Reusing `AUTH_SECRET` is strictly forbidden.
- **Dynamic JWKS Rotation:** Key rotations bypass cache seeds, coalesce concurrent in-flight fetches via a shared Promise, and apply a 5-second negative cache on verified absent keys.
- **Server-Derived Identity Hash:** Reference approvals derive `identityHash` strictly server-side from `guardians.identity_spec` via `validateIdentitySpec`, ignoring caller-supplied values.
- **Provenance-Bound Review Surface:** All pose approvals must execute via `POST /auth/admin/review/:jobId` with exact `bundleSha` validation. Automated 16-pass stamp paths are strictly prohibited.
