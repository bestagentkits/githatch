# Phase 1: Database Indexes & Shared Contracts

## Context & Objectives
Ensure the database schema supports high-performance, deterministic gallery traversal with zero table scans on `guardians` or `github_accounts`, and define the strict TypeScript contracts for gallery queries, responses, and cursor payloads.

## Files to Modify / Create
- Create `src/server/db/migrations/0009_gallery_indexes.sql`
- Update `src/server/db/schema.sql` (keep in sync with migration)
- Update `src/server/types/index.ts` (define `GalleryItem`, `GalleryResponse`, `GalleryQuery`, `GalleryCursorPayload`)
- Update `tests/unit/d1-schema-migration.test.ts` (add migration index assertions)
- Update `tests/integration/setup/migrations.ts` (include migration 0009)

## Implementation Steps
1. **Migration 0009**:
   ```sql
   -- ============================================================================
   -- Migration 0009: Gallery of Guardians Indexes
   -- ============================================================================
   CREATE INDEX IF NOT EXISTS idx_gallery_publication_time
     ON guardian_publication(state, published_at, guardian_id);

   CREATE INDEX IF NOT EXISTS idx_gallery_guardian_element_rarity
     ON guardians(element, rarity_tier, id);

   CREATE INDEX IF NOT EXISTS idx_gallery_guardian_rarity_element
     ON guardians(rarity_tier, element, id);

   CREATE INDEX IF NOT EXISTS idx_gallery_guardian_name_nocase
     ON guardians(name COLLATE NOCASE, id);

   CREATE INDEX IF NOT EXISTS idx_gallery_login_nocase
     ON github_accounts(login COLLATE NOCASE, github_user_id);
   ```
2. **Synchronize `schema.sql`**: Add the 5 index statements to `src/server/db/schema.sql`.
3. **Shared Contracts (`src/server/types/index.ts`)**:
   ```ts
   export type GallerySort = 'newest' | 'oldest';

   export interface GalleryItem {
     id: string;
     name: string;
     species: string;
     species_name: string | null;
     element: string;
     rarity_tier: RarityTier;
     level: number;
     experience: number;
     energy_state: EnergyState;
     hero_image_url: string;
     spritesheet_url: string | null;
     published_at: number;
     owner: {
       login: string;
       name: string | null;
       avatar_url: string | null;
       total_stars: number;
     };
   }

   export interface GalleryResponse {
     items: GalleryItem[];
     page: {
       limit: number;
       has_more: boolean;
       next_cursor: string | null;
       snapshot_at: number;
     };
     applied: {
       q: string | null;
       element: string | null;
       rarity: RarityTier | null;
       sort: GallerySort;
     };
   }

   export interface GalleryCursorPayload {
     v: 1;
     sort: GallerySort;
     snapshot_at: number;
     last_published_at: number;
     last_guardian_id: string;
     fingerprint: string;
   }
   ```
4. **Update Migration Harness & Tests**:
   - Register migration 0009 in `tests/integration/setup/migrations.ts`.
   - Add unit test verifying that `0009_gallery_indexes.sql` parses and applies cleanly.

## Validation
- `npm run typecheck` passes.
- `npx vitest run tests/unit/d1-schema-migration.test.ts` passes.
