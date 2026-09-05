// ============================================================================
// GitHoot Gallery Router (src/server/routes/gallery.ts)
// Public Hatched Guardians Discovery API with D1 Keyset Paging & KV SWR
// ============================================================================

import { Hono } from 'hono';
import type { Env, GalleryItem, GalleryResponse, GallerySort, RarityTier, GalleryCursorPayload } from '../types';
import { VALID_GALLERY_ELEMENTS, VALID_GALLERY_RARITIES, VALID_GALLERY_SORTS } from '../types';

export const galleryRouter = new Hono<{ Bindings: Env }>();

export const VALID_RARITIES: RarityTier[] = VALID_GALLERY_RARITIES;
export const VALID_ELEMENTS: string[] = VALID_GALLERY_ELEMENTS;
export const VALID_SORTS: GallerySort[] = VALID_GALLERY_SORTS;

const SOFT_FRESH_MS = 30_000;      // 30 seconds fresh
const MAX_STALE_MS = 120_000;      // 120 seconds stale-while-revalidate
const KV_TTL_SECONDS = 120;        // 120 seconds KV retention
const LOCK_TTL_SECONDS = 15;       // 15 seconds single-flight lock

/**
 * Escapes SQL LIKE metacharacters: %, _, and \
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Derives a deterministic query fingerprint to protect cursor integrity
 */
