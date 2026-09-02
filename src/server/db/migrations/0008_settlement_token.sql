-- ============================================================================
-- GitHoot D1 Migration 0008_settlement_token.sql
-- Cryptographic Single-Flight Settlement Tokens for Atomic Spend Idempotency
-- ============================================================================

ALTER TABLE guardian_budget_reservations ADD COLUMN settlement_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_res_settle_token ON guardian_budget_reservations(settlement_token);
