// ============================================================================
// GitHoot SWR KV GitHub Resolver & Anti-Throttling Engine
// (src/server/services/github/resolver.ts)
// ============================================================================

import type { Env, ResolvedProfile, GitHubUserRaw, GuardianSummary, TelemetrySnapshot, MetricProvenance, AggregateStats, GitHubRepo, UserActivity } from '../../types';
import { getHealthyGitHubToken, recordTokenResponse } from './token-pool';
import { deriveGuardianDNA } from '../dna/seed';
import { calculateGuardianMood } from '../progression/mood-engine';

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

export function normalizeGuardianSummary(guardian: GuardianSummary | null): GuardianSummary | null {
  if (!guardian) return null;

  let heroUrl = guardian.hero_image_url;
  if (heroUrl && heroUrl.includes('/assets/sample-pets/')) {
    const speciesMap: Record<string, string> = {
      'Ignis Emberfox': 'emberfox',
      'Aether Neon Byte': 'neonbyte',
      'Nox Abyssal Pearl': 'abyssal',
      'Sylvan Verdant Golem': 'verdant',
      'Helios Solar Griffin': 'solargriffin',
      'Astral Void Stalker': 'voidstalker',
      'Ferrum Rust Golem': 'rustgolem',
      'Zenith Celestial Drake': 'celestialdrake'
    };
    const slug = speciesMap[guardian.species] || speciesMap[guardian.name];
    if (slug) {
      heroUrl = `/assets/sample-pets/${slug}.webp`;
    } else {
      heroUrl = heroUrl.replace(/\.jpg$/, '.webp');
    }
  }
  return {
    ...guardian,
    hero_image_url: heroUrl
  };
}
export async function resolveGitHubProfile(username: string, env: Env): Promise<ResolvedProfile> {
  const cleanUsername = username.trim().toLowerCase();
  const cacheKey = `gh:profile:v3:${cleanUsername}`;

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

  // Fresh cache hit (< 1 hour) with schema v3 validation.
  // aggregate_stats is ALWAYS overlaid from D1 (authoritative) so owner withdrawal
  // takes effect immediately, independent of the profile cache window.
  if (cached?.data && Array.isArray(cached.data.activities) && now - cached.timestamp < 3600 * 1000) {
    const data = cached.data;
    return {
      ...data,
      guardian: normalizeGuardianSummary(data.guardian),
      aggregate_stats: await getAggregateStatsFromDb(data.github_user_id, env),
      source: 'cache_fresh'
    };
  }

  // Stale cache hit (1 hour to 24 hours): Return stale immediately, enqueue revalidation.
  if (cached?.data && Array.isArray(cached.data.activities) && now - cached.timestamp < 86400 * 1000) {
    if (env.AI_QUEUE) {
      env.AI_QUEUE.send({ type: 'REVALIDATE_PROFILE', username: cleanUsername }).catch(() => {});
    }
    const data = cached.data;
    return {
      ...data,
      guardian: normalizeGuardianSummary(data.guardian),
      aggregate_stats: await getAggregateStatsFromDb(data.github_user_id, env),
      source: 'cache_stale'
    };
  }
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
      console.warn(`[Resolver] GitHub API Rate Limited (${res.status}). Attempting public profile scrape fallback...`);
      const scraped = await scrapeGitHubPublicProfile(cleanUsername);
      if (scraped && scraped.userId > 0) {
        const dna = await deriveGuardianDNA(scraped.userId, cleanUsername, scraped.topLanguages);
        const guardianRecord = await getGuardianFromDb(scraped.userId, env);
        const aggregateStats = await getAggregateStatsFromDb(scraped.userId, env);
        const profile: ResolvedProfile = {
          github_user_id: scraped.userId,
          login: cleanUsername,
          name: scraped.name,
          bio: scraped.bio,
          avatar_url: scraped.avatarUrl,
          public_repos: scraped.publicRepos,
          followers: scraped.followers,
          total_stars: 0,
          top_languages: scraped.topLanguages,
          dna_seed: dna.dna_seed,
          egg_archetype_id: dna.egg_archetype_id,
          estimated_rarity: dna.rarity_tier,
          claimed: guardianRecord !== null,
          guardian: guardianRecord,
          source: 'github_live',
          last_synced_at: now,
          activities: [],
          highlighted_repos: [],
          active_repos: [],
          aggregate_stats: aggregateStats
        };
        try {
          await env.CACHE_KV.put(cacheKey, JSON.stringify({ timestamp: now, data: profile }), {
            expirationTtl: 3600 * 24 // 24 hours for scraped fallback
          });
        } catch {}
        return profile;
      }
      return generateDegradedProfile(cleanUsername);
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`);
    }

    const rawUser = (await res.json()) as GitHubUserRaw;

    // Fetch top languages, stars, highlighted repos & active repos from user repos
    let topLanguages: string[] = [];
    let totalStars = 0;
    let highlightedRepos: GitHubRepo[] = [];
    let activeRepos: GitHubRepo[] = [];
    let latestRepoPushTime = 0;

    try {
      const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=30&sort=updated`, { headers });
      if (reposRes.ok) {
        const repos = (await reposRes.json()) as Array<{
          name: string;
          full_name: string;
          description: string | null;
          html_url: string;
          language: string | null;
          stargazers_count?: number;
          forks_count?: number;
          fork?: boolean;
          private?: boolean;
          pushed_at?: string;
          updated_at?: string;
        }>;
        const langCounts: Record<string, number> = {};
        const mappedRepos: GitHubRepo[] = [];

        for (const r of repos) {
          if (r.language) {
            langCounts[r.language] = (langCounts[r.language] || 0) + 1;
          }
          const stars = typeof r.stargazers_count === 'number' ? r.stargazers_count : 0;
          totalStars += stars;

          const pushTime = r.pushed_at ? new Date(r.pushed_at).getTime() : (r.updated_at ? new Date(r.updated_at).getTime() : 0);
          if (pushTime > latestRepoPushTime) {
            latestRepoPushTime = pushTime;
          }

          mappedRepos.push({
            name: r.name,
            full_name: r.full_name || `${cleanUsername}/${r.name}`,
            description: r.description || null,
            html_url: r.html_url || `https://github.com/${cleanUsername}/${r.name}`,
            stargazers_count: stars,
            forks_count: typeof r.forks_count === 'number' ? r.forks_count : 0,
            language: r.language || null,
            is_private: Boolean(r.private),
            is_fork: Boolean(r.fork),
            updated_at: r.pushed_at || r.updated_at
          });
        }
        topLanguages = Object.keys(langCounts).sort((a, b) => (langCounts[b] ?? 0) - (langCounts[a] ?? 0)).slice(0, 3);
        
        // Highlighted: top starred repos (non-fork preferred)
        highlightedRepos = [...mappedRepos]
          .sort((a, b) => {
            if (a.is_fork !== b.is_fork) return a.is_fork ? 1 : -1;
            return b.stargazers_count - a.stargazers_count;
          })
          .slice(0, 4);

        // Active: most recently pushed / updated
        activeRepos = [...mappedRepos]
          .sort((a, b) => {
            const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return timeB - timeA;
          })
          .slice(0, 4);
      }
    } catch {
      // Non-blocking
    }

    // Fetch recent public activities
    let activities: UserActivity[] = [];
    let latestEventTime = 0;
    try {
      const eventsRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/events/public?per_page=10`, { headers });
      if (eventsRes.ok) {
        const rawEvents = (await eventsRes.json()) as Array<{
          id: string;
          type: string;
          repo?: { name: string; url: string };
          created_at: string;
          payload?: {
            commits?: Array<{ message: string }>;
            action?: string;
            ref_type?: string;
            ref?: string;
            pull_request?: { number?: number; title?: string };
            issue?: { number?: number; title?: string };
          };
        }>;

        for (const ev of rawEvents) {
          const evTime = new Date(ev.created_at).getTime();
          if (evTime > latestEventTime) {
            latestEventTime = evTime;
          }
          const repoName = ev.repo?.name || `${cleanUsername}/repo`;
          let summary = 'Activity in repository';
          
          if (ev.type === 'PushEvent') {
            const count = ev.payload?.commits?.length || 1;
            const msg = ev.payload?.commits?.[0]?.message?.split('\n')[0] || '';
            summary = msg ? `Pushed ${count} commit${count > 1 ? 's' : ''}: "${msg.slice(0, 50)}${msg.length > 50 ? '...' : ''}"` : `Pushed ${count} commit${count > 1 ? 's' : ''}`;
          } else if (ev.type === 'PullRequestEvent') {
            const action = ev.payload?.action || 'updated';
            summary = `${action.charAt(0).toUpperCase() + action.slice(1)} Pull Request #${ev.payload?.pull_request?.number || ''}`;
          } else if (ev.type === 'IssuesEvent') {
            const action = ev.payload?.action || 'updated';
            summary = `${action.charAt(0).toUpperCase() + action.slice(1)} Issue #${ev.payload?.issue?.number || ''}`;
          } else if (ev.type === 'CreateEvent') {
            summary = `Created ${ev.payload?.ref_type || 'branch'} ${ev.payload?.ref || ''}`.trim();
          } else if (ev.type === 'WatchEvent') {
            summary = 'Starred repository';
          } else if (ev.type === 'ForkEvent') {
            summary = 'Forked repository';
          } else if (ev.type === 'ReleaseEvent') {
            summary = 'Published a release';
          }

          activities.push({
            id: ev.id,
            type: ev.type,
            repo: repoName,
            repo_url: `https://github.com/${repoName}`,
            summary,
            created_at: ev.created_at
          });
        }
      }
    } catch {
      // Non-blocking
    }

    // Calculate Guardian Mood based on real coding activity timestamps (no synthetic timestamps)
    const lastActiveTimestamp = Math.max(latestEventTime, latestRepoPushTime);
    const mood = lastActiveTimestamp > 0 ? calculateGuardianMood(lastActiveTimestamp) : undefined;

    // Derive deterministic DNA
    const dna = await deriveGuardianDNA(rawUser.id, rawUser.login, topLanguages);

    // Check D1 database for existing Guardian and owner-consented aggregate stats
    let guardianRecord = await getGuardianFromDb(rawUser.id, env);
    const aggregateStats = await getAggregateStatsFromDb(rawUser.id, env);
    if (guardianRecord) {
      guardianRecord = {
        ...guardianRecord,
        energy_state: mood ? mood.state : guardianRecord.energy_state,
        mood_title: mood ? mood.title : undefined,
        mood_description: mood ? mood.description : undefined
      };
    }

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
      last_synced_at: now,
      activities,
      highlighted_repos: highlightedRepos,
      active_repos: activeRepos,
      mood: mood ? {
        state: mood.state,
        title: mood.title,
        description: mood.description,
        badgeColor: mood.badgeColor,
        recommendedPose: mood.recommendedPose
      } : undefined,
      aggregate_stats: aggregateStats
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
    // Try scraping fallback on network/API failure
    const scraped = await scrapeGitHubPublicProfile(cleanUsername);
    if (scraped && scraped.userId > 0) {
      const dna = await deriveGuardianDNA(scraped.userId, cleanUsername, scraped.topLanguages);
      const guardianRecord = await getGuardianFromDb(scraped.userId, env);
      const aggregateStats = await getAggregateStatsFromDb(scraped.userId, env);
      return {
        github_user_id: scraped.userId,
        login: cleanUsername,
        name: scraped.name,
        bio: scraped.bio,
        avatar_url: scraped.avatarUrl,
        public_repos: scraped.publicRepos,
        followers: scraped.followers,
        total_stars: 0,
        top_languages: scraped.topLanguages,
        dna_seed: dna.dna_seed,
        egg_archetype_id: dna.egg_archetype_id,
        estimated_rarity: dna.rarity_tier,
        claimed: guardianRecord !== null,
        guardian: guardianRecord,
        source: 'github_live',
        last_synced_at: now,
        activities: [],
        highlighted_repos: [],
        active_repos: [],
        aggregate_stats: aggregateStats
      };
    }
    return generateDegradedProfile(cleanUsername);
  }
}