export async function computeQueryFingerprint(
  sort: GallerySort,
  element: string | null,
  rarity: string | null,
  q: string | null
): Promise<string> {
  const raw = `${sort}|${element || ''}|${rarity || ''}|${q || ''}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Encodes an opaque keyset cursor to base64url
 */
export function encodeCursor(payload: GalleryCursorPayload): string {
  const json = JSON.stringify(payload);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes an opaque keyset cursor from base64url
 */
export function decodeCursor(cursorStr: string): GalleryCursorPayload | null {
  try {
    let base64 = cursorStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const json = atob(base64);
    const parsed = JSON.parse(json);
    if (
      parsed &&
      parsed.v === 1 &&
      (parsed.sort === 'newest' || parsed.sort === 'oldest') &&
      typeof parsed.snapshot_at === 'number' &&
      typeof parsed.last_published_at === 'number' &&
      typeof parsed.last_guardian_id === 'string' &&
      typeof parsed.fingerprint === 'string'
    ) {
      return parsed as GalleryCursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Computes canonical KV cache key
 */
export async function computeCacheKey(
  sort: GallerySort,
  limit: number,
  element: string | null,
  rarity: string | null,
  cursorStr: string | null
): Promise<string> {
  const raw = `v1:${sort}:${limit}:${element || ''}:${rarity || ''}:${cursorStr || ''}`;
  const encoded = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `gallery:v1:${hex}`;
}

interface RawGuardianDbRow {
  id: string;
  name: string;
  species: string;
  species_name: string | null;
  element: string;
  rarity_tier: string;
  level: number;
  experience: number;
  energy_state: string;
  hero_image_url: string;
  spritesheet_url: string | null;
  published_at: number;
  spritesheet_key: string | null;
  owner_login: string;
  owner_name: string | null;
  owner_avatar_url: string | null;
  owner_total_stars: number | null;
}

/**
 * Executes authoritative D1 query with keyset pagination
 */
export async function executeGalleryQuery(
  db: D1Database,
  cdnDomain: string,
  sort: GallerySort,
  limit: number,
  element: string | null,
  rarity: RarityTier | null,
  q: string | null,
  cursorPayload: GalleryCursorPayload | null,
  currentSnapshotAt: number
): Promise<{ items: GalleryItem[]; hasMore: boolean; nextCursor: string | null; snapshotAt: number }> {
  const snapshotAt = cursorPayload ? cursorPayload.snapshot_at : currentSnapshotAt;
  const whereClauses: string[] = ["p.state = 'ASSET_READY'"];
  const bindings: (string | number)[] = [];
  // Snapshot bounds (cap at snapshot timestamp for both newest and oldest)
  whereClauses.push('p.published_at <= ?');
  bindings.push(snapshotAt);

  // Cursor progression
  if (cursorPayload) {
    if (sort === 'newest') {
      whereClauses.push(
        '(p.published_at < ? OR (p.published_at = ? AND p.guardian_id < ?))'
      );
      bindings.push(cursorPayload.last_published_at, cursorPayload.last_published_at, cursorPayload.last_guardian_id);
    } else {
      whereClauses.push(
        '(p.published_at > ? OR (p.published_at = ? AND p.guardian_id > ?))'
      );
      bindings.push(cursorPayload.last_published_at, cursorPayload.last_published_at, cursorPayload.last_guardian_id);
    }
  }

  // Element filter
  if (element) {
    whereClauses.push('g.element = ?');
    bindings.push(element);
  }

  // Rarity filter
  if (rarity) {
    whereClauses.push('g.rarity_tier = ?');
    bindings.push(rarity);
  }

  // Search prefix filter (case-insensitive on login and guardian name)
  if (q) {
    const escaped = escapeLikePattern(q.trim());
    const pattern = `${escaped}%`;
    whereClauses.push('(a.login LIKE ? ESCAPE \'\\\' OR g.name LIKE ? ESCAPE \'\\\')');
    bindings.push(pattern, pattern);
  }

  const orderBy =
    sort === 'newest'
      ? 'ORDER BY p.published_at DESC, p.guardian_id DESC'
      : 'ORDER BY p.published_at ASC, p.guardian_id ASC';

  const sql = `
    SELECT
      g.id, g.name, g.species, g.species_name, g.element, g.rarity_tier,
      g.level, g.experience, g.energy_state, g.hero_image_url, g.spritesheet_url,
      p.published_at, p.spritesheet_key,
      a.login as owner_login, a.name as owner_name, a.avatar_url as owner_avatar_url, a.total_stars as owner_total_stars
    FROM guardian_publication p
    INNER JOIN guardians g ON g.id = p.guardian_id
    INNER JOIN github_accounts a ON a.github_user_id = g.github_user_id
    WHERE ${whereClauses.join(' AND ')}
    ${orderBy}
    LIMIT ?
  `;

  bindings.push(limit + 1);

  const stmt = db.prepare(sql);
  const result = await stmt.bind(...bindings).all<RawGuardianDbRow>();
  const rows = result.results || [];

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  const items: GalleryItem[] = pageRows.map((row) => {
    const spritesheetUrl = row.spritesheet_key
      ? `https://${cdnDomain}/${row.spritesheet_key}`
      : row.spritesheet_url || null;

    return {
      id: row.id,
      name: row.name,
      species: row.species,
      species_name: row.species_name || null,
      element: row.element,
      rarity_tier: row.rarity_tier as RarityTier,
      level: row.level || 1,
      experience: row.experience || 0,
      energy_state: row.energy_state || 'Active',
      hero_image_url: row.hero_image_url,
      spritesheet_url: spritesheetUrl,
      published_at: row.published_at,
      owner: {
        login: row.owner_login,
        name: row.owner_name || null,
        avatar_url: row.owner_avatar_url || null,
        total_stars: row.owner_total_stars || 0
      }
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const lastRow = pageRows[pageRows.length - 1]!;
    const fingerprint = await computeQueryFingerprint(sort, element, rarity, q);
    const nextPayload: GalleryCursorPayload = {
      v: 1,
      sort,
      snapshot_at: snapshotAt,
      last_published_at: lastRow.published_at,
      last_guardian_id: lastRow.id,
      fingerprint
    };
    nextCursor = encodeCursor(nextPayload);
  }

  return { items, hasMore, nextCursor, snapshotAt };
}

/**
 * Main Gallery Route Handler
 */
