# Phase 2: Server API Route & KV SWR Caching

## Context & Objectives
Implement the dedicated `GET /api/gallery` endpoint on the Cloudflare Pages Hono worker. The endpoint queries published companions from D1 SQLite using indexed joins and keyset cursors, protects data privacy (zero internal fields), implements KV SWR caching for browse queries (with bypass for free-text search), and provides graceful fallback during D1 degradation.

## Files to Modify / Create
- Create `src/server/routes/gallery.ts` (Hono sub-router with query builder, cursor encoder/decoder, validation, and KV cache layer)
- Update `src/server/index.ts` (mount `app.route('/api/gallery', galleryRouter)`)
- Create `tests/unit/gallery-route.test.ts` (unit tests for query builder, cursor validation, SQL injection safety, and cache keying)
- Update `tests/integration/harness.smoke.test.ts` (integration tests exercising real D1 + KV edge execution)

## Implementation Steps
1. **Query Construction & Keyset Paging (`src/server/routes/gallery.ts`)**:
   - Parse and validate input params:
     - `q`: 2–40 chars, trimmed, wildcard escaped (`%` $\rightarrow$ `\%`, `_` $\rightarrow$ `\_`, `\` $\rightarrow$ `\\`).
     - `element`: validated against canonical elements `['Fire', 'Cyber', 'Water', 'Nature', 'Light', 'Void', 'Metal', 'Cosmic']`.
     - `rarity`: validated against canonical rarities `['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']`.
     - `sort`: `newest` (default) or `oldest`.
     - `limit`: integer $1 \le \text{limit} \le 48$ (default 24).
     - `cursor`: decode base64url JSON $\rightarrow$ `GalleryCursorPayload`. Validate `fingerprint === currentFingerprint`.
   - Parameterized SQL Base:
     ```sql
     SELECT
       g.id, g.name, g.species, g.species_name, g.element, g.rarity_tier,
       g.level, g.experience, g.energy_state, g.hero_image_url, g.spritesheet_url,
       p.published_at,
       a.login as owner_login, a.name as owner_name, a.avatar_url as owner_avatar_url, a.total_stars as owner_total_stars
     FROM guardian_publication p
     INNER JOIN guardians g ON g.id = p.guardian_id
     INNER JOIN github_accounts a ON a.github_user_id = g.github_user_id
     WHERE p.state = 'ASSET_READY'
     ```
   - Dynamically append indexed WHERE clauses:
     - Snapshot & Keyset clause:
       - For `newest`: `AND (p.published_at < :last_published_at OR (p.published_at = :last_published_at AND p.guardian_id < :last_guardian_id)) AND p.published_at <= :snapshot_at`
       - For `oldest`: `AND (p.published_at > :last_published_at OR (p.published_at = :last_published_at AND p.guardian_id > :last_guardian_id)) AND p.published_at >= :snapshot_at`
     - Element filter: `AND g.element = :element`
     - Rarity filter: `AND g.rarity_tier = :rarity`
     - Prefix search filter: `AND (a.login LIKE :login_prefix ESCAPE '\' OR g.name LIKE :name_prefix ESCAPE '\')`
   - Order By:
     - `newest`: `ORDER BY p.published_at DESC, p.guardian_id DESC LIMIT :limit_plus_one`
     - `oldest`: `ORDER BY p.published_at ASC, p.guardian_id ASC LIMIT :limit_plus_one`
2. **KV SWR Cache Layer**:
   - Cache key format: `gallery:v1:<sha256(canonical_params)>`.
   - If `q` is non-empty $\rightarrow$ bypass KV directly to D1 (header `X-Gallery-Cache: BYPASS`).
   - If `q` is empty:
     - Check KV for cached response.
     - Fresh hit ($<30\text{s}$) $\rightarrow$ return with `X-Gallery-Cache: HIT`.
     - Stale hit ($30\text{s} - 120\text{s}$) $\rightarrow$ return with `X-Gallery-Cache: STALE` and schedule background refresh via `c.executionCtx.waitUntil(refreshGalleryCache(c.env, ...))`.
     - Miss $\rightarrow$ query D1, store in KV with 120s expiration, return with `X-Gallery-Cache: MISS`.
3. **Degraded Mode & Fault Tolerance**:
   - If D1 query throws:
     - Check if stale KV cache exists $\rightarrow$ serve with `meta.degraded = true`, `X-Gallery-Data: stale-kv`, `Warning: 110 - "Response is stale"`.
     - If no cache exists $\rightarrow$ return HTTP `503` with `error: { code: 'GALLERY_UNAVAILABLE', message: 'The gallery is temporarily unavailable. Please retry in a few moments.' }`, `Retry-After: 15`.
4. **Mount Route (`src/server/index.ts`)**:
   - `app.route('/api/gallery', galleryRouter)` mounted before `app.all('*')`.

## Validation
- `npm run typecheck` passes.
- `npx vitest run tests/unit/gallery-route.test.ts` passes (query shapes, validation, cursor security, SQL injection safety).
- `npm test` passes.
