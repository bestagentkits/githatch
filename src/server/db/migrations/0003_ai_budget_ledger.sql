-- ============================================================================
-- GitHoot D1 Migration 0003_ai_budget_ledger.sql
-- Atomic Daily AI Generation Spend Ledger and Reservation Guard
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_budget_ledger (
    day TEXT PRIMARY KEY,
    reserved_cents INTEGER NOT NULL DEFAULT 0,
    settled_cents INTEGER NOT NULL DEFAULT 0,
    cap_cents INTEGER NOT NULL DEFAULT 2000, -- $20.00 default cap in cents (2000 cents)
    total_calls INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
