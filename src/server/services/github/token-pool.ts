// ============================================================================
// GitHoot GitHub Token Pool Manager (src/server/services/github/token-pool.ts)
// ============================================================================

import type { Env } from '../../types';

interface TokenStatus {
  token: string;
  remaining: number;
  resetAt: number;
}

// In-memory token cache per Worker isolate
const tokenStateMap = new Map<string, TokenStatus>();
let roundRobinIndex = 0;

export function parseTokenPool(env: Env): string[] {
  if (!env.GITHUB_TOKENS) return [];
  try {
    const trimmed = env.GITHUB_TOKENS.trim();
    if (trimmed.startsWith('[')) {
      return JSON.parse(trimmed) as string[];
    }
    return trimmed.split(',').map(t => t.trim()).filter(Boolean);
  } catch (err) {
    console.warn('[TokenPool] Failed to parse GITHUB_TOKENS:', err);
    return [];
  }
}

export async function getHealthyGitHubToken(env: Env): Promise<string | null> {
  const tokens = parseTokenPool(env);
  if (tokens.length === 0) {
    return null; // Fallback to unauthenticated / degraded
  }

  const now = Math.floor(Date.now() / 1000);

  // Clean expired cooldowns
  for (let i = 0; i < tokens.length; i++) {
    const idx = (roundRobinIndex + i) % tokens.length;
    const token = tokens[idx];
    const status = tokenStateMap.get(token);

    if (!status || (status.remaining > 20 || status.resetAt <= now)) {
      roundRobinIndex = (idx + 1) % tokens.length;
      return token;
    }
  }

  // All tokens exhausted
  console.warn('[TokenPool] All GitHub tokens in pool are currently throttled!');
  return null;
}

export function recordTokenResponse(token: string, headers: Headers): void {
  const remainingHeader = headers.get('x-ratelimit-remaining');
  const resetHeader = headers.get('x-ratelimit-reset');

  if (remainingHeader && resetHeader) {
    const remaining = parseInt(remainingHeader, 10);
    const resetAt = parseInt(resetHeader, 10);

    tokenStateMap.set(token, {
      token,
      remaining,
      resetAt
    });

    if (remaining < 20) {
      console.warn(`[TokenPool] Token quota low (${remaining} left), cooldown until ${new Date(resetAt * 1000).toISOString()}`);
    }
  }
}
