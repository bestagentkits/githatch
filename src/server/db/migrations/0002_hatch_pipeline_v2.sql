-- ============================================================================
-- GitHoot D1 Migration 0002_hatch_pipeline_v2.sql
-- Upgrades Guardians schema for Deterministic Identity Engine & 16-Pose Pipeline
-- ============================================================================

-- 1. Alter Guardians Table with V2 Persistence Fields
ALTER TABLE guardians ADD COLUMN dna_version TEXT DEFAULT 'v1';
ALTER TABLE guardians ADD COLUMN status TEXT DEFAULT 'PENDING';
ALTER TABLE guardians ADD COLUMN species_name TEXT;
ALTER TABLE guardians ADD COLUMN anatomy TEXT;
ALTER TABLE guardians ADD COLUMN telemetry_snapshot TEXT;
ALTER TABLE guardians ADD COLUMN identity_spec TEXT;
ALTER TABLE guardians ADD COLUMN reference_sha256 TEXT;
ALTER TABLE guardians ADD COLUMN request_fingerprint TEXT;
ALTER TABLE guardians ADD COLUMN manifest_url TEXT;

CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status);
CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);

-- 2. Reference Candidates Table (Immutable bootstrap review lifecycle)
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

-- 3. Hatch Jobs Table (Queue DAG tracking & idempotency)
CREATE TABLE IF NOT EXISTS guardian_hatch_jobs (
    id TEXT PRIMARY KEY,
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    request_fingerprint TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL, -- 'PENDING', 'GENERATING', 'VERIFYING', 'QUARANTINED', 'ASSET_READY', 'FAILED'
    model_id TEXT NOT NULL,
    attempts_count INTEGER DEFAULT 0,
    frames_completed INTEGER DEFAULT 0,
    manifest_url TEXT,
    error_log TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hatch_jobs_gid ON guardian_hatch_jobs(guardian_id);
CREATE INDEX IF NOT EXISTS idx_hatch_jobs_state ON guardian_hatch_jobs(state);
CREATE INDEX IF NOT EXISTS idx_hatch_jobs_fingerprint ON guardian_hatch_jobs(request_fingerprint);

-- 4. Hatch Frames Table (Per-pose checkpointing for true zero duplicate billing)
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
