// ============================================================================
// GitHoot Admin & Reviewer Cryptographic Authorization Guard (src/server/services/auth/admin-auth.ts)
// ============================================================================

import type { Env } from '../../types';

export interface VerifiedReviewerPrincipal {
  reviewerId: string;
  email: string;
  authMethod: 'cf_access_jwt' | 'admin_secret';
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);

  const maxLen = Math.max(aBytes.byteLength, bBytes.byteLength);
  let diff = aBytes.byteLength ^ bBytes.byteLength;

  for (let i = 0; i < maxLen; i++) {
    const byteA = i < aBytes.byteLength ? aBytes[i] : 0;
    const byteB = i < bBytes.byteLength ? bBytes[i] : 0;
    diff |= (byteA ^ byteB);
  }

  return diff === 0;
}

// In-memory cache, in-flight Promise coalescing, and negative-cache for dynamic JWKS key rotation
const inMemoryJwksCache = new Map<string, { jwks: { keys: Array<JsonWebKey & { kid?: string }> }; expiresAt: number }>();
const inFlightJwksPromises = new Map<string, Promise<{ keys: Array<JsonWebKey & { kid?: string }> }>>();
const negativeKidCache = new Map<string, number>();

/**
 * Fetches and caches Cloudflare Access public certs from the team certs endpoint.
 * Automatically accommodates live public key rotation without redeploying static secrets.
 * Coalesces concurrent in-flight requests into a single network fetch.
 */
