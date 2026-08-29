-- Migration 0001_initial.sql
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    github_user_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. GitHub Accounts
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
    top_languages TEXT,
    claimed_at INTEGER,
    last_synced_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gh_accounts_login ON github_accounts(login);
CREATE INDEX IF NOT EXISTS idx_gh_accounts_user_id ON github_accounts(github_user_id);

-- 3. Guardians
CREATE TABLE IF NOT EXISTS guardians (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    github_user_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    egg_type TEXT NOT NULL,
    species TEXT NOT NULL,
    element TEXT NOT NULL,
    dna_seed TEXT NOT NULL,
    rarity_tier TEXT NOT NULL,
    hero_image_url TEXT NOT NULL,
    spritesheet_url TEXT,
    traits TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    energy_state TEXT DEFAULT 'Active',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guardians_gh_id ON guardians(github_user_id);

-- 4. Early Access Slots
CREATE TABLE IF NOT EXISTS early_access_slots (
    slot_number INTEGER PRIMARY KEY,
    github_user_id INTEGER UNIQUE,
    claimed_at INTEGER,
    status TEXT DEFAULT 'available'
);

CREATE INDEX IF NOT EXISTS idx_ea_slots_status ON early_access_slots(status);

-- Pre-seed 100 slots
WITH RECURSIVE cnt(x) AS (
    SELECT 1
    UNION ALL
    SELECT x+1 FROM cnt
    LIMIT 100
)
INSERT OR IGNORE INTO early_access_slots (slot_number, status)
SELECT x, 'available' FROM cnt;

-- 5. GitHub Token Pool
CREATE TABLE IF NOT EXISTS github_token_pool (
    id TEXT PRIMARY KEY,
    token_masked TEXT NOT NULL,
    remaining_quota INTEGER DEFAULT 5000,
    reset_time INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 6. Activity Ledger
CREATE TABLE IF NOT EXISTS activity_ledger (
    id TEXT PRIMARY KEY,
    github_user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_ledger_gh_id ON activity_ledger(github_user_id);
