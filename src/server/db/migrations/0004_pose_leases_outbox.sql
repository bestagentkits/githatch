-- ============================================================================
-- GitHoot D1 Migration 0004_pose_leases_outbox.sql
-- Per-Pose Conditional Leases, Single-Flight Outbox & Quarantine Ledger
-- ============================================================================

-- 1. Atomic Job-Level Spend Tracking Columns
ALTER TABLE guardian_hatch_jobs ADD COLUMN reserved_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guardian_hatch_jobs ADD COLUMN spent_cents INTEGER NOT NULL DEFAULT 0;

-- 2. Per-Pose Lease and Attempt Ledger
CREATE TABLE IF NOT EXISTS guardian_pose_attempts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES guardian_hatch_jobs(id),
    pose_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    claim_key TEXT UNIQUE NOT NULL, -- e.g. "job:pose:attempt"
    lease_owner TEXT,
    lease_expires_at INTEGER,
    state TEXT DEFAULT 'LEASED', -- 'LEASED', 'ACCEPTED', 'REJECTED', 'FAILED', 'TIMED_OUT'
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

-- CRITICAL INVARIANT: Exactly one accepted attempt row allowed per (job_id, pose_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pose_attempts_accepted ON guardian_pose_attempts(job_id, pose_id) WHERE state = 'ACCEPTED';

-- 3. Transactional Outbox for Reliable Queue Delivery with Single-Flight Leases
CREATE TABLE IF NOT EXISTS guardian_outbox (
    id TEXT PRIMARY KEY,
    claim_key TEXT UNIQUE NOT NULL,
    queue_name TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON versioned GenerationQueueMessage
    state TEXT DEFAULT 'PENDING', -- 'PENDING', 'DELIVERED', 'FAILED', 'DEAD'
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

-- 4. Per-Job Budget Reservations & Ledger
CREATE TABLE IF NOT EXISTS guardian_budget_reservations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    pose_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    day TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 25,
    state TEXT DEFAULT 'RESERVED', -- 'RESERVED', 'COMMITTED', 'RELEASED', 'TIMED_OUT'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(job_id, pose_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_budget_res_job ON guardian_budget_reservations(job_id);
CREATE INDEX IF NOT EXISTS idx_budget_res_day ON guardian_budget_reservations(day, state);

-- 5. DLQ Quarantine Ledger (Immutable record of poison/malformed messages)
CREATE TABLE IF NOT EXISTS guardian_dlq_quarantine (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    queue_name TEXT NOT NULL,
    payload TEXT NOT NULL,
    error_reason TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dlq_quarantine_msg ON guardian_dlq_quarantine(message_id);