interface GuardianJoinPublicationRow {
  id: string;
  name: string;
  species: string;
  species_name: string | null;
  anatomy: string | null;
  element: string;
  rarity_tier: string;
  projected_status: string | null;
  level: number;
  experience: number;
  energy_state: string;
  hero_image_url: string | null;
  manifest_key: string | null;
  spritesheet_key: string | null;
  publication_state: string | null;
  published_at: number | null;
}

async function getGuardianFromDb(githubUserId: number, env: Env): Promise<GuardianSummary | null> {
  try {
    const row = await env.DB.prepare(`
      SELECT 
        g.id, g.name, g.species, g.species_name, g.anatomy, g.element, g.rarity_tier,
        g.level, g.experience, g.energy_state, g.hero_image_url,
        g.status as projected_status,
        p.manifest_key, p.spritesheet_key, p.state as publication_state, p.published_at
      FROM guardians g
      LEFT JOIN guardian_publication p ON g.id = p.guardian_id AND p.state = 'ASSET_READY'
      WHERE g.github_user_id = ?1;
    `).bind(githubUserId).first<GuardianJoinPublicationRow>();

    if (!row) return null;

    const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';
    const isPublished = row.publication_state === 'ASSET_READY' && Boolean(row.manifest_key);

    return {
      id: row.id,
      name: row.name,
      species: row.species,
      species_name: row.species_name || row.name,
      anatomy: row.anatomy || undefined,
      element: row.element as any,
      rarity_tier: row.rarity_tier as any,
      status: (isPublished ? 'ASSET_READY' : (row.projected_status === 'ASSET_READY' ? 'VERIFYING' : (row.projected_status || 'PENDING'))) as GuardianSummary['status'],
      level: row.level,
      experience: row.experience,
      energy_state: row.energy_state as any,
      hero_image_url: isPublished ? (row.hero_image_url || `/assets/sample-pets/${row.species}.jpg`) : null,
      spritesheet_url: isPublished && row.spritesheet_key ? `https://${cdnHost}/${row.spritesheet_key}` : null,
      manifest_url: isPublished && row.manifest_key ? `https://${cdnHost}/${row.manifest_key}` : null
    };
  } catch {
    return null;
  }
}

