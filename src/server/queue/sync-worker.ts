// ============================================================================
// GitHoot SWR Activity Sync Worker (src/server/queue/sync-worker.ts)
// ============================================================================

import type { Env } from '../types';
import { getHealthyGitHubToken } from '../services/github/token-pool';
import { calculateGuardianMood } from '../services/progression/mood-engine';

export async function processProfileRevalidation(username: string, env: Env): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  console.log(`[SyncWorker] Background SWR sync for @${cleanUsername}`);

  try {
    const token = await getHealthyGitHubToken(env);
    const headers: Record<string, string> = {
      'User-Agent': 'GitHoot-Sync/1.0',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/events?per_page=5`, { headers });
    let lastActivityTime = Date.now() - 3600 * 1000 * 48; // Default 2 days ago

    if (res.ok) {
      const events = (await res.json()) as Array<{ created_at?: string }>;
      if (events.length > 0 && events[0]?.created_at) {
        lastActivityTime = new Date(events[0].created_at).getTime();
      }
    }

    const mood = calculateGuardianMood(lastActivityTime);

    // Update D1 database
    await env.DB.prepare(`
      UPDATE guardians 
      SET energy_state = ?1 
      WHERE github_user_id = (SELECT github_user_id FROM github_accounts WHERE login = ?2 COLLATE NOCASE)
    `).bind(mood.state, cleanUsername).run();

    console.log(`[SyncWorker] Updated mood for @${cleanUsername} to ${mood.state}`);
  } catch (err) {
    console.warn(`[SyncWorker] SWR sync failed for @${cleanUsername}:`, err);
  }
}
