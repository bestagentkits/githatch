// ============================================================================
// GitHoot SWR KV GitHub Resolver & Anti-Throttling Engine
// (src/server/services/github/resolver.ts)
// ============================================================================

import type { Env, ResolvedProfile, GitHubUserRaw, GuardianSummary } from '../../types';
import { getHealthyGitHubToken, recordTokenResponse } from './token-pool';
import { deriveGuardianDNA } from '../dna/seed';

export class UserNotFoundError extends Error {
  constructor(username: string) {
    super(`GitHub user "${username}" not found.`);
    this.name = 'UserNotFoundError';
  }
}

interface CachedEntry {
  timestamp: number;
  data?: ResolvedProfile;
  notFound?: boolean;
}

export async function resolveGitHubProfile(username: string, env: Env): Promise<ResolvedProfile> {
  const cleanUsername = username.trim().toLowerCase();
  const cacheKey = `gh:profile:${cleanUsername}`;

  // 1. Check Cloudflare KV Cache
  let cached: CachedEntry | null = null;
  try {
    cached = await env.CACHE_KV.get<CachedEntry>(cacheKey, 'json');
  } catch (err) {
    console.warn('[Resolver] KV read error:', err);
  }

  const now = Date.now();

  // Check negative cache hit
  if (cached?.notFound && now - cached.timestamp < 300 * 1000) {
    throw new UserNotFoundError(cleanUsername);
  }

  // Fresh cache hit (< 1 hour)
  if (cached?.data && now - cached.timestamp < 3600 * 1000) {
    return { ...cached.data, source: 'cache_fresh' };
  }

  // Stale cache hit (1 hour to 24 hours): Return stale immediately, enqueue revalidation
  if (cached?.data && now - cached.timestamp < 86400 * 1000) {
    if (env.AI_QUEUE) {
      env.AI_QUEUE.send({ type: 'REVALIDATE_PROFILE', username: cleanUsername }).catch(() => {});
    }
    return { ...cached.data, source: 'cache_stale' };
  }

  // 2. Fetch from GitHub API via Token Pool
  try {
    const token = await getHealthyGitHubToken(env);
    const headers: Record<string, string> = {
      'User-Agent': 'GitHoot-Bot/1.0 (https://githoot.com)',
      'Accept': 'application/vnd.github.v3+json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, { headers });
    
    if (token) {
      recordTokenResponse(token, res.headers);
    }

    if (res.status === 404) {
      try {
        await env.CACHE_KV.put(cacheKey, JSON.stringify({ timestamp: now, notFound: true }), {
          expirationTtl: 300
        });
      } catch {}
      throw new UserNotFoundError(cleanUsername);
    }

    if (res.status === 403 || res.status === 429) {
      console.warn(`[Resolver] GitHub API Rate Limited (${res.status}). Switching to Degraded Mode.`);
      return generateDegradedProfile(cleanUsername);
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`);
    }

    const rawUser = (await res.json()) as GitHubUserRaw;

    // Fetch top languages and stars from user repos
    let topLanguages: string[] = [];
    let totalStars = 0;
    try {
      const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=30&sort=updated`, { headers });
      if (reposRes.ok) {
        const repos = (await reposRes.json()) as Array<{ language: string | null; stargazers_count?: number }>;
        const langCounts: Record<string, number> = {};
        for (const r of repos) {
          if (r.language) {
            langCounts[r.language] = (langCounts[r.language] || 0) + 1;
          }
          if (typeof r.stargazers_count === 'number') {
            totalStars += r.stargazers_count;
          }
        }
        topLanguages = Object.keys(langCounts).sort((a, b) => (langCounts[b] ?? 0) - (langCounts[a] ?? 0)).slice(0, 3);
      }
    } catch {
      // Non-blocking
    }

    // Derive deterministic DNA
    const dna = await deriveGuardianDNA(rawUser.id, rawUser.login, topLanguages);

    // Check D1 database for existing Guardian
    const guardianRecord = await getGuardianFromDb(rawUser.id, env);

    const profile: ResolvedProfile = {
      github_user_id: rawUser.id,
      login: rawUser.login,
      name: rawUser.name,
      bio: rawUser.bio,
      avatar_url: rawUser.avatar_url,
      public_repos: rawUser.public_repos,
      followers: rawUser.followers,
      total_stars: totalStars,
      top_languages: topLanguages,
      dna_seed: dna.dna_seed,
      egg_archetype_id: dna.egg_archetype_id,
      estimated_rarity: dna.rarity_tier,
      claimed: guardianRecord !== null,
      guardian: guardianRecord,
      source: 'github_live',
      last_synced_at: now
    };

    // Save to KV Cache (3 days max)
    try {
      await env.CACHE_KV.put(cacheKey, JSON.stringify({ timestamp: now, data: profile }), {
        expirationTtl: 86400 * 3
      });
    } catch (err) {
      console.warn('[Resolver] KV put error:', err);
    }

    return profile;
  } catch (err: unknown) {
    if (err instanceof UserNotFoundError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Resolver] Error resolving ${username}:`, message);
    return generateDegradedProfile(cleanUsername);
  }
}

async function getGuardianFromDb(githubUserId: number, env: Env): Promise<GuardianSummary | null> {
  try {
    const row = await env.DB.prepare('SELECT id, name, species, element, rarity_tier, level, experience, energy_state, hero_image_url, spritesheet_url FROM guardians WHERE github_user_id = ?')
      .bind(githubUserId)
      .first<GuardianSummary>();

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      species: row.species,
      element: row.element,
      rarity_tier: row.rarity_tier,
      level: row.level,
      experience: row.experience,
      energy_state: row.energy_state,
      hero_image_url: row.hero_image_url,
      spritesheet_url: row.spritesheet_url
    };
  } catch {
    return null;
  }
}

export async function generateDegradedProfile(username: string): Promise<ResolvedProfile> {
  const dna = await deriveGuardianDNA(0, username, []);
  return {
    github_user_id: 0,
    login: username,
    name: username,
    bio: 'Profile rendered in Degraded Mode due to high traffic.',
    avatar_url: `https://github.com/${encodeURIComponent(username)}.png`,
    public_repos: 0,
    followers: 0,
    total_stars: 0,
    top_languages: [],
    dna_seed: dna.dna_seed,
    egg_archetype_id: dna.egg_archetype_id,
    estimated_rarity: dna.rarity_tier,
    claimed: false,
    guardian: null,
    source: 'degraded_seed',
    last_synced_at: Date.now()
  };
}
