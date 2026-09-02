-- ============================================================================
-- GitHoot D1 Migration 0006_review_records.sql
-- Immutable Review Audit Records & Bundle SHA Provenance
-- ============================================================================

CREATE TABLE IF NOT EXISTS guardian_review_records (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    guardian_id TEXT NOT NULL REFERENCES guardians(id),
    reviewer TEXT NOT NULL,
    decision TEXT NOT NULL, -- 'approve' | 'reject'
    bundle_sha TEXT NOT NULL,
    manifest_sha TEXT,
    frame_hashes TEXT NOT NULL, -- JSON array of 16 frame SHA-256 hashes
    notes TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_records_job ON guardian_review_records(job_id);
CREATE INDEX IF NOT EXISTS idx_review_records_bundle ON guardian_review_records(bundle_sha);
