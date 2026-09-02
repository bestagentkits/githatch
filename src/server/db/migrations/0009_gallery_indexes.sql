-- ============================================================================
-- GitHoot D1 Database Migration: 0009_gallery_indexes.sql
-- Indexes for public Gallery of Guardians discovery, filtering, and sorting
-- ============================================================================

-- 1. Index on guardian_publication for newest/oldest browse and pagination
CREATE INDEX IF NOT EXISTS idx_gallery_publication_time
  ON guardian_publication(state, published_at, guardian_id);

-- 2. Composite indexes on guardians for element and rarity filters
CREATE INDEX IF NOT EXISTS idx_gallery_guardian_element_rarity
  ON guardians(element, rarity_tier, id);

CREATE INDEX IF NOT EXISTS idx_gallery_guardian_rarity_element
  ON guardians(rarity_tier, element, id);

-- 3. Case-insensitive index on guardian name for prefix search
CREATE INDEX IF NOT EXISTS idx_gallery_guardian_name_nocase
  ON guardians(name COLLATE NOCASE, id);

-- 4. Case-insensitive index on github_accounts login for owner search
CREATE INDEX IF NOT EXISTS idx_gallery_login_nocase
  ON github_accounts(login COLLATE NOCASE, github_user_id);
