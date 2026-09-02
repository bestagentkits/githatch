-- ============================================================================
-- GitHoot D1 SQLite Database Schema (src/server/db/schema.sql)
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    github_user_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. GitHub Accounts Cache & Metadata Table
CREATE TABLE IF NOT EXISTS github_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    github_user_id INTEGER UNIQUE NOT NULL,
    login TEXT NOT NULL,
    avatar_url TEXT,
    name TEXT,
    bio TEXT,
    public_repos INTEGER DEFAULT 0,
    followers INTEGER DEFAULT 0,
    total_stars INTEGER DEFAULT 0,
    top_languages TEXT, -- JSON Array: ["TypeScript", "Rust", "Go"]
    claimed_at INTEGER,
    last_synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gh_accounts_login ON github_accounts(login);
CREATE INDEX IF NOT EXISTS idx_gh_accounts_user_id ON github_accounts(github_user_id);

-- 3. Guardians Table (Fantasy Companion)
CREATE TABLE IF NOT EXISTS guardians (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    github_user_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    egg_type TEXT NOT NULL, -- e.g. "ember-core", "neon-byte", "abyssal-pearl"
    species TEXT NOT NULL,  -- e.g. "emberfox", "neonbyte", "abyssal"
    species_name TEXT,      -- e.g. "Ignis Emberfox", "Aether Neon Byte"
    anatomy TEXT,           -- e.g. "agile vulpine quadruped with flame tails"
    element TEXT NOT NULL,  -- e.g. "Fire", "Cyber", "Water", "Nature", "Void"
    dna_seed TEXT NOT NULL, -- SHA-256 seed derived deterministically
    dna_version TEXT DEFAULT 'v1',
    rarity_tier TEXT NOT NULL, -- "Common", "Rare", "Epic", "Legendary", "Mythic"
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'GENERATING', 'VERIFYING', 'ASSET_READY', 'QUARANTINED', 'FAILED'
    hero_image_url TEXT NOT NULL,
    spritesheet_url TEXT,
    traits TEXT NOT NULL,   -- JSON: { archetype, silhouette, palette, temperament }
    telemetry_snapshot TEXT, -- JSON: normalized GitHub metrics
    identity_spec TEXT,      -- JSON: compiled IdentitySpec
    reference_sha256 TEXT,   -- Pinned canonical reference SHA-256
    request_fingerprint TEXT,-- Idempotency key
    manifest_url TEXT,       -- URL to manifest.json on R2 CDN
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    energy_state TEXT DEFAULT 'Active', -- 'Energetic', 'Active', 'Resting', 'Sleeping'
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guardians_gh_id ON guardians(github_user_id);
CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status);
CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);

