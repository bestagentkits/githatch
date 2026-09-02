# Plan: Gallery of Guardians (`/gallery`)

- **Status**: Ready for Validation & Implementation
- **Author**: GitHoot Engineering
- **Date**: 2026-09-02
- **Branch**: `mrgoonie/gallery-of-guardians`
- **Route**: Feature (`/ak:cook --tdd --auto`)
- **Mode**: Official (Ship to `master`)

---

## 1. Executive Summary

Build a public, high-performance, accessible **Gallery of Guardians** at `/gallery` for GitHoot. The gallery allows anonymous visitors to discover, search, filter, and preview live hatched Guardian pets and their GitHub developer companions without incurring any AI generation or live GitHub API cost.

The architecture strictly separates static egg lore (`/explore` using `EGG_MANIFEST`) from live hatched companions (`/gallery` using D1 SQLite + Workers KV), uses keyset cursor pagination with snapshot isolation, targets 5 new B-tree indexes for zero table scans, and renders Option 1 Cyber-Arcade cards with on-demand lazy 16-frame spritesheet animations.

---

## 2. Requirements & Scope Boundaries

### In Scope
1. **D1 Migration & Indexing**: Add migration `0009_gallery_indexes.sql` creating 5 targeted indexes covering publication state/time, element/rarity, name collation, and owner login collation.
2. **Server API Endpoint (`GET /api/gallery`)**:
   - Query params: `q` (prefix search on login & name), `element`, `rarity`, `sort` (`newest` | `oldest`), `limit` (default 24, max 48), `cursor` (base64url keyset).
   - Publication authority: only returns records with `guardian_publication.state = 'ASSET_READY'`.
   - Security: fully parameterized queries, closed fragment maps for `ORDER BY`, zero internal ID/seed/telemetry leaks.
   - SWR Caching: Workers KV cache (30s fresh, 90s stale with background `waitUntil` revalidation, 120s TTL) for browse queries; bypass KV for high-cardinality free-text search.
   - Degraded mode fallback: serves exact stale cache when D1 is unavailable or honest `503 GALLERY_UNAVAILABLE`.
3. **Route Classification & SPA Fallback**:
   - Add `/gallery` to client router `src/client/main.tsx` before `/:username` profile fallback.
   - Exclude `gallery` from server SPA/OpenGraph fallback (`src/server/index.ts`) so it never generates `@gallery` profile meta tags.
4. **React Client Gallery Experience (`GalleryPage.tsx` & `GuardianGalleryCard.tsx`)**:
   - Option 1 Cyber-Arcade styling: Archivo headers, JetBrains Mono stats, cyan `#00f0ff` & magenta `#ff2a85` accents, `#07090e`/`#0d111a` dark surfaces.
   - Interactive toolbar: search input with debounce, element & rarity filter dropdowns, sort selector, active filter chips, and Reset action.
   - Responsive layout: 1 col on mobile, 2 on tablet, 3 on desktop, $\le 4$ on wide screens; mobile filter drawer with focus trap and $\ge 44\text{px}$ touch targets.
   - Card presentation: static lazy hero image by default; on hover/focus, lazily loads published 16-frame strip and plays a 1.1s `steps(15)` animation.
   - URL synchronization: `?q=...&element=...&rarity=...&sort=...` preserved across refresh, sharing, and Back/Forward.
   - Empty & Error states: "Clear Filters" action and a "Hatch your own Guardian" CTA linking to Home and auto-focusing the username input.
5. **Navbar & Navigation Updates**:
   - Desktop and mobile links for `Gallery` (`/gallery`) and `Explore Archetypes` (`/explore`).

### Non-Goals
- Any AI generation or prompt execution on gallery reads (0 AI cost).
- Full-text fuzzy/vector search or substring `%q%` scans.
- PvP arena, store, inventory, trading, or social likes/leaderboards (MVP guard).
- Denormalized projection tables or external search services (Algolia/Typesense).

---

## 3. Phases

- [Phase 1: Database Indexes & Shared Contracts](./phase-01-database-indexes-and-contracts.md)
- [Phase 2: Server API Route & KV SWR Caching](./phase-02-server-api-and-kv-caching.md)
- [Phase 3: React Client Gallery Page & Cards](./phase-03-client-ui-gallery-page-and-cards.md)
- [Phase 4: Navigation, Routing Integration & Full Verification](./phase-04-navigation-routing-and-verification.md)

---

## 4. Dependencies & Verification Strategy

- **Phase 1 $\rightarrow$ Phase 2 $\rightarrow$ Phase 3 $\rightarrow$ Phase 4** (Strict linear progression).
- **Quality Gates**:
  1. `npm run typecheck` (0 type errors).
  2. `npm run build` (Clean compilation of Vite client, Pages worker, and Queue worker).
  3. `npm test` (Unit tests + Cloudflare Worker integration smoke tests + Determinism tests).
  4. Query plan verification: `EXPLAIN QUERY PLAN` confirms B-tree index usage on all gallery query shapes with 0 full scans.
