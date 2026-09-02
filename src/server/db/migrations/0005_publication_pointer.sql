-- ============================================================================
-- GitHoot D1 Migration 0005_publication_pointer.sql
-- Single-Row Authoritative Publication Pointer & Winner Election CAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS guardian_publication (
    guardian_id TEXT PRIMARY KEY REFERENCES guardians(id),
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    manifest_sha256 TEXT NOT NULL,
    manifest_key TEXT NOT NULL, -- e.g. "manifests/<manifestSha256>.json"
    spritesheet_sha256 TEXT NOT NULL,
    spritesheet_key TEXT NOT NULL, -- e.g. "masters/<stripPngSha256>.png"
    state TEXT NOT NULL DEFAULT 'ASSET_READY',
    reviewer TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publication_manifest ON guardian_publication(manifest_sha256);
CREATE INDEX IF NOT EXISTS idx_publication_state ON guardian_publication(state);
