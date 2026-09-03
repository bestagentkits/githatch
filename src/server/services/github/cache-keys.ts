// ============================================================================
// GitHoot KV Profile Cache Keys & Invalidation Engine (src/server/services/github/cache-keys.ts)
// ============================================================================

export const PROFILE_CACHE_VERSION = 'v4';

export function getProfileCacheKey(username: string): string {
  return `gh:profile:${PROFILE_CACHE_VERSION}:${username.trim().toLowerCase()}`;
}

/**
 * Purges both the current versioned profile key and all legacy key prefixes
 * (v4, v3, v2, and unversioned) to guarantee zero stale cache leakage across upgrades.
 */
export async function deleteProfileCacheKeys(
  kv: KVNamespace | undefined,
  username: string
): Promise<void> {
  if (!kv) return;
  const clean = username.trim().toLowerCase();
  await Promise.allSettled([
    kv.delete(getProfileCacheKey(clean)),
    kv.delete(`gh:profile:v3:${clean}`),
    kv.delete(`gh:profile:v2:${clean}`),
    kv.delete(`gh:profile:${clean}`)
  ]);
}
