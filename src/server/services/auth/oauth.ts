// ============================================================================
// GitHoot GitHub OAuth & HMAC Security Service (src/server/services/auth/oauth.ts)
// ============================================================================

import type { Env, GitHubUserRaw, UserSession } from '../../types';
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
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || 'default-dev-secret-32-chars-long!'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, payloadBytes as unknown as BufferSource);
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  const b64Payload = bytesToBase64url(payloadBytes);

  return `${b64Payload}.${sigHex}`;
}

export async function verifySignedState(stateStr: string, secret: string): Promise<OAuthStatePayload | null> {
  try {
    const [b64Payload, sigHex] = stateStr.split('.');
    if (!b64Payload || !sigHex) return null;
    const payloadBytes = base64urlToBytes(b64Payload);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret || 'default-dev-secret-32-chars-long!'),
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
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || 'default-dev-secret-32-chars-long!'),
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
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret || 'default-dev-secret-32-chars-long!'),
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
