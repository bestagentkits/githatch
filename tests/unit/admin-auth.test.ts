// ============================================================================
// Admin & Reviewer Cryptographic Auth Integration Tests (tests/unit/admin-auth.test.ts)
// ============================================================================

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import serverApp from '../../src/server/index';
import { constantTimeEqual } from '../../src/server/services/auth/admin-auth';
import type { Env } from '../../src/server/types';
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stringToBase64Url(str: string): string {
  return bytesToBase64Url(new TextEncoder().encode(str));
}

let testKeyPair: CryptoKeyPair;
let testJwk: JsonWebKey & { kid: string };

beforeAll(async () => {
  testKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  const exportedPublicJwk = await crypto.subtle.exportKey('jwk', testKeyPair.publicKey);
  testJwk = {
    ...exportedPublicJwk,
    kid: 'test-key-1'
  };
});

async function signTestJwt(
  payloadObj: Record<string, unknown>,
  privateKey: CryptoKey,
  kid = 'test-key-1',
  tamperSignature = false
): Promise<string> {
  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const headerB64 = stringToBase64Url(JSON.stringify(header));
  const payloadB64 = stringToBase64Url(JSON.stringify(payloadObj));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    dataToSign
  );

  const sigBytes = new Uint8Array(signature);
  if (tamperSignature) {
    sigBytes[0] ^= 0xff; // Corrupt signature bytes
  }

  const sigB64 = bytesToBase64Url(sigBytes);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

function createAdminMockEnv(): Env {
  return {
    DB: {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockImplementation(() => ({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true })
        }))
      })),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
      exec: vi.fn().mockResolvedValue({ success: true })
    } as unknown as D1Database,
    ASSETS_BUCKET: {
      get: vi.fn().mockResolvedValue({
        arrayBuffer: async () => new TextEncoder().encode('{"v":1,"manifestSha":"sha123"}')
      }),
      head: vi.fn().mockResolvedValue({ key: 'test', size: 100 }),
      put: vi.fn().mockResolvedValue(null)
    } as unknown as R2Bucket,
    CACHE_KV: {} as any,
    AI_QUEUE: {} as any,
    CF_ACCESS_AUD: 'aud-test-12345',
    CF_ACCESS_TEAM_NAME: 'githoot-team',
    CF_ACCESS_JWKS: JSON.stringify({ keys: [testJwk] }),
    AUTH_SECRET: 'production-oauth-secret-key-different',
    ADMIN_REVIEW_SECRET: 'production-super-secret-key-at-least-16-bytes',
    ENVIRONMENT: 'test',
    DOMAIN: 'githoot.com',
    CDN_DOMAIN: 'cdn.githoot.com',
    EARLY_ACCESS_TOTAL_SLOTS: '100',
    AI_MODEL_TIER: 'nano-banana-pro-preview'
  };
}

