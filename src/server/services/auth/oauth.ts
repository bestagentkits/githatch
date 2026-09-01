// ============================================================================
// GitHoot GitHub OAuth & HMAC Security Service (src/server/services/auth/oauth.ts)
// ============================================================================

import type { Env, GitHubUserRaw, UserSession, AggregateStats } from '../../types';
export interface OAuthStatePayload {
  claim_username?: string;
  intent: 'login' | 'claim';
  timestamp: number;
  nonce: string;
}
function bytesToBase64url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64');
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}


export async function generateSignedState(claimUsername: string, secret: string, intent: 'login' | 'claim' = 'claim'): Promise<string> {
  const payload: OAuthStatePayload = {
    claim_username: claimUsername ? claimUsername.toLowerCase() : undefined,
    intent,
    timestamp: Date.now(),
    nonce: crypto.randomUUID()
  };
  const payloadStr = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadStr);
  if (!secret) throw new Error('secret is required for state generation');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, payloadBytes as unknown as BufferSource);
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  const b64Payload = bytesToBase64url(payloadBytes);

  return `${b64Payload}.${sigHex}`;
}
export async function generateOAuthLoginUrl(claimUsername: string, env: Env, secret: string): Promise<string> {
  const clientId = env.GITHUB_CLIENT_ID || 'dummy-client-id';
  const state = await generateSignedState(claimUsername, secret);
  return `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=read:user&state=${encodeURIComponent(state)}`;
}


export async function verifySignedState(stateStr: string, secret: string): Promise<OAuthStatePayload | null> {
  try {
    const [b64Payload, sigHex] = stateStr.split('.');
    if (!b64Payload || !sigHex) return null;
    const payloadBytes = base64urlToBytes(b64Payload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    if (!secret) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, payloadBytes as unknown as BufferSource);
    if (!isValid) return null;

    const payload = JSON.parse(payloadStr) as OAuthStatePayload;
    // Check expiry (10 minutes)
    if (Date.now() - payload.timestamp > 10 * 60 * 1000) {
      console.warn('[OAuth] State token expired');
      return null;
    }

    return payload;
  } catch (err) {
    console.warn('[OAuth] State verification failed:', err);
    return null;
  }
}

export interface SessionPayload {
  user: UserSession;
  timestamp: number;
}

export async function createSessionToken(user: UserSession, secret: string): Promise<string> {
  const payload: SessionPayload = {
    user,
    timestamp: Date.now()
  };
  const payloadStr = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadStr);
  if (!secret) throw new Error('secret is required for session token creation');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, payloadBytes as unknown as BufferSource);
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  const b64Payload = bytesToBase64url(payloadBytes);

  return `${b64Payload}.${sigHex}`;
}

export async function verifySessionToken(tokenStr: string, secret: string): Promise<UserSession | null> {
  try {
    const [b64Payload, sigHex] = tokenStr.split('.');
    if (!b64Payload || !sigHex) return null;

    const payloadBytes = base64urlToBytes(b64Payload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    if (!secret) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, payloadBytes as unknown as BufferSource);
    if (!isValid) return null;

    const payload = JSON.parse(payloadStr) as SessionPayload;
    if (Date.now() - payload.timestamp > 30 * 24 * 3600 * 1000) {
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

export async function exchangeCodeForAccessToken(code: string, env: Env): Promise<string> {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing in environment.');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code
    })
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) {
    throw new Error(`GitHub OAuth error: ${data.error || 'No access token returned'}`);
  }

  return data.access_token;
}

export async function fetchAuthenticatedUser(accessToken: string): Promise<GitHubUserRaw> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'GitHoot-Auth/1.0',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user from GitHub: HTTP ${res.status}`);
  }

  return (await res.json()) as GitHubUserRaw;
}

/**
 * Fetches PRIVATE-INCLUSIVE aggregate COUNTS only via a single GitHub GraphQL query
 * bound to `viewer`. Returns sanitized scalar totals — never repo names, URLs, or
 * per-event detail. Returns null on any error, partial response, identity mismatch,
 * or negative value so callers preserve the previous good snapshot (never write zeros).
 */
export async function fetchAggregateStats(accessToken: string, expectedUserId: number): Promise<AggregateStats | null> {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 3600 * 1000);
  const query = `query($from: DateTime!, $to: DateTime!) {
    viewer {
      databaseId
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { totalContributions }
      }
      repositories(first: 1, ownerAffiliations: [OWNER]) { totalCount }
    }
  }`;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'GitHoot-Auth/1.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { from: from.toISOString(), to: to.toISOString() } })
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        viewer?: {
          databaseId?: number;
          contributionsCollection?: { contributionCalendar?: { totalContributions?: number } };
          repositories?: { totalCount?: number };
        };
      };
      errors?: unknown;
    };

    if (json.errors || !json.data?.viewer) return null;
    const viewer = json.data.viewer;

    // Bind strictly to the authenticated identity; never trust browser-supplied usernames.
    if (viewer.databaseId !== expectedUserId) return null;

    const contributions = viewer.contributionsCollection?.contributionCalendar?.totalContributions;
    const ownedRepos = viewer.repositories?.totalCount;

    if (typeof contributions !== 'number' || typeof ownedRepos !== 'number') return null;
    if (!Number.isInteger(contributions) || !Number.isInteger(ownedRepos)) return null;
    if (contributions < 0 || ownedRepos < 0) return null;

    return {
      contributions_last_year: contributions,
      owned_repositories_total: ownedRepos,
      period_started_at: from.toISOString(),
      period_ended_at: to.toISOString(),
      refreshed_at: to.toISOString()
    };
  } catch {
    return null;
  }
}

/**
 * Revokes a SINGLE OAuth access token via GitHub's `DELETE /applications/{client_id}/token`
 * (never deletes the whole app grant). GitHub returns 204 on success. Transient failures
 * (network, 429, 5xx) are retried with bounded backoff. On final failure a token-free,
 * actionable warning is logged; the caller still discards the local token regardless.
 * Returns true only when GitHub confirmed revocation with 204.
 */
export async function revokeAccessToken(accessToken: string, env: Env): Promise<boolean> {
  const clientId = (env.GITHUB_CLIENT_ID || '').replace(/^["']|["']$/g, '').trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET || '').replace(/^["']|["']$/g, '').trim();
  if (!clientId || !clientSecret) {
    console.warn('[OAuth] Token revocation skipped: client credentials missing.');
    return false;
  }

  const basic = btoa(`${clientId}:${clientSecret}`);
  const url = `https://api.github.com/applications/${encodeURIComponent(clientId)}/token`;
  const maxAttempts = 3;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${basic}`,
          'User-Agent': 'GitHoot-Auth/1.0',
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ access_token: accessToken })
      });
      lastStatus = res.status;

      // GitHub documents 204 No Content on successful revocation.
      if (res.status === 204) return true;

      // Non-transient failures (401/404/422) will not succeed on retry.
      if (res.status !== 429 && res.status < 500) {
        console.warn(`[OAuth] Token revocation failed with non-transient HTTP ${res.status}; discarding token locally.`);
        return false;
      }
    } catch {
      lastStatus = 0; // network error → transient
    }

    if (attempt < maxAttempts) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, 200 * attempt);
      await promise;
    }
  }

  console.warn(`[OAuth] Token revocation failed after ${maxAttempts} attempts (last status ${lastStatus}); token discarded locally but may remain valid at GitHub until expiry.`);
  return false;
}