export async function getAggregateStatsFromDb(githubUserId: number, env: Env): Promise<AggregateStats | null> {
  if (!githubUserId || !env.DB) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT contributions_last_year, owned_repositories_total, period_started_at, period_ended_at, refreshed_at FROM github_aggregate_stats WHERE github_user_id = ?'
    ).bind(githubUserId).first<{
      contributions_last_year: number;
      owned_repositories_total: number;
      period_started_at: number;
      period_ended_at: number;
      refreshed_at: number;
    }>();

    if (!row) return null;

    return {
      contributions_last_year: row.contributions_last_year,
      owned_repositories_total: row.owned_repositories_total,
      period_started_at: new Date(row.period_started_at).toISOString(),
      period_ended_at: new Date(row.period_ended_at).toISOString(),
      refreshed_at: new Date(row.refreshed_at).toISOString()
    };
  } catch (err) {
    console.error('[Resolver] getGuardianFromDb query failed:', err);
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
    last_synced_at: Date.now(),
    activities: [],
    highlighted_repos: [],
    active_repos: []
  };
}

function getISOWeekKey(dt: Date): string {
  const d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function createAllUnavailableSnapshot(rawUser: Partial<GitHubUserRaw> = {}): TelemetrySnapshot {
  const now = Date.now();
  const createdDate = new Date(rawUser.created_at || now);
  const accountAgeYears = Math.max(0, Math.floor((now - createdDate.getTime()) / (365.25 * 86400000)));

  return {
    topLanguages: [],
    stars: 0,
    forks: 0,
    publicRepos: rawUser.public_repos || 0,
    followers: rawUser.followers || 0,
    accountAgeYears,
    mergedExternalPRs: 0,
    releases: 0,
    reviewRatio: 0,
    collaborators: 0,
    activeWeeks: 0,
    nightCommitRatio: 0,
    provenance: {
      topLanguages: 'unavailable',
      stars: 'unavailable',
      forks: 'unavailable',
      publicRepos: rawUser.public_repos !== undefined ? 'measured' : 'unavailable',
      followers: rawUser.followers !== undefined ? 'measured' : 'unavailable',
      accountAgeYears: rawUser.created_at ? 'measured' : 'unavailable',
      mergedExternalPRs: 'unavailable',
      releases: 'unavailable',
      reviewRatio: 'unavailable',
      collaborators: 'unavailable',
      activeWeeks: 'unavailable',
      nightCommitRatio: 'unavailable'
    }
  };
}

export async function fetchTelemetrySnapshot(
  rawUser: GitHubUserRaw,
  env: Env,
  headers?: Record<string, string>
): Promise<TelemetrySnapshot> {
  const now = Date.now();
  const createdDate = new Date(rawUser.created_at || now);
  const accountAgeYears = Math.max(0, Math.floor((now - createdDate.getTime()) / (365.25 * 86400000)));

  let topLanguages: string[] = [];
  let stars = 0;
  let forks = 0;
  let reposMeasured = false;
  let eventsMeasured = false;
  let prsMeasured = false;
  let reviewsMeasured = false;
  let activeWeeks = 0;
  let nightCommitRatio = 0;
  let mergedExternalPRs = 0;
  let reviewRatio = 0;

  const reqHeaders: Record<string, string> = {
    'User-Agent': 'GitHoot-Bot/1.0 (https://githoot.com)',
    'Accept': 'application/vnd.github.v3+json',
    ...(headers || {})
  };

  if (!reqHeaders.Authorization) {
    const token = await getHealthyGitHubToken(env);
    if (token) {
      reqHeaders.Authorization = `Bearer ${token}`;
    }
  }

  // 1. Measure Repos, Languages, Stars, Forks (with pagination for accounts > 100 repos)
  try {
    const totalExpectedRepos = typeof rawUser.public_repos === 'number' ? rawUser.public_repos : 0;
    const maxPages = Math.min(10, Math.ceil(Math.max(1, totalExpectedRepos) / 100));
    let allRepos: Array<{ language: string | null; stargazers_count?: number; forks_count?: number }> = [];
    let paginationCompleted = true;

    for (let page = 1; page <= maxPages; page++) {
      const reposRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(rawUser.login)}/repos?per_page=100&page=${page}&sort=updated`,
        { headers: reqHeaders }
      );
      if (reposRes.status === 403 || reposRes.status === 429) {
        paginationCompleted = false;
        break;
      }
      if (!reposRes.ok) {
        paginationCompleted = false;
        break;
      }
      const pageRepos = (await reposRes.json()) as Array<{ language: string | null; stargazers_count?: number; forks_count?: number }>;
      if (!Array.isArray(pageRepos)) {
        paginationCompleted = false;
        break;
      }
      allRepos = allRepos.concat(pageRepos);
      if (pageRepos.length < 100) {
        // Last page reached
        break;
      }
    }

    // Completeness invariant: if public_repos > 1000, we capped at 1000 repos, so completeness is NOT established
    // Only mark measured if we retrieved ALL expected repos
    const isComplete = paginationCompleted && (
      totalExpectedRepos === 0 ||
      allRepos.length === totalExpectedRepos ||
      (allRepos.length < 100 && totalExpectedRepos <= allRepos.length)
    ) && totalExpectedRepos <= 1000;

    if (isComplete) {
      const langCounts: Record<string, number> = {};
      for (const r of allRepos) {
        if (r.language) {
          const l = r.language.toLowerCase();
          langCounts[l] = (langCounts[l] || 0) + 1;
        }
        if (typeof r.stargazers_count === 'number') {
          stars += r.stargazers_count;
        }
        if (typeof r.forks_count === 'number') {
          forks += r.forks_count;
        }
      }
      topLanguages = Object.keys(langCounts).sort((a, b) => (langCounts[b] ?? 0) - (langCounts[a] ?? 0)).slice(0, 3);
      reposMeasured = true;
    } else {
      // Incomplete or truncated (>1000): fail closed to unavailable to avoid publishing partial numbers as measured
      reposMeasured = false;
    }
  } catch (err) {
    console.warn('[Resolver] Failed to fetch repos for telemetry:', err);
    reposMeasured = false;
  }

  // 2. Measure Events for Active Weeks and Chronotype (Night Commit Ratio, paginating up to 300 events)
  try {
    let allEvents: Array<{ created_at: string; type: string }> = [];
    let eventsComplete = true;

    for (let page = 1; page <= 3; page++) {
      const eventsRes = await fetch(
        `https://api.github.com/users/${encodeURIComponent(rawUser.login)}/events/public?per_page=100&page=${page}`,
        { headers: reqHeaders }
      );
      if (eventsRes.status === 403 || eventsRes.status === 429 || !eventsRes.ok) {
        eventsComplete = false;
        break;
      }
      const pageEvents = (await eventsRes.json()) as Array<{ created_at: string; type: string }>;
      if (!Array.isArray(pageEvents)) {
        eventsComplete = false;
        break;
      }
      allEvents = allEvents.concat(pageEvents);
      if (pageEvents.length < 100) {
        // Terminal page reached: recent window is completely retrieved
        break;
      }
      if (page === 3 && pageEvents.length === 100) {
        // Truncated at 300 events without terminal page: completeness not established, fail closed to unavailable
        eventsComplete = false;
        break;
      }
    }

    if (eventsComplete) {
      const weeks = new Set<string>();
      let nightCount = 0;
      let pushCount = 0;
      for (const ev of allEvents) {
        if (ev.created_at) {
          const dt = new Date(ev.created_at);
          weeks.add(getISOWeekKey(dt));

          if (ev.type === 'PushEvent') {
            pushCount++;
            const hour = dt.getUTCHours();
            // Night commits: between 22:00 and 06:00 UTC
            if (hour >= 22 || hour <= 6) {
              nightCount++;
            }
          }
        }
      }
      activeWeeks = weeks.size;
      nightCommitRatio = pushCount > 0 ? Math.round((nightCount / pushCount) * 100) / 100 : 0;
      eventsMeasured = true;
    } else {
      eventsMeasured = false;
    }
  } catch (err) {
    console.warn('[Resolver] Failed to fetch public events for telemetry:', err);
    eventsMeasured = false;
  }

  // 3. Measure Merged External PRs via Search API
  try {
    const prQuery = `author:${rawUser.login} type:pr is:merged -user:${rawUser.login}`;
    const prRes = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(prQuery)}`, { headers: reqHeaders });
    if (prRes.ok) {
      const prData = (await prRes.json()) as { total_count?: number };
      if (typeof prData.total_count === 'number') {
        mergedExternalPRs = prData.total_count;
        prsMeasured = true;
      }
    }
  } catch (err) {
    console.warn('[Resolver] Failed to fetch merged PRs for telemetry:', err);
  }

  // 4. Measure Code Reviews via Search API
  try {
    const reviewQuery = `reviewed-by:${rawUser.login} type:pr`;
    const reviewRes = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(reviewQuery)}`, { headers: reqHeaders });
    if (reviewRes.ok) {
      const reviewData = (await reviewRes.json()) as { total_count?: number };
      if (typeof reviewData.total_count === 'number') {
        const totalReviews = reviewData.total_count;
        reviewRatio = Math.min(1, Math.round((totalReviews / Math.max(1, rawUser.public_repos || 10)) * 100) / 100);
        reviewsMeasured = true;
      }
    }
  } catch (err) {
    console.warn('[Resolver] Failed to fetch reviews for telemetry:', err);
  }

  const provenance: Record<
    | 'topLanguages'
    | 'stars'
    | 'forks'
    | 'publicRepos'
    | 'followers'
    | 'accountAgeYears'
    | 'mergedExternalPRs'
    | 'releases'
    | 'reviewRatio'
    | 'collaborators'
    | 'activeWeeks'
    | 'nightCommitRatio',
    MetricProvenance
  > = {
    topLanguages: reposMeasured ? 'measured' : 'unavailable',
    stars: reposMeasured ? 'measured' : 'unavailable',
    forks: reposMeasured ? 'measured' : 'unavailable',
    publicRepos: rawUser.public_repos !== undefined ? 'measured' : 'unavailable',
    followers: rawUser.followers !== undefined ? 'measured' : 'unavailable',
    accountAgeYears: rawUser.created_at ? 'measured' : 'unavailable',
    mergedExternalPRs: prsMeasured ? 'measured' : 'unavailable',
    releases: 'unavailable',
    reviewRatio: reviewsMeasured ? 'measured' : 'unavailable',
    collaborators: 'unavailable',
    activeWeeks: eventsMeasured ? 'measured' : 'unavailable',
    nightCommitRatio: eventsMeasured ? 'measured' : 'unavailable'
  };

  return {
    topLanguages,
    stars,
    forks,
    publicRepos: rawUser.public_repos || 0,
    followers: rawUser.followers || 0,
    accountAgeYears,
    mergedExternalPRs,
    releases: 0,
    reviewRatio,
    collaborators: 0,
    activeWeeks,
    nightCommitRatio,
    provenance
  };
}
export async function scrapeGitHubPublicProfile(username: string): Promise<{
  userId: number;
  name: string;
  bio: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  topLanguages: string[];
} | null> {
  try {
    const res = await fetch(`https://github.com/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (res.status === 404) {
      throw new UserNotFoundError(username);
    }
    if (!res.ok) return null;
    const html = await res.text();

    const userIdMatch = html.match(/&quot;profile_user_id&quot;:(\d+)/) || html.match(/data-scope-id="(\d+)"/);
    const userId = userIdMatch ? parseInt(userIdMatch[1], 10) : 0;

    const nameMatch = html.match(/class="p-name vcard-fullname[^"]*"[^>]*itemprop="name">\s*([^<]+)\s*<\/span>/s) 
      || html.match(/itemprop="name">\s*([^<]+)\s*<\/span>/);
    const name = nameMatch ? nameMatch[1].trim() : username;

    const bioMatch = html.match(/<div class="p-note user-profile-bio[^"]*"[^>]*><div>\s*([\s\S]*?)\s*<\/div><\/div>/)
      || html.match(/<meta property="og:description" content="([^"]+)"/);
    let bio = bioMatch ? bioMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    bio = bio.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
      || html.match(/class="avatar user-profile-avatar[^"]*"[^>]*src="([^"]+)"/);
    const avatarUrl = avatarMatch ? avatarMatch[1] : `https://github.com/${username}.png`;

    const reposMatch = html.match(/tab=repositories.*?<span[^>]*class="Counter[^"]*"[^>]*>\s*([0-9kKmM,.]+)\s*<\/span>/is)
      || html.match(/Repositories\s*<span[^>]*class="Counter[^"]*"[^>]*>\s*([0-9kKmM,.]+)\s*<\/span>/is);
    let publicRepos = 0;
    if (reposMatch) {
      const raw = reposMatch[1].replace(/,/g, '').trim();
      if (raw.toLowerCase().endsWith('k')) publicRepos = Math.round(parseFloat(raw) * 1000);
      else publicRepos = parseInt(raw, 10) || 0;
    }

    const followersMatch = html.match(/followers">.*?<span[^>]*class="text-bold[^"]*"[^>]*>\s*([0-9kKmM,.]+)\s*<\/span>/is)
      || html.match(/href="[^"]*tab=followers"[^>]*>.*?<span[^>]*class="[^"]*Counter[^"]*"[^>]*>\s*([0-9kKmM,.]+)\s*<\/span>/is);
    let followers = 0;
    if (followersMatch) {
      const raw = followersMatch[1].replace(/,/g, '').trim();
      if (raw.toLowerCase().endsWith('k')) followers = Math.round(parseFloat(raw) * 1000);
      else followers = parseInt(raw, 10) || 0;
    }

    const langMatches = [...html.matchAll(/itemprop="programmingLanguage">([^<]+)<\/span>/g)].map(m => m[1]);
    const langCounts: Record<string, number> = {};
    for (const l of langMatches) {
      langCounts[l] = (langCounts[l] || 0) + 1;
    }
    const topLanguages = Object.keys(langCounts).sort((a, b) => (langCounts[b] ?? 0) - (langCounts[a] ?? 0)).slice(0, 3);

    return {
      userId,
      name,
      bio,
      avatarUrl,
      publicRepos,
      followers,
      topLanguages
    };
  } catch (err) {
    if (err instanceof UserNotFoundError) throw err;
    return null;
  }
}