galleryRouter.get('/', async (c) => {
  const query = c.req.query();
  const cdnDomain = c.env.CDN_DOMAIN || 'cdn.githoot.com';

  // 1. Validate & Parse Sort
  const rawSort = (query.sort || 'newest').toLowerCase();
  if (rawSort !== 'newest' && rawSort !== 'oldest') {
    return c.json({ error: { code: 'INVALID_QUERY', message: "Invalid sort parameter. Expected 'newest' or 'oldest'." } }, 400);
  }
  const sort: GallerySort = rawSort;

  // 2. Validate & Parse Limit
  let limit = 24;
  if (query.limit) {
    const parsed = parseInt(query.limit, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 48) {
      return c.json({ error: { code: 'INVALID_QUERY', message: 'Limit must be an integer between 1 and 48.' } }, 400);
    }
    limit = parsed;
  }

  // 3. Validate & Parse Element
  let element: string | null = null;
  if (query.element) {
    const rawElem = query.element.trim();
    const matched = VALID_ELEMENTS.find((e) => e.toLowerCase() === rawElem.toLowerCase());
    if (!matched) {
      return c.json({ error: { code: 'INVALID_QUERY', message: `Invalid element. Valid options: ${VALID_ELEMENTS.join(', ')}` } }, 400);
    }
    element = matched;
  }

  // 4. Validate & Parse Rarity
  let rarity: RarityTier | null = null;
  if (query.rarity) {
    const rawRarity = query.rarity.trim();
    const matched = VALID_RARITIES.find((r) => r.toLowerCase() === rawRarity.toLowerCase());
    if (!matched) {
      return c.json({ error: { code: 'INVALID_QUERY', message: `Invalid rarity. Valid options: ${VALID_RARITIES.join(', ')}` } }, 400);
    }
    rarity = matched;
  }

  // 5. Validate & Parse Search Q
  let q: string | null = null;
  if (query.q !== undefined && query.q !== null) {
    const trimmed = query.q.trim();
    if (trimmed.length > 0) {
      if (trimmed.length < 2 || trimmed.length > 40) {
        return c.json({ error: { code: 'INVALID_QUERY', message: 'Search query must be between 2 and 40 characters.' } }, 400);
      }
      q = trimmed;
    }
  }

  // 6. Validate & Parse Keyset Cursor
  let cursorPayload: GalleryCursorPayload | null = null;
  if (query.cursor) {
    cursorPayload = decodeCursor(query.cursor);
    if (!cursorPayload) {
      return c.json({ error: { code: 'INVALID_CURSOR', message: 'Malformed or invalid pagination cursor.' } }, 400);
    }

    // Verify cursor query fingerprint match
    const expectedFingerprint = await computeQueryFingerprint(sort, element, rarity, q);
    if (cursorPayload.fingerprint !== expectedFingerprint) {
      return c.json({ error: { code: 'CURSOR_QUERY_MISMATCH', message: 'Cursor does not match the active filter criteria.' } }, 400);
    }
  }

  const now = Date.now();
  const isSearchQuery = Boolean(q);

  // 7. KV Cache Layer (Browse queries use KV SWR; free-text searches bypass KV)
  if (!isSearchQuery && c.env.CACHE_KV) {
    const cacheKey = await computeCacheKey(sort, limit, element, rarity, query.cursor || null);
    
    try {
      const cached = await c.env.CACHE_KV.get<{
        response: GalleryResponse;
        cached_at: number;
      }>(cacheKey, 'json');

      if (cached && cached.response && typeof cached.cached_at === 'number') {
        const age = now - cached.cached_at;

        if (age < SOFT_FRESH_MS) {
          // Fresh Cache Hit
          c.header('X-Gallery-Cache', 'HIT');
          c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=90');
          return c.json(cached.response);
        }

        if (age < MAX_STALE_MS) {
          // Stale Cache Hit with Single-Flight Background Refresh
          c.header('X-Gallery-Cache', 'STALE');
          c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=90');
          try {
            if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
              const lockKey = `lock:${cacheKey}`;
              c.executionCtx.waitUntil(
                (async () => {
                  try {
                    // Attempt short lock to prevent concurrent refresh stampedes
                    const isLocked = await c.env.CACHE_KV.get(lockKey);
                    if (isLocked) return;

                    await c.env.CACHE_KV.put(lockKey, '1', { expirationTtl: LOCK_TTL_SECONDS });

                    const refreshed = await executeGalleryQuery(
                      c.env.DB,
                      cdnDomain,
                      sort,
                      limit,
                      element,
                      rarity,
                      q,
                      cursorPayload,
                      now
                    );

                    const refreshedResponse: GalleryResponse = {
                      items: refreshed.items,
                      page: {
                        limit,
                        has_more: refreshed.hasMore,
                        next_cursor: refreshed.nextCursor,
                        snapshot_at: refreshed.snapshotAt
                      },
                      applied: { q, element, rarity, sort }
                    };

                    await c.env.CACHE_KV.put(
                      cacheKey,
                      JSON.stringify({ response: refreshedResponse, cached_at: Date.now() }),
                      { expirationTtl: KV_TTL_SECONDS }
                    );
                  } catch (err) {
                    console.error('[Gallery Cache Refresh Error]', err);
                  }
                })()
              );
            }
          } catch {
            // No ExecutionContext in test environment
          }

          return c.json(cached.response);
        }
      }
    } catch (err) {
      console.warn('[Gallery KV Cache Read Warning]', err);
    }
  }

  // 8. Execute Authoritative D1 Query
  try {
    const queryResult = await executeGalleryQuery(
      c.env.DB,
      cdnDomain,
      sort,
      limit,
      element,
      rarity,
      q,
      cursorPayload,
      now
    );

    const response: GalleryResponse = {
      items: queryResult.items,
      page: {
        limit,
        has_more: queryResult.hasMore,
        next_cursor: queryResult.nextCursor,
        snapshot_at: queryResult.snapshotAt
      },
      applied: { q, element, rarity, sort }
    };

    if (isSearchQuery) {
      c.header('X-Gallery-Cache', 'BYPASS');
    } else {
      c.header('X-Gallery-Cache', 'MISS');
      if (c.env.CACHE_KV) {
        const cacheKey = await computeCacheKey(sort, limit, element, rarity, query.cursor || null);
        try {
          if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
            c.executionCtx.waitUntil(
              c.env.CACHE_KV.put(
                cacheKey,
                JSON.stringify({ response, cached_at: Date.now() }),
                { expirationTtl: KV_TTL_SECONDS }
              ).catch((e) => console.warn('[Gallery KV Cache Put Error]', e))
            );
          } else {
            // Direct background put if no executionCtx (e.g. in tests)
            c.env.CACHE_KV.put(
              cacheKey,
              JSON.stringify({ response, cached_at: Date.now() }),
              { expirationTtl: KV_TTL_SECONDS }
            ).catch((e) => console.warn('[Gallery KV Cache Put Error]', e));
          }
        } catch {
          c.env.CACHE_KV.put(
            cacheKey,
            JSON.stringify({ response, cached_at: Date.now() }),
            { expirationTtl: KV_TTL_SECONDS }
          ).catch((e) => console.warn('[Gallery KV Cache Put Error]', e));
        }
      }
    }

    c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=90');
    return c.json(response);
  } catch (dbErr: unknown) {
    const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error('[Gallery D1 Error]:', errMsg);

    // 9. Degraded Mode Fallback (Serve Stale Cache from KV only for non-search browse queries)
    if (!isSearchQuery && c.env.CACHE_KV) {
      try {
        const cacheKey = await computeCacheKey(sort, limit, element, rarity, query.cursor || null);
        const staleCached = await c.env.CACHE_KV.get<{
          response: GalleryResponse;
          cached_at: number;
        }>(cacheKey, 'json');

        if (staleCached && staleCached.response) {
          c.header('X-Gallery-Data', 'stale-kv');
          c.header('Warning', '110 - "Response is stale"');
          c.header('X-Gallery-Cache', 'DEGRADED');
          return c.json({
            ...staleCached.response,
            meta: {
              degraded: true,
              stale: true,
              cached_at: staleCached.cached_at
            }
          });
        }
      } catch {
        // Ignore secondary KV read error
      }
    }

    // 10. Honest 503 Unavailable
    c.header('Retry-After', '15');
    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        error: {
          code: 'GALLERY_UNAVAILABLE',
          message: 'The gallery is temporarily unavailable. Please retry in a few moments.'
        }
      },
      503
    );
  }
});
