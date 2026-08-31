// ============================================================================
// GitHoot SWR KV GitHub Resolver & Anti-Throttling Engine
// (src/server/services/github/resolver.ts)
// ============================================================================

import type { Env, ResolvedProfile, GitHubUserRaw, GuardianSummary, GitHubRepo, UserActivity } from '../../types';
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

  const moodInfo = guardian.energy_state ? {
    Energetic: { title: '⚡ Energetic & Sparking', desc: 'Vừa lập trình sôi nổi trong 24h qua! Linh thú đang hào hứng cùng bạn.' },
    Active: { title: '✦ Active & Ready', desc: 'Đang khỏe mạnh và chăm chỉ bảo vệ các repositories của bạn.' },
    Resting: { title: '😴 Resting & Cozy', desc: 'Đang ngủ đông êm đềm bên cạnh các dòng code.' },
    Hungry_for_code: { title: '🍖 Hungry for Commits', desc: 'Đã hơn 30 ngày chưa có commit mới. Hãy push 1 commit để đánh thức bé nhé!' }
  }[guardian.energy_state] : null;

  return {
    ...guardian,
    hero_image_url: heroUrl,
    mood_title: guardian.mood_title || moodInfo?.title || '✦ Activity Syncing',
    mood_description: guardian.mood_description || moodInfo?.desc || 'Chưa có hoạt động GitHub gần đây. Hãy push một commit để cập nhật tâm trạng bé nhé!'
  };
}
export async function resolveGitHubProfile(username: string, env: Env): Promise<ResolvedProfile> {
  const cleanUsername = username.trim().toLowerCase();
  const cacheKey = `gh:profile:v2:${cleanUsername}`;

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
  // Fresh cache hit (< 1 hour) with schema v2 validation
  if (cached?.data && Array.isArray(cached.data.activities) && now - cached.timestamp < 3600 * 1000) {
    const data = cached.data;
    return {
      ...data,
      guardian: normalizeGuardianSummary(data.guardian),
      source: 'cache_fresh'
    };
  }

  // Stale cache hit (1 hour to 24 hours): Return stale immediately, enqueue revalidation
  if (cached?.data && Array.isArray(cached.data.activities) && now - cached.timestamp < 86400 * 1000) {
    if (env.AI_QUEUE) {
      env.AI_QUEUE.send({ type: 'REVALIDATE_PROFILE', username: cleanUsername }).catch(() => {});
    }
    const data = cached.data;
    return {
      ...data,
      guardian: normalizeGuardianSummary(data.guardian),
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
          last_synced_at: now
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

        // Active: most recently pushed
        activeRepos = [...mappedRepos].slice(0, 4);
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

    // Check D1 database for existing Guardian
    let guardianRecord = await getGuardianFromDb(rawUser.id, env);
    if (guardianRecord) {
      guardianRecord = {
        ...guardianRecord,
        energy_state: mood ? mood.state : guardianRecord.energy_state,
        mood_title: mood ? mood.title : (guardianRecord.mood_title || '✦ Activity Syncing'),
        mood_description: mood ? mood.description : (guardianRecord.mood_description || 'Chưa có hoạt động GitHub gần đây. Hãy push một commit để cập nhật tâm trạng bé nhé!')
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
      } : undefined
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
        last_synced_at: now
      };
    }
    return generateDegradedProfile(cleanUsername);
  }
}

async function getGuardianFromDb(githubUserId: number, env: Env): Promise<GuardianSummary | null> {
  try {
    const row = await env.DB.prepare('SELECT id, name, species, element, rarity_tier, level, experience, energy_state, hero_image_url, spritesheet_url FROM guardians WHERE github_user_id = ?')
      .bind(githubUserId)
      .first<GuardianSummary>();

    if (!row) return null;

    return normalizeGuardianSummary({
      id: row.id,
      name: row.name,
      species: row.species,
      element: row.element,
      rarity_tier: row.rarity_tier,
      level: row.level || 1,
      experience: row.experience || 0,
      energy_state: row.energy_state || 'Active',
      hero_image_url: row.hero_image_url,
      spritesheet_url: row.spritesheet_url
    });
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