export async function fetchTeamJwks(
  teamName: string,
  env?: Env,
  forceRefresh = false
): Promise<{ keys: Array<JsonWebKey & { kid?: string }> }> {
  const now = Date.now();

  if (!forceRefresh) {
    const cached = inMemoryJwksCache.get(teamName);
    if (cached && cached.expiresAt > now) {
      return cached.jwks;
    }

    // Check KV cache if available
    if (env?.CACHE_KV) {
      try {
        const kvCached = await env.CACHE_KV.get(`cf:access:certs:${teamName}`, 'json') as { keys: Array<JsonWebKey & { kid?: string }> } | null;
        if (kvCached && kvCached.keys) {
          inMemoryJwksCache.set(teamName, { jwks: kvCached, expiresAt: now + 3600_000 });
          return kvCached;
        }
      } catch {
        // KV lookup non-fatal
      }
    }
  }

  // Check if a fetch is already in flight for this team -> coalesce!
  const existingInFlight = inFlightJwksPromises.get(teamName);
  if (existingInFlight) {
    return existingInFlight;
  }

  // Start new single-flight network fetch Promise
  const fetchPromise = (async () => {
    try {
      const certsUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
      const res = await fetch(certsUrl, {
        headers: { Accept: 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Cloudflare Access certs from ${certsUrl}: HTTP ${res.status}`);
      }

      const jwks = (await res.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error(`Malformed JWKS payload returned from ${certsUrl}`);
      }

      const jwksData = { keys: jwks.keys };
      inMemoryJwksCache.set(teamName, { jwks: jwksData, expiresAt: Date.now() + 3600_000 });

      if (env?.CACHE_KV) {
        try {
          await env.CACHE_KV.put(`cf:access:certs:${teamName}`, JSON.stringify(jwksData), { expirationTtl: 3600 });
        } catch {
          // KV cache non-fatal
        }
      }

      return jwksData;
    } finally {
      inFlightJwksPromises.delete(teamName);
    }
  })();

  inFlightJwksPromises.set(teamName, fetchPromise);
  return fetchPromise;
}

/**
 * Cryptographically verifies Cloudflare Access RS256 JWT assertion.
 * Enforces valid signature against JWKS, required audience (aud),
 * valid team issuer (iss), non-expired lifetime (exp), and active nbf.
 */
export async function verifyCfAccessJwt(
  jwt: string,
  env: Env
): Promise<{ reviewerId: string; email: string }> {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT structure');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: {
    email?: string;
    sub?: string;
    aud?: string | string[];
    iss?: string;
    exp?: number;
    nbf?: number;
  };

  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    throw new Error('Malformed JWT header or payload encoding');
  }

  // 1. Enforce Algorithm
  if (header.alg !== 'RS256') {
    throw new Error('Unsupported JWT algorithm: only RS256 is accepted');
  }

  if (!header.kid || typeof header.kid !== 'string') {
    throw new Error('JWT missing key id (kid)');
  }

  // 2. Enforce Expiration & Timestamps (Mandatory)
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('JWT has expired or missing exp claim');
  }
  if (payload.nbf && typeof payload.nbf === 'number' && payload.nbf > nowSec) {
    throw new Error('JWT not active yet (nbf claim in future)');
  }

  // 3. Enforce Audience
  const expectedAud = env.CF_ACCESS_AUD;
  if (!expectedAud) {
    throw new Error('Cloudflare Access AUD (CF_ACCESS_AUD) is not configured in server environment');
  }
  const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audList.includes(expectedAud)) {
    throw new Error(`JWT audience mismatch: expected ${expectedAud}`);
  }

  // 4. Enforce Issuer
  const expectedTeam = env.CF_ACCESS_TEAM_NAME;
  if (expectedTeam) {
    const expectedIss = `https://${expectedTeam}.cloudflareaccess.com`;
    if (payload.iss !== expectedIss) {
      throw new Error(`JWT issuer mismatch: expected ${expectedIss}`);
    }
  } else if (!payload.iss || !payload.iss.endsWith('.cloudflareaccess.com')) {
    throw new Error('Invalid Cloudflare Access issuer');
  }

  // 5. Cryptographic Signature Verification against JWKS (Dynamic or Static Override)
  let jwks: { keys?: Array<JsonWebKey & { kid?: string }> };

  if (env.CF_ACCESS_JWKS) {
    jwks = (typeof env.CF_ACCESS_JWKS === 'string' ? JSON.parse(env.CF_ACCESS_JWKS) : env.CF_ACCESS_JWKS) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
  } else if (expectedTeam) {
    jwks = await fetchTeamJwks(expectedTeam, env);
  } else {
    throw new Error('Neither CF_ACCESS_JWKS nor CF_ACCESS_TEAM_NAME is configured for Access JWT verification');
  }

  if (!jwks.keys || !Array.isArray(jwks.keys)) {
    throw new Error('Invalid JWKS structure for verification');
  }
  let matchingKey = jwks.keys.find(k => k.kid === header.kid);
  if (!matchingKey && expectedTeam) {
    const negKey = `${expectedTeam}:${header.kid}`;
    const negExpiresAt = negativeKidCache.get(negKey) || 0;

    if (Date.now() > negExpiresAt) {
      // Perform single-flight force-refresh
      console.log(`[AdminAuth] kid "${header.kid}" not found in initial JWKS cache, force-refreshing from team domain...`);
      try {
        const freshJwks = await fetchTeamJwks(expectedTeam, env, true);
        matchingKey = freshJwks.keys?.find(k => k.kid === header.kid);
        if (!matchingKey) {
          // Negative-cache this unknown kid for 5 seconds to prevent DoS flooding
          negativeKidCache.set(negKey, Date.now() + 5000);
        }
      } catch (refreshErr) {
        console.warn('[AdminAuth] Dynamic JWKS force-refresh failed:', refreshErr);
      }
    }
  }

  if (!matchingKey) {
    throw new Error(`No matching JWK public key found for kid: ${header.kid}`);
  }
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    matchingKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`) as unknown as BufferSource;
  const signatureBytes = base64UrlToBytes(sigB64) as unknown as BufferSource;

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes,
    signedData
  );

  if (!valid) {
    throw new Error('Cryptographic JWT signature verification failed');
  }

  const email = payload.email || payload.sub;
  if (!email) {
    throw new Error('JWT missing email or sub identity claim');
  }

  return {
    reviewerId: payload.sub || email,
    email
  };
}

/**
 * Validates Cloudflare Access JWT assertion or admin bearer token.
 * Derives reviewer identity strictly from verified server-side claims.
 */
export async function verifyReviewerAuthorization(
  headers: Headers,
  env: Env
): Promise<VerifiedReviewerPrincipal> {
  const jwtAssertion = headers.get('Cf-Access-Jwt-Assertion');
  const authHeader = headers.get('Authorization');

  // 1. Check Cloudflare Access JWT Assertion (Cryptographically Verified)
  if (jwtAssertion) {
    try {
      const verified = await verifyCfAccessJwt(jwtAssertion, env);
      return {
        reviewerId: verified.reviewerId,
        email: verified.email,
        authMethod: 'cf_access_jwt'
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid Cloudflare Access JWT';
      throw new Error(`Unauthorized: ${msg}`);
    }
  }

  // 2. Check Dedicated Admin Reviewer Secret (Strictly ADMIN_REVIEW_SECRET only, fail-closed on length < 16)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const adminSecret = env.ADMIN_REVIEW_SECRET;

    if (adminSecret && adminSecret.length >= 16 && constantTimeEqual(token, adminSecret)) {
      return {
        reviewerId: 'admin-service',
        email: 'admin@githoot.internal',
        authMethod: 'admin_secret'
      };
    }
  }
  throw new Error('Unauthorized: Valid Cloudflare Access JWT with verified signature or admin secret required.');
}
