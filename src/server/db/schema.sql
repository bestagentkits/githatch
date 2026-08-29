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
    species TEXT NOT NULL,  -- e.g. "Ignis Emberfox", "Aether Neon Byte"
    element TEXT NOT NULL,  -- e.g. "Fire", "Cyber", "Water", "Nature", "Void"
    dna_seed TEXT NOT NULL, -- SHA-256 seed derived deterministically
    rarity_tier TEXT NOT NULL, -- "Common", "Rare", "Epic", "Legendary", "Mythic"
    hero_image_url TEXT NOT NULL,
    spritesheet_url TEXT,
    traits TEXT NOT NULL,   -- JSON: { archetype, silhouette, palette, temperament }
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    energy_state TEXT DEFAULT 'Active', -- 'Energetic', 'Active', 'Resting', 'Hungry_for_code'
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guardians_gh_id ON guardians(github_user_id);

-- 4. Early Access Slots Table (100 Atomic Free Slots)
CREATE TABLE IF NOT EXISTS early_access_slots (
    slot_number INTEGER PRIMARY KEY, -- 1 to 100
    github_user_id INTEGER UNIQUE,
    claimed_at INTEGER,
    status TEXT DEFAULT 'available' -- 'available', 'reserved', 'claimed'
);

CREATE INDEX IF NOT EXISTS idx_ea_slots_status ON early_access_slots(status);

-- 5. GitHub Token Pool Table (Rotating Tokens for SWR Resolver)
CREATE TABLE IF NOT EXISTS github_token_pool (
    id TEXT PRIMARY KEY,
    token_masked TEXT NOT NULL,
    remaining_quota INTEGER DEFAULT 5000,
    reset_time INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 6. Activity Ledger Table (Append-only Event Log)
CREATE TABLE IF NOT EXISTS activity_ledger (
    id TEXT PRIMARY KEY,
    github_user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL, -- "CLAIM_HATCH", "COMMIT_SYNC", "MOOD_CHANGE"
    payload TEXT, -- JSON
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_ledger_gh_id ON activity_ledger(github_user_id);
