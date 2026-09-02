-- Migration 0002_github_aggregate_stats.sql
-- Owner-consented public aggregate COUNTS only. Never stores tokens, private repo
-- names/URLs, or per-event detail. contributions_last_year is the GitHub
-- contribution-calendar total (private-inclusive) for an explicit trailing window;
-- owned_repositories_total is the owner-affiliated repository count including private.
CREATE TABLE IF NOT EXISTS github_aggregate_stats (
    github_user_id           INTEGER PRIMARY KEY,
    contributions_last_year  INTEGER NOT NULL CHECK (contributions_last_year >= 0),
    owned_repositories_total INTEGER NOT NULL CHECK (owned_repositories_total >= 0),
    period_started_at        INTEGER NOT NULL,
    period_ended_at          INTEGER NOT NULL,
    refreshed_at             INTEGER NOT NULL,
    consent_version          INTEGER NOT NULL DEFAULT 1
);