describe('Admin & Reviewer Cryptographic Auth Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated calls with 401 Unauthorized', async () => {
    const env = createAdminMockEnv();
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unauthorized');
  });

  it('rejects forged unsigned JWT (e.g. dummy parts) with 401', async () => {
    const env = createAdminMockEnv();
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': 'header.eyJlbWFpbCI6ImhhY2tlckBhdHRhY2sudmFsIn0.invalidsig'
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
  });

  it('rejects well-formed, unexpired JWT with an invalid/tampered signature with 401', async () => {
    const env = createAdminMockEnv();
    const unexpiredPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-1',
      aud: 'aud-test-12345',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const forgedJwt = await signTestJwt(unexpiredPayload, testKeyPair.privateKey, 'test-key-1', true);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': forgedJwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Cryptographic JWT signature verification failed');
  });

  it('rejects well-formed JWT with audience mismatch with 401', async () => {
    const env = createAdminMockEnv();
    const mismatchedAudPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-1',
      aud: 'wrong-audience-id',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const jwt = await signTestJwt(mismatchedAudPayload, testKeyPair.privateKey, 'test-key-1', false);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': jwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('JWT audience mismatch');
  });

  it('rejects well-formed JWT with expired exp timestamp with 401', async () => {
    const env = createAdminMockEnv();
    const expiredPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-1',
      aud: 'aud-test-12345',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) - 60 // expired 60 seconds ago
    };

    const jwt = await signTestJwt(expiredPayload, testKeyPair.privateKey, 'test-key-1', false);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': jwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('expired');
  });

  it('accepts cryptographically valid signed JWT with matching JWKS', async () => {
    const env = createAdminMockEnv();
    const validPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-1',
      aud: 'aud-test-12345',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const validJwt = await signTestJwt(validPayload, testKeyPair.privateKey, 'test-key-1', false);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': validJwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    // Auth passed and reached D1 query (fails with missing guardian in mock)
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Guardian g-test not found');
  });

  it('dynamically fetches JWKS certs from team endpoint when CF_ACCESS_JWKS is omitted', async () => {
    const env = createAdminMockEnv();
    delete env.CF_ACCESS_JWKS; // force dynamic team certs fetch

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('cdn-cgi/access/certs')) {
        return new Response(JSON.stringify({ keys: [testJwk] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(url);
    });

    const validPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-1',
      aud: 'aud-test-12345',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const validJwt = await signTestJwt(validPayload, testKeyPair.privateKey, 'test-key-1', false);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': validJwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(400); // 400 means auth passed and reached D1 query
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Guardian g-test not found');

    global.fetch = originalFetch;
  });

  it('accepts valid admin secret token', async () => {
    const env = createAdminMockEnv();
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Guardian g-test not found');
  });

  it('rejects bearer authorization if attempting to reuse AUTH_SECRET (enforcing secret separation)', async () => {
    const env = createAdminMockEnv();
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-oauth-secret-key-different'
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unauthorized');
  });

  it('recovers and accepts rotated kid missing from static JWKS by dynamic force-refresh', async () => {
    const env = createAdminMockEnv();
    // Seed static JWKS with an old/stale kid
    env.CF_ACCESS_JWKS = JSON.stringify({ keys: [{ ...testJwk, kid: 'old-stale-kid-1' }] });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('cdn-cgi/access/certs')) {
        return new Response(JSON.stringify({ keys: [{ ...testJwk, kid: 'rotated-new-kid-2' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return originalFetch(url);
    });

    const validPayload = {
      email: 'lead-auditor@githoot.com',
      sub: 'auditor-rotated',
      aud: 'aud-test-12345',
      iss: 'https://githoot-team.cloudflareaccess.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const rotatedJwt = await signTestJwt(validPayload, testKeyPair.privateKey, 'rotated-new-kid-2', false);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': rotatedJwt
        },
        body: JSON.stringify({ guardianId: 'g-test', candidateId: 'c-1', candidateSha256: 's-1', verdict: 'pass' })
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Guardian g-test not found');
    global.fetch = originalFetch;
  });

  it('constantTimeEqual performs constant-time comparison without early-return branching on first mismatch', async () => {
    // 1. Equivalence assertions across match, mismatch, and length variations
    expect(constantTimeEqual('super-secret-key-16b', 'super-secret-key-16b')).toBe(true);
    expect(constantTimeEqual('Xuper-secret-key-16b', 'super-secret-key-16b')).toBe(false);
    expect(constantTimeEqual('super-secret-Xey-16b', 'super-secret-key-16b')).toBe(false);
    expect(constantTimeEqual('super-secret-key-16X', 'super-secret-key-16b')).toBe(false);
    expect(constantTimeEqual('super-secret-key-16b', 'short')).toBe(false);
    expect(constantTimeEqual('short', 'super-secret-key-16b')).toBe(false);

    // 2. Structural verification of branchless loop execution
    const fnSrc = constantTimeEqual.toString();
    expect(fnSrc).toContain('^');
    expect(fnSrc).toContain('diff');

    // Extract loop body between "for (" and the closing of the loop
    const loopMatch = fnSrc.match(/for\s*\([^)]*\)\s*\{([^}]*)\}/);
    expect(loopMatch).toBeDefined();
    const loopBody = loopMatch ? loopMatch[1] : '';

    // Strictly prove no early-exit branch within loop
    expect(loopBody).not.toMatch(/\breturn\b/);
    expect(loopBody).not.toMatch(/\bbreak\b/);
    expect(loopBody).not.toMatch(/\bif\b/);

    // Exactly one return statement in the entire function (at the end)
    const returnCount = (fnSrc.match(/\breturn\b/g) || []).length;
    expect(returnCount).toBe(1);
    expect(fnSrc).toMatch(/return\s+diff\s*===\s*0/);
  });

  it('GET /auth/admin/review/:jobId returns immutable review bundle with bundleSha', async () => {
    const env = createAdminMockEnv();
    const { POSE_SET } = await import('../../src/server/services/dna/contracts');
    const { sha256Hex } = await import('../../src/server/services/crypto/web-crypto');
    const dummyBytes = new Uint8Array([1, 2, 3]);
    const dummySha = await sha256Hex(dummyBytes);

    const mockFrames = POSE_SET.map((p, i) => ({
      id: `f-${i}`,
      job_id: 'job-rev-1',
      pose_id: p.id,
      pose_index: i,
      frame_sha256: dummySha,
      raw_sha256: dummySha,
      state: 'ACCEPTED',
      raw_gate_metrics: '{"validated":true}'
    }));

    (env.ASSETS_BUCKET.get as any).mockResolvedValue({
      arrayBuffer: async () => dummyBytes
    });

    (env.DB.prepare as any).mockImplementation((query: string) => ({
      bind: vi.fn().mockImplementation(() => ({
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_jobs')) {
            return { id: 'job-rev-1', guardian_id: 'g-rev-1', state: 'VERIFYING', manifest_url: 'guardians/g-rev-1/manifest.json' };
          }
          if (query.includes('FROM guardians')) {
            return {
              id: 'g-rev-1',
              name: 'Aether',
              species: 'neonbyte',
              element: 'Cyber',
              rarity_tier: 'Legendary',
              status: 'VERIFYING',
              reference_sha256: dummySha,
              identity_spec: '{"dnaSeed":"seed1"}'
            };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: mockFrames })
      }))
    }));
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        }
      }),
      env
    );

    expect(res.status).toBe(200);
    const bundle = (await res.json()) as any;
    expect(bundle.jobId).toBe('job-rev-1');
    expect(bundle.frames.length).toBe(16);
    expect(bundle.bundleSha).toBeDefined();
    expect(bundle.referenceUrl).toContain(`references/${dummySha}.png`);
  });
  it('POST /auth/admin/review/:jobId rejects tampered bundleSha and approves valid bundleSha', async () => {
    const env = createAdminMockEnv();
    const { POSE_SET } = await import('../../src/server/services/dna/contracts');
    const { sha256Hex } = await import('../../src/server/services/crypto/web-crypto');
    const dummyBytes = new Uint8Array([1, 2, 3]);
    const dummySha = await sha256Hex(dummyBytes);

    const mockFrames = POSE_SET.map((p, i) => ({
      id: `f-${i}`,
      job_id: 'job-rev-1',
      pose_id: p.id,
      pose_index: i,
      frame_sha256: dummySha,
      raw_sha256: dummySha,
      state: 'ACCEPTED',
      raw_gate_metrics: '{"validated":true}'
    }));

    (env.ASSETS_BUCKET.get as any).mockResolvedValue({
      arrayBuffer: async () => dummyBytes
    });

    (env.DB.prepare as any).mockImplementation((query: string) => ({
      bind: vi.fn().mockImplementation(() => ({
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_jobs')) {
            return { id: 'job-rev-1', guardian_id: 'g-rev-1', state: 'VERIFYING', manifest_url: 'guardians/g-rev-1/manifest.json' };
          }
          if (query.includes('FROM guardians')) {
            return {
              id: 'g-rev-1',
              name: 'Aether',
              species: 'neonbyte',
              element: 'Cyber',
              rarity_tier: 'Legendary',
              status: 'VERIFYING',
              reference_sha256: dummySha,
              identity_spec: '{"dnaSeed":"seed1"}'
            };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: mockFrames }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
      })),
      batch: vi.fn().mockResolvedValue([{ success: true, meta: { changes: 1 } }])
    }));
    // 1. Fetch valid review bundle via GET
    const getRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'GET',
        headers: { Authorization: 'Bearer production-super-secret-key-at-least-16-bytes' }
      }),
      env
    );
    expect(getRes.status).toBe(200);
    const bundle = (await getRes.json()) as any;
    const validBundleSha = bundle.bundleSha;
    expect(validBundleSha).toBeDefined();

    // 2. Reject tampered bundleSha
    const badRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({ decision: 'reject', bundleSha: 'forged-tampered-bundle-sha', notes: 'Bad' })
      }),
      env
    );
    expect(badRes.status).toBe(400);
    const badBody = (await badRes.json()) as any;
    expect(badBody.error).toContain('BUNDLE_SHA_MISMATCH');

    // 3. Accept valid bundleSha with reject decision -> returns QUARANTINED
    const rejectRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({ decision: 'reject', bundleSha: validBundleSha, notes: 'Style inconsistency' })
      }),
      env
    );
    expect(rejectRes.status).toBe(200);
    const rejectBody = (await rejectRes.json()) as any;
    expect(rejectBody.status).toBe('QUARANTINED');
    expect(rejectBody.bundleSha).toBe(validBundleSha);
  });

  it('POST /auth/admin/approve-reference derives identity hash server-side from D1', async () => {
    const env = createAdminMockEnv();
    const { compileIdentitySpec } = await import('../../src/server/services/dna/compiler');
    const spec = await compileIdentitySpec({
      githubUserId: 11829471,
      telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
    });

    (env.DB.prepare as any).mockImplementation((query: string) => ({
      bind: vi.fn().mockImplementation(() => ({
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardians')) {
            return { identity_spec: JSON.stringify(spec) };
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
      }))
    }));

    // Pass forged currentIdentityHash in body -> ignored in favor of server D1 spec!
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/approve-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({
          guardianId: 'g-test-1',
          candidateId: 'cand-1',
          candidateSha256: 'sha-cand-1',
          verdict: 'pass',
          currentIdentityHash: 'forged-attacker-hash'
        })
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('Candidate cand-1 not found');
  });
  it('POST /auth/admin/review/:jobId approves with valid bundleSha, populates 16 hash-bound verdicts in D1, records immutable audit entry, and publishes ASSET_READY', async () => {
    const { POSE_SET, VERSIONS } = await import('../../src/server/services/dna/contracts');
    const { compileIdentitySpec } = await import('../../src/server/services/dna/compiler');
    const { encodeRgbaToPng } = await import('../../src/server/services/image/png-codec');
    const { encodeRgbaToWebp } = await import('../../src/server/services/image/webp-encoder');
    const { sha256Hex } = await import('../../src/server/services/crypto/web-crypto');
    const { validateAndNormalizeFrame } = await import('../../src/server/services/image/frame-gate');

    const spec = await compileIdentitySpec({
      githubUserId: 11829471,
      telemetry: { topLanguages: ['typescript'], provenance: { topLanguages: 'measured' } }
    });

    const rgba = new Uint8Array(256 * 256 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 0; rgba[i+1] = 255; rgba[i+2] = 0; rgba[i+3] = 255;
    }
    for (let y = 64; y < 192; y++) {
      for (let x = 64; x < 192; x++) {
        const idx = (y * 256 + x) * 4;
        rgba[idx] = 255; rgba[idx+1] = 128; rgba[idx+2] = 0; rgba[idx+3] = 255;
      }
    }
    const samplePng = encodeRgbaToPng(rgba, 256, 256);
    const gateRes = await validateAndNormalizeFrame(samplePng);
    if (!gateRes.ok) throw new Error('Gate failed');

    const refSha = gateRes.frameSha256;
    const r2Storage = new Map<string, Uint8Array>();
    const d1Tables = {
      guardians: new Map<string, any>(),
      guardian_hatch_jobs: new Map<string, any>(),
      guardian_reference_candidates: new Map<string, any>(),
      guardian_hatch_frames: new Map<string, any>(),
      guardian_publication: new Map<string, any>(),
      guardian_review_records: new Map<string, any>()
    };

    d1Tables.guardians.set('g-rev-1', {
      id: 'g-rev-1',
      name: 'Aether',
      species: spec.species,
      species_name: spec.speciesName,
      element: spec.element,
      rarity_tier: spec.rarity,
      status: 'VERIFYING',
      reference_sha256: refSha,
      identity_spec: JSON.stringify(spec),
      dna_seed: spec.dnaSeed
    });

    d1Tables.guardian_reference_candidates.set('cand-1', {
      id: 'cand-1',
      guardian_id: 'g-rev-1',
      candidate_sha256: refSha,
      state: 'APPROVED'
    });

    d1Tables.guardian_hatch_jobs.set('job-rev-1', {
      id: 'job-rev-1',
      guardian_id: 'g-rev-1',
      state: 'VERIFYING',
      model_id: 'nano-banana-pro-preview',
      manifest_url: 'guardians/g-rev-1/manifest.json'
    });

    r2Storage.set(`references/${refSha}.png`, gateRes.normalizedPng);

    const framesData = [];
    for (let i = 0; i < 16; i++) {
      const p = POSE_SET[i]!;
      d1Tables.guardian_hatch_frames.set(`frame-${p.id}`, {
        id: `frame-${p.id}`,
        job_id: 'job-rev-1',
        pose_id: p.id,
        pose_index: i,
        frame_sha256: gateRes.frameSha256,
        raw_sha256: gateRes.rawSha256,
        raw_gate_metrics: JSON.stringify({ ...gateRes.metrics, attempt: 1 }),
        semantic_verdict: null as string | null,
        state: 'ACCEPTED'
      });

      r2Storage.set(`guardians/g-rev-1/raw/${gateRes.rawSha256}.png`, samplePng);
      r2Storage.set(`guardians/g-rev-1/frames/f${p.id}_${gateRes.frameSha256}.png`, gateRes.normalizedPng);

      framesData.push({
        poseId: p.id,
        poseIndex: i,
        frameSha256: gateRes.frameSha256,
        rawSha256: gateRes.rawSha256
      });
    }

    const dummyRgba = new Uint8Array(1024 * 1024 * 4);
    const sheetPngBytes = encodeRgbaToPng(dummyRgba, 1024, 1024);
    const sheetWebpBytes = await encodeRgbaToWebp(dummyRgba, 1024, 1024);
    const stripPngBytes = encodeRgbaToPng(dummyRgba, 4096, 256);
    const stripWebpBytes = await encodeRgbaToWebp(dummyRgba, 4096, 256);

    const sheetPngSha = await sha256Hex(sheetPngBytes);
    const sheetWebpSha = await sha256Hex(sheetWebpBytes);
    const stripPngSha = await sha256Hex(stripPngBytes);
    const stripWebpSha = await sha256Hex(stripWebpBytes);

    r2Storage.set(`masters/${sheetPngSha}.png`, sheetPngBytes);
    r2Storage.set(`masters/${sheetWebpSha}.webp`, sheetWebpBytes);
    r2Storage.set(`masters/${stripPngSha}.png`, stripPngBytes);
    r2Storage.set(`masters/${stripWebpSha}.webp`, stripWebpBytes);

    const manifestData = {
      v: 1,
      guardianId: 'g-rev-1',
      versions: VERSIONS,
      identityHash: spec.identityHash,
      identity: spec,
      modelId: 'nano-banana-pro-preview',
      referenceSha256: refSha,
      state: 'VERIFYING',
      frames: framesData,
      artifacts: {
        sheetPng: { url: `https://cdn.githoot.com/masters/${sheetPngSha}.png`, key: `masters/${sheetPngSha}.png`, sha256: sheetPngSha },
        sheetWebp: { url: `https://cdn.githoot.com/masters/${sheetWebpSha}.webp`, key: `masters/${sheetWebpSha}.webp`, sha256: sheetWebpSha },
        stripPng: { url: `https://cdn.githoot.com/masters/${stripPngSha}.png`, key: `masters/${stripPngSha}.png`, sha256: stripPngSha },
        stripWebp: { url: `https://cdn.githoot.com/masters/${stripWebpSha}.webp`, key: `masters/${stripWebpSha}.webp`, sha256: stripWebpSha }
      }
    };

    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestData, null, 2));
    r2Storage.set('guardians/g-rev-1/manifest.json', manifestBytes);

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardians')) {
              return d1Tables.guardians.get('g-rev-1') || null;
            }
            if (query.includes('FROM guardian_hatch_jobs')) {
              return d1Tables.guardian_hatch_jobs.get('job-rev-1') || null;
            }
            if (query.includes('FROM guardian_reference_candidates')) {
              return d1Tables.guardian_reference_candidates.get('cand-1') || null;
            }
            if (query.includes('FROM guardian_publication')) {
              return d1Tables.guardian_publication.get('g-rev-1') || null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardian_hatch_frames')) {
              return { results: Array.from(d1Tables.guardian_hatch_frames.values()) };
            }
            return { results: [] };
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO guardian_review_records')) {
              const [id, jId, gId, rev, dec, bSha, mSha, fHashes, notes, now] = boundArgs;
              d1Tables.guardian_review_records.set(id, {
                id,
                job_id: jId,
                guardian_id: gId,
                reviewer: rev,
                decision: dec,
                bundle_sha: bSha,
                manifest_sha: mSha,
                frame_hashes: fHashes,
                notes,
                created_at: now
              });
            }
            if (query.includes('INSERT INTO guardian_publication')) {
              const [gId, jId, mSha, mKey, sSha, sKey, rev, pubAt] = boundArgs;
              d1Tables.guardian_publication.set(gId, {
                guardian_id: gId,
                job_id: jId,
                manifest_sha256: mSha,
                manifest_key: mKey,
                spritesheet_sha256: sSha,
                spritesheet_key: sKey,
                state: 'ASSET_READY',
                reviewer: rev,
                published_at: pubAt,
                created_at: pubAt
              });
            }
            if (query.includes('UPDATE guardian_hatch_frames SET semantic_verdict')) {
              const [verdictData, frameId] = boundArgs;
              const target = Array.from(d1Tables.guardian_hatch_frames.values()).find(f => f.id === frameId);
              if (target) target.semantic_verdict = verdictData;
            }
            if (query.includes('INSERT INTO guardian_review_records')) {
              const [id, jId, gId, rev, bSha, mSha, fHashes, notes, now] = boundArgs;
              d1Tables.guardian_review_records.set(id, {
                id,
                job_id: jId,
                guardian_id: gId,
                reviewer: rev,
                decision: 'approve',
                bundle_sha: bSha,
                manifest_sha: mSha,
                frame_hashes: fHashes,
                notes,
                created_at: now
              });
            }
            if (query.includes('UPDATE guardians') && query.includes('SET status = \'ASSET_READY\'')) {
              const g = d1Tables.guardians.get('g-rev-1');
              if (g) {
                g.status = 'ASSET_READY';
                g.spritesheet_url = boundArgs[0];
                g.manifest_url = boundArgs[1];
              }
            }
            if (query.includes('UPDATE guardian_hatch_jobs') && query.includes('SET state = \'ASSET_READY\'')) {
              const j = d1Tables.guardian_hatch_jobs.get('job-rev-1');
              if (j) j.state = 'ASSET_READY';
            }
            return { success: true, meta: { changes: 1 } };
          })
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        for (const s of stmts) {
          await s.run();
        }
        return [{ success: true, meta: { changes: 1 } }];
      })
    } as unknown as D1Database;

    const mockBucket = {
      head: vi.fn().mockImplementation(async (key: string) => {
        const found = r2Storage.get(key);
        if (!found) return null;
        return { key, size: found.length };
      }),
      get: vi.fn().mockImplementation(async (key: string) => {
        const found = r2Storage.get(key);
        if (!found) return null;
        return {
          arrayBuffer: async () => found.buffer.slice(found.byteOffset, found.byteOffset + found.byteLength),
          json: async () => JSON.parse(new TextDecoder().decode(found)),
          text: async () => new TextDecoder().decode(found)
        };
      }),
      put: vi.fn().mockImplementation(async (key: string, data: any) => {
        const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : (data instanceof Uint8Array ? data : new Uint8Array(data));
        r2Storage.set(key, bytes);
        return null;
      })
    } as unknown as R2Bucket;

    const env: Env = {
      DB: mockDb,
      ASSETS_BUCKET: mockBucket,
      CACHE_KV: {} as any,
      AI_QUEUE: {} as any,
      ADMIN_REVIEW_SECRET: 'production-super-secret-key-at-least-16-bytes',
      ENVIRONMENT: 'test',
      DOMAIN: 'githoot.com',
      CDN_DOMAIN: 'cdn.githoot.com',
      EARLY_ACCESS_TOTAL_SLOTS: '100',
      AI_MODEL_TIER: 'nano-banana-pro-preview'
    };

    // 1. GET review bundle
    const getRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'GET',
        headers: { Authorization: 'Bearer production-super-secret-key-at-least-16-bytes' }
      }),
      env
    );
    expect(getRes.status).toBe(200);
    const bundle = (await getRes.json()) as any;
    expect(bundle.bundleSha).toBeDefined();

    // 2. POST review decision approve
    const postRes = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer production-super-secret-key-at-least-16-bytes'
        },
        body: JSON.stringify({
          decision: 'approve',
          bundleSha: bundle.bundleSha,
          notes: 'Signed and approved by art lead'
        })
      }),
      env
    );

    expect(postRes.status).toBe(200);
    const postBody = (await postRes.json()) as any;
    expect(postBody.success).toBe(true);
    expect(postBody.status).toBe('ASSET_READY');
    expect(postBody.bundleSha).toBe(bundle.bundleSha);

    // 3. Inspect D1 review records table
    expect(d1Tables.guardian_review_records.size).toBe(1);
    const reviewRecord = Array.from(d1Tables.guardian_review_records.values())[0];
    expect(reviewRecord.decision).toBe('approve');
    expect(reviewRecord.bundle_sha).toBe(bundle.bundleSha);
    expect(reviewRecord.reviewer).toBe('admin@githoot.internal');
    expect(reviewRecord.created_at).toBeDefined();

    // 4. Inspect D1 frame verdicts (all 16 frames must have hash-bound semantic verdict)
    const frameList = Array.from(d1Tables.guardian_hatch_frames.values());
    expect(frameList.length).toBe(16);
    for (const f of frameList) {
      expect(f.semantic_verdict).toBeDefined();
      const v = JSON.parse(f.semantic_verdict);
      expect(v.verdict).toBe('pass');
      expect(v.boundToSha256).toBe(f.frame_sha256);
      expect(v.reviewer).toBe('admin@githoot.internal');
    }

    // 5. Inspect publication pointer
    expect(d1Tables.guardian_publication.size).toBe(1);
    const pub = d1Tables.guardian_publication.get('g-rev-1');
    expect(pub.state).toBe('ASSET_READY');
  });

  it('GET /auth/admin/review/:jobId fails closed (400) when reference image is missing from R2', async () => {
    const env = createAdminMockEnv();
    (env.DB.prepare as any).mockImplementation((query: string) => ({
      bind: vi.fn().mockImplementation(() => ({
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_jobs')) {
            return { id: 'job-rev-missing-ref', guardian_id: 'g-rev-1', state: 'VERIFYING' };
          }
          if (query.includes('FROM guardians')) {
            return { id: 'g-rev-1', name: 'Aether', status: 'VERIFYING', reference_sha256: 'missing-ref-sha', identity_spec: '{}' };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: Array.from({ length: 16 }, (_, i) => ({ id: `f-${i}`, pose_id: `p-${i}`, frame_sha256: 'f-sha', raw_sha256: 'r-sha' })) })
      }))
    }));

    // R2 get returns null for reference image
    (env.ASSETS_BUCKET.get as any).mockResolvedValue(null);

    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-missing-ref', {
        method: 'GET',
        headers: { Authorization: 'Bearer production-super-secret-key-at-least-16-bytes' }
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('Reference hero image missing from R2');
  });

  it('GET /auth/admin/review/:jobId fails closed (400) when manifest is missing from R2', async () => {
    const env = createAdminMockEnv();
    const { sha256Hex } = await import('../../src/server/services/crypto/web-crypto');
    const dummyBytes = new Uint8Array([1, 2, 3]);
    const dummySha = await sha256Hex(dummyBytes);

    (env.DB.prepare as any).mockImplementation((query: string) => ({
      bind: vi.fn().mockImplementation(() => ({
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('FROM guardian_hatch_jobs')) {
            return { id: 'job-rev-no-man', guardian_id: 'g-rev-1', state: 'VERIFYING', manifest_url: 'manifests/missing.json' };
          }
          if (query.includes('FROM guardians')) {
            return { id: 'g-rev-1', name: 'Aether', status: 'VERIFYING', reference_sha256: dummySha, identity_spec: '{}' };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: Array.from({ length: 16 }, (_, i) => ({ id: `f-${i}`, pose_id: `p-${i}`, frame_sha256: dummySha, raw_sha256: dummySha })) })
      }))
    }));

    (env.ASSETS_BUCKET.get as any).mockImplementation(async (key: string) => {
      if (key.includes('manifests/')) return null; // Manifest missing!
      return { arrayBuffer: async () => dummyBytes };
    });
    const res = await serverApp.fetch(
      new Request('http://localhost/auth/admin/review/job-rev-no-man', {
        method: 'GET',
        headers: { Authorization: 'Bearer production-super-secret-key-at-least-16-bytes' }
      }),
      env
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('Manifest object missing from R2');
  });
});