-- 4. Reference Candidates Table (Immutable bootstrap review lifecycle)
CREATE TABLE IF NOT EXISTS guardian_reference_candidates (
    id TEXT PRIMARY KEY,
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    candidate_sha256 TEXT NOT NULL,
    identity_hash TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    model_id TEXT NOT NULL,
    raw_sha256 TEXT NOT NULL,
    state TEXT DEFAULT 'VERIFYING', -- 'VERIFYING', 'APPROVED', 'REJECTED'
    reviewer TEXT,
    verdict_data TEXT, -- JSON: { verdict, reviewer, boundToSha256, boundToIdentityHash, covers }
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ref_candidates_gid ON guardian_reference_candidates(guardian_id);
CREATE INDEX IF NOT EXISTS idx_ref_candidates_state ON guardian_reference_candidates(state);
CREATE INDEX IF NOT EXISTS idx_ref_candidates_sha ON guardian_reference_candidates(candidate_sha256);

-- 5. Hatch Jobs Table (Queue DAG tracking & idempotency)
CREATE TABLE IF NOT EXISTS guardian_hatch_jobs (
    id TEXT PRIMARY KEY,
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    request_fingerprint TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL, -- 'PENDING', 'GENERATING', 'VERIFYING', 'QUARANTINED', 'ASSET_READY', 'FAILED'
    model_id TEXT NOT NULL,
    attempts_count INTEGER DEFAULT 0,
    frames_completed INTEGER DEFAULT 0,
    reserved_cents INTEGER NOT NULL DEFAULT 0,
    spent_cents INTEGER NOT NULL DEFAULT 0,
    manifest_url TEXT,
    error_log TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hatch_jobs_gid ON guardian_hatch_jobs(guardian_id);
CREATE INDEX IF NOT EXISTS idx_hatch_jobs_state ON guardian_hatch_jobs(state);
CREATE INDEX IF NOT EXISTS idx_hatch_jobs_fingerprint ON guardian_hatch_jobs(request_fingerprint);

-- 6. Hatch Frames Table (Per-pose checkpointing for true zero duplicate billing)
CREATE TABLE IF NOT EXISTS guardian_hatch_frames (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    pose_id TEXT NOT NULL,
    pose_index INTEGER NOT NULL,
    frame_sha256 TEXT NOT NULL,
    raw_sha256 TEXT NOT NULL,
    state TEXT DEFAULT 'ACCEPTED', -- 'ACCEPTED', 'REJECTED', 'QUARANTINED'
    raw_gate_metrics TEXT, -- JSON: { components, dominance, fill, aspect, bbox }
    semantic_verdict TEXT, -- JSON: { verdict, reviewer, timestamp }
    created_at INTEGER NOT NULL,
    UNIQUE(job_id, pose_id)
);

CREATE INDEX IF NOT EXISTS idx_hatch_frames_job ON guardian_hatch_frames(job_id);
CREATE INDEX IF NOT EXISTS idx_hatch_frames_pose ON guardian_hatch_frames(job_id, pose_index);

-- 7. Early Access Slots Table (100 Atomic Free Slots)
CREATE TABLE IF NOT EXISTS early_access_slots (
    slot_number INTEGER PRIMARY KEY, -- 1 to 100
    github_user_id INTEGER UNIQUE,
    claimed_at INTEGER,
    status TEXT DEFAULT 'available' -- 'available', 'reserved', 'claimed'
);

CREATE INDEX IF NOT EXISTS idx_ea_slots_status ON early_access_slots(status);

-- 8. GitHub Token Pool Table (Rotating Tokens for SWR Resolver)
CREATE TABLE IF NOT EXISTS github_token_pool (
    id TEXT PRIMARY KEY,
    token_masked TEXT NOT NULL,
    remaining_quota INTEGER DEFAULT 5000,
    reset_time INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 9. Activity Ledger Table (Append-only Event Log)
CREATE TABLE IF NOT EXISTS activity_ledger (
    id TEXT PRIMARY KEY,
    github_user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- "CLAIM_HATCH", "COMMIT_SYNC", "MOOD_CHANGE"
    payload TEXT, -- JSON
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_ledger_gh_id ON activity_ledger(github_user_id);

-- 7. GitHub Aggregate Stats Table (Owner-consented public aggregate COUNTS only; never names/URLs/tokens)
CREATE TABLE IF NOT EXISTS github_aggregate_stats (
    github_user_id           INTEGER PRIMARY KEY,
    contributions_last_year  INTEGER NOT NULL CHECK (contributions_last_year >= 0),
    owned_repositories_total INTEGER NOT NULL CHECK (owned_repositories_total >= 0),
    period_started_at        INTEGER NOT NULL,
    period_ended_at          INTEGER NOT NULL,
    refreshed_at             INTEGER NOT NULL,
    consent_version          INTEGER NOT NULL DEFAULT 1
);

-- 10. AI Budget Ledger Table (Atomic Daily Spend & Reservation Guard)
CREATE TABLE IF NOT EXISTS ai_budget_ledger (
    day TEXT PRIMARY KEY,
    reserved_cents INTEGER NOT NULL DEFAULT 0,
    settled_cents INTEGER NOT NULL DEFAULT 0,
    cap_cents INTEGER NOT NULL DEFAULT 2000, -- $20.00 default cap in cents
    total_calls INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 11. Per-Pose Lease and Attempt Ledger
CREATE TABLE IF NOT EXISTS guardian_pose_attempts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    pose_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    claim_key TEXT UNIQUE NOT NULL,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    state TEXT DEFAULT 'LEASED',
    raw_sha256 TEXT,
    frame_sha256 TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(job_id, pose_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_pose_attempts_job ON guardian_pose_attempts(job_id, pose_id);
CREATE INDEX IF NOT EXISTS idx_pose_attempts_lease ON guardian_pose_attempts(lease_expires_at, state);
CREATE INDEX IF NOT EXISTS idx_pose_attempts_claim ON guardian_pose_attempts(claim_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pose_attempts_accepted ON guardian_pose_attempts(job_id, pose_id) WHERE state = 'ACCEPTED';

-- 12. Transactional Outbox for Reliable Queue Delivery with Single-Flight Leases
CREATE TABLE IF NOT EXISTS guardian_outbox (
    id TEXT PRIMARY KEY,
    claim_key TEXT UNIQUE NOT NULL,
    queue_name TEXT NOT NULL,
    payload TEXT NOT NULL,
    state TEXT DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    delivered_at INTEGER,
    last_error TEXT,
    next_attempt_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_state ON guardian_outbox(state, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_claim ON guardian_outbox(claim_key);
CREATE INDEX IF NOT EXISTS idx_outbox_lease ON guardian_outbox(lease_owner, lease_expires_at);

-- 13. Per-Job Budget Reservations & Ledger
CREATE TABLE IF NOT EXISTS guardian_budget_reservations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    pose_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    day TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 25,
    state TEXT DEFAULT 'RESERVED',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(job_id, pose_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_budget_res_job ON guardian_budget_reservations(job_id);
CREATE INDEX IF NOT EXISTS idx_budget_res_day ON guardian_budget_reservations(day, state);

-- 14. DLQ Quarantine Ledger (Immutable record of poison/malformed messages)
CREATE TABLE IF NOT EXISTS guardian_dlq_quarantine (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    queue_name TEXT NOT NULL,
    payload TEXT NOT NULL,
    error_reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dlq_quarantine_msg ON guardian_dlq_quarantine(message_id);

-- 15. Authoritative Publication Pointer & Winner Election CAS
CREATE TABLE IF NOT EXISTS guardian_publication (
    guardian_id TEXT PRIMARY KEY REFERENCES guardians(id),
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    manifest_sha256 TEXT NOT NULL,
    manifest_key TEXT NOT NULL,
    spritesheet_sha256 TEXT NOT NULL,
    spritesheet_key TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'ASSET_READY',
    reviewer TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publication_manifest ON guardian_publication(manifest_sha256);
CREATE INDEX IF NOT EXISTS idx_publication_state ON guardian_publication(state);

-- 16. Immutable Review Audit Records & Bundle SHA Provenance
CREATE TABLE IF NOT EXISTS guardian_review_records (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    reviewer TEXT NOT NULL,
    decision TEXT NOT NULL,
    bundle_sha TEXT NOT NULL,
    manifest_sha TEXT,
    frame_hashes TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_records_job ON guardian_review_records(job_id);
CREATE INDEX IF NOT EXISTS idx_review_records_bundle ON guardian_review_records(bundle_sha);
