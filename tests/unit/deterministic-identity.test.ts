// ============================================================================
// Phase 2: Authentic Telemetry & Deterministic Identity Tests
// (tests/unit/deterministic-identity.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { sha256Hex } from '../../src/server/services/crypto/web-crypto';
import {
  compileIdentitySpec,
  compileReferencePrompt,
  compilePosePrompt,
  compileAllPosePrompts,
  requestFingerprint,
  validateIdentitySpec,
  meritScore,
  normalizeTelemetry,
  dnaSeed
} from '../../src/server/services/dna/compiler';
import type { TelemetrySnapshot, Env, IdentitySpec } from '../../src/server/types';
import { handleGenerationQueue } from '../../src/server/queue/generation-worker';
import { createValidCenteredSubjectPng } from '../integration/fixtures/images';
describe('Phase 2: Deterministic SHA-256 Cryptographic Invariants', () => {
  // Published NIST FIPS 180-4 SHA-256 test vectors
  it('computes exact published FIPS 180-4 SHA-256 hash of empty string ""', async () => {
    const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    expect(await sha256Hex('')).toBe(expected);
  });

  it('computes exact published FIPS 180-4 SHA-256 hash of "abc"', async () => {
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(await sha256Hex('abc')).toBe(expected);
  });

  it('computes exact published SHA-256 hash of multi-byte non-ASCII UTF-8 string', async () => {
    const input = 'GitHoot 🦉 ấp trứng & sinh linh thần thoại 2026';
    const expected = '4e8468e3a1f0f4edda9fd5089e11ab7915e5d43f82b00ac5c301703fed9ababb';
    expect(await sha256Hex(input)).toBe(expected);
  });

  it('verifies exact golden SHA-256 hashes across complete IdentitySpec, prompts, and fingerprint', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['TypeScript', 'Rust', 'Go'],
      stars: 1420, forks: 210, publicRepos: 48, followers: 380,
      accountAgeYears: 9, mergedExternalPRs: 24, releases: 11,
      reviewRatio: 0.62, collaborators: 18, activeWeeks: 34, nightCommitRatio: 0.71,
      provenance: {
        topLanguages: 'measured', stars: 'measured', forks: 'measured', publicRepos: 'measured', followers: 'measured',
        accountAgeYears: 'measured', mergedExternalPRs: 'measured', releases: 'measured', reviewRatio: 'measured',
        collaborators: 'measured', activeWeeks: 'measured', nightCommitRatio: 'measured'
      }
    };

    const spec = await compileIdentitySpec({ githubUserId: 11829471, telemetry });
    expect(spec.dnaSeed).toBe('ed9c4578553149045f9b8c1d46d3e801a59324a0657c7c87bd70391ab06c76cb');
    expect(spec.telemetrySnapshotHash).toBe('8bcaad92f6581d5bbb75a4acafb835615288cc280ddeb6b812b7351f240bce4f');
    expect(spec.identityHash).toBe('244a6529d022e63b94a6fec175c6d198d8312854fda560e5d83f283def293983');
    expect(spec.species).toBe('neonbyte');
    expect(spec.element).toBe('Cyber');
    expect(spec.rarity).toBe('Rare');

    const refPrompt = await compileReferencePrompt(spec);
    expect(refPrompt.promptHash).toBe('5172e615740545bbff7035214c48ace85286024b6c1530f1dacf8c8fd6cd7d76');

    const posePrompt = await compilePosePrompt(spec, 'hero_stance');
    expect(posePrompt.promptHash).toBe('6083d37bd222cee8da2dab1c8bcdc9fba5a83e0362381019f177f4cf0a2f2c04');

    const fingerprint = await requestFingerprint({ spec, referenceSha256: 'sha-ref-golden-1234', modelId: 'nano-banana-pro-preview' });
    expect(fingerprint).toBe('f790a42382815ea76b978db31aebcad07ef2e652b93abee2ba5fdfde755d86c5');
  });

  it('maintains 100% byte-identical identity derivation across 1000 iterations', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['typescript', 'rust'],
      stars: 120,
      forks: 15,
      publicRepos: 25,
      followers: 40,
      accountAgeYears: 3,
      mergedExternalPRs: 5,
      releases: 2,
      reviewRatio: 0.8,
      collaborators: 4,
      activeWeeks: 35,
      nightCommitRatio: 0.1,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const baseline = await compileIdentitySpec({ githubUserId: 424242, telemetry });
    for (let i = 0; i < 1000; i++) {
      const derived = await compileIdentitySpec({ githubUserId: 424242, telemetry });
      expect(derived.identityHash).toBe(baseline.identityHash);
      expect(derived.dnaSeed).toBe(baseline.dnaSeed);
      expect(derived.species).toBe(baseline.species);
      expect(derived.element).toBe(baseline.element);
      expect(derived.rarity).toBe(baseline.rarity);
    }
  });
});

describe('Phase 2: Authentic Telemetry & Provenance-Aware Merit Scoring', () => {
  it('treats unavailable telemetry metrics as documented neutral (0.25) rather than measured zero', () => {
    // Snapshot with all metrics tagged unavailable (degraded / zero API data mode)
    const degradedSnapshot: TelemetrySnapshot = {
      topLanguages: [],
      stars: 0,
      forks: 0,
      publicRepos: 0,
      followers: 0,
      accountAgeYears: 0,
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
        publicRepos: 'unavailable',
        followers: 'unavailable',
        accountAgeYears: 'unavailable',
        mergedExternalPRs: 'unavailable',
        releases: 'unavailable',
        reviewRatio: 'unavailable',
        collaborators: 'unavailable',
        activeWeeks: 'unavailable',
        nightCommitRatio: 'unavailable'
      }
    };

    const merit = meritScore(degradedSnapshot);
    // When all metrics are unavailable, each neutralIfUnavailable returns 0.25
    // Total weighted merit must equal exactly 0.25 (neutral baseline)
    expect(merit).toBe(0.25);

    // Conversely, a measured snapshot with literal zero stars and zero PRs produces lower merit than 0.25
    const measuredZeroSnapshot: TelemetrySnapshot = {
      ...degradedSnapshot,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const measuredZeroMerit = meritScore(measuredZeroSnapshot);
    expect(measuredZeroMerit).toBeLessThan(0.25);
    expect(measuredZeroMerit).toBe(0);
  });

  it('compiles deterministic IdentitySpec from telemetry with provenance', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['typescript', 'rust'],
      stars: 120,
      forks: 15,
      publicRepos: 25,
      followers: 40,
      accountAgeYears: 3,
      mergedExternalPRs: 5,
      releases: 2,
      reviewRatio: 0.8,
      collaborators: 4,
      activeWeeks: 35,
      nightCommitRatio: 0.1,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const spec1 = await compileIdentitySpec({ githubUserId: 12345, telemetry });
    const spec2 = await compileIdentitySpec({ githubUserId: 12345, telemetry });

    expect(spec1.identityHash).toBe(spec2.identityHash);
    expect(spec1.dnaSeed).toBe(spec2.dnaSeed);
    expect(spec1.species).toBe(spec2.species);
    expect(spec1.element).toBe('Cyber'); // TypeScript maps to Cyber in LANGUAGE_ELEMENT
  });
});

describe('Phase 2: Strict Runtime IdentitySpec Validation & Hash Verification', () => {
  it('validates a complete, authentic IdentitySpec successfully', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 50,
      forks: 10,
      publicRepos: 5,
      followers: 20,
      accountAgeYears: 2,
      mergedExternalPRs: 0,
      releases: 1,
      reviewRatio: 0.5,
      collaborators: 2,
      activeWeeks: 20,
      nightCommitRatio: 0.2,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const spec = await compileIdentitySpec({ githubUserId: 888123, telemetry });
    const result = await validateIdentitySpec(spec);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.spec.species).toBe('emberfox');
      expect(result.spec.element).toBe('Fire');
    }
  });

  it('rejects IdentitySpec with missing required fields or invalid types', async () => {
    expect((await validateIdentitySpec(null)).valid).toBe(false);
    expect((await validateIdentitySpec('not-an-object')).valid).toBe(false);
    expect((await validateIdentitySpec({})).valid).toBe(false);

    const incomplete = {
      species: 'emberfox',
      element: 'Fire',
      identityHash: 'deadbeef'
    };
    const res = await validateIdentitySpec(incomplete);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toContain('Missing or invalid required string field');
    }
  });

  it('rejects IdentitySpec with invalid hash formats or out-of-range merit', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 10,
      forks: 1,
      publicRepos: 1,
      followers: 1,
      accountAgeYears: 1,
      mergedExternalPRs: 0,
      releases: 0,
      reviewRatio: 0,
      collaborators: 0,
      activeWeeks: 1,
      nightCommitRatio: 0,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const validSpec = await compileIdentitySpec({ githubUserId: 777, telemetry });

    // Invalid merit (< 0 or > 1)
    const badMerit = { ...validSpec, merit: 1.5 };
    expect((await validateIdentitySpec(badMerit)).valid).toBe(false);

    // Invalid dnaSeed (not 64-hex)
    const badDnaSeed = { ...validSpec, dnaSeed: 'not-hex' };
    expect((await validateIdentitySpec(badDnaSeed)).valid).toBe(false);
  });

  it('rejects IdentitySpec with element-species mismatch', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 10,
      forks: 1,
      publicRepos: 1,
      followers: 1,
      accountAgeYears: 1,
      mergedExternalPRs: 0,
      releases: 0,
      reviewRatio: 0,
      collaborators: 0,
      activeWeeks: 1,
      nightCommitRatio: 0,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const validSpec = await compileIdentitySpec({ githubUserId: 777, telemetry });
    // Emberfox belongs to Fire, mismatching it with Cyber must fail
    const mismatch = { ...validSpec, element: 'Cyber', species: 'emberfox' };
    const res = await validateIdentitySpec(mismatch);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toContain('Element-species mismatch');
    }
  });
  it('rejects IdentitySpec with swapped githubUserId or dnaSeed mismatch', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 10,
      forks: 1,
      publicRepos: 1,
      followers: 1,
      accountAgeYears: 1,
      mergedExternalPRs: 0,
      releases: 0,
      reviewRatio: 0,
      collaborators: 0,
      activeWeeks: 1,
      nightCommitRatio: 0,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const validSpec = await compileIdentitySpec({ githubUserId: 777, telemetry });

    // User 777 spec presented for User 999 (swapped user!)
    const resSwapped = await validateIdentitySpec(validSpec, { githubUserId: 999 });
    expect(resSwapped.valid).toBe(false);
    if (!resSwapped.valid) {
      expect(resSwapped.reason).toContain('githubUserId mismatch');
    }
  });

  it('rejects IdentitySpec with canonical speciesName or anatomy mismatch', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 10,
      forks: 1,
      publicRepos: 1,
      followers: 1,
      accountAgeYears: 1,
      mergedExternalPRs: 0,
      releases: 0,
      reviewRatio: 0,
      collaborators: 0,
      activeWeeks: 1,
      nightCommitRatio: 0,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const validSpec = await compileIdentitySpec({ githubUserId: 777, telemetry });
    const badName = { ...validSpec, speciesName: 'Fake Custom Name' };
    const resName = await validateIdentitySpec(badName);
    expect(resName.valid).toBe(false);
    if (!resName.valid) {
      expect(resName.reason).toContain('speciesName mismatch');
    }

    const badAnatomy = { ...validSpec, anatomy: 'fake anatomy' };
    const resAnatomy = await validateIdentitySpec(badAnatomy);
    expect(resAnatomy.valid).toBe(false);
    if (!resAnatomy.valid) {
      expect(resAnatomy.reason).toContain('anatomy mismatch');
    }
  });

  it('detects tampered IdentitySpec where properties were modified without matching identityHash', async () => {
    const telemetry: TelemetrySnapshot = {
      topLanguages: ['rust'],
      stars: 10,
      forks: 1,
      publicRepos: 1,
      followers: 1,
      accountAgeYears: 1,
      mergedExternalPRs: 0,
      releases: 0,
      reviewRatio: 0,
      collaborators: 0,
      activeWeeks: 1,
      nightCommitRatio: 0,
      provenance: {
        topLanguages: 'measured',
        stars: 'measured',
        forks: 'measured',
        publicRepos: 'measured',
        followers: 'measured',
        accountAgeYears: 'measured',
        mergedExternalPRs: 'measured',
        releases: 'measured',
        reviewRatio: 'measured',
        collaborators: 'measured',
        activeWeeks: 'measured',
        nightCommitRatio: 'measured'
      }
    };

    const validSpec = await compileIdentitySpec({ githubUserId: 777, telemetry });
    // Tamper with rarity (e.g. Common -> Mythic) while keeping old identityHash
    const tampered = { ...validSpec, rarity: 'Mythic' as const };
    const res = await validateIdentitySpec(tampered);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.reason).toContain('Cryptographic identityHash mismatch');
    }
  });
});

describe('Phase 2: Fail-Closed Worker Identity Validation (Blocker #11c)', () => {
  it('quarantines job when guardian row has missing or malformed identity_spec (zero synthesized defaults)', async () => {
    const updatedStatus: string[] = [];
    const updatedJobState: string[] = [];

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation((...args: any[]) => ({
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardians')) {
              return {
                id: 'g-malformed-1',
                user_id: 'u-1',
                github_user_id: 999123,
                name: 'BrokenPet',
                identity_spec: 'MALFORMED_JSON_STRING_OR_EMPTY' // Invalid identity_spec!
              };
            }
            if (query.includes('FROM guardian_hatch_jobs')) {
              return {
                id: 'job-1',
                guardian_id: 'g-malformed-1',
                state: 'PENDING',
                model_id: 'nano-banana-pro-preview'
              };
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('UPDATE guardians SET status =')) {
              updatedStatus.push('QUARANTINED');
            }
            if (query.includes('UPDATE guardian_hatch_jobs SET state =')) {
              updatedJobState.push('QUARANTINED');
            }
            return { meta: { changes: 1 } };
          })
        }))
      })),
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        for (const s of stmts) {
          await s.run();
        }
        return [];
      })
    };

    const ackFn = vi.fn();
    const retryFn = vi.fn();

    const mockBatch = {
      messages: [{
        id: 'msg-1',
        timestamp: new Date(),
        body: { type: 'HATCH_JOB', guardianId: 'g-malformed-1', jobId: 'job-1' },
        ack: ackFn,
        retry: retryFn
      }]
    };
    const mockBucket = {
      put: vi.fn(),
      get: vi.fn(),
      head: vi.fn()
    };

    const geminiFetchSpy = vi.fn();
    globalThis.fetch = geminiFetchSpy;

    const mockEnv: Partial<Env> = {
      DB: mockDb as any,
      ASSETS_BUCKET: mockBucket as any,
      AI_MODEL_TIER: 'nano-banana-pro-preview'
    };

    await handleGenerationQueue(mockBatch as any, mockEnv as Env);

    // Assert that job was quarantined and NO synthesized default identity was accepted
    expect(updatedStatus).toContain('QUARANTINED');
    expect(updatedJobState).toContain('QUARANTINED');
    expect(ackFn).toHaveBeenCalled();

    // Strict side-effect assertion: ZERO calls to Gemini API and ZERO R2 storage writes
    expect(geminiFetchSpy).not.toHaveBeenCalled();
    expect(mockBucket.put).not.toHaveBeenCalled();
  });
  it('allows legitimately persisted degraded claim (github_user_id = 0, username-seeded) to pass worker validation cleanly without quarantine', async () => {
    const updatedStatus: string[] = [];

    // Compile degraded identity using username seed
    const degradedTelemetry: TelemetrySnapshot = {
      topLanguages: [],
      stars: 0,
      forks: 0,
      publicRepos: 0,
      followers: 0,
      accountAgeYears: 0,
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
        publicRepos: 'unavailable',
        followers: 'unavailable',
        accountAgeYears: 'unavailable',
        mergedExternalPRs: 'unavailable',
        releases: 'unavailable',
        reviewRatio: 'unavailable',
        collaborators: 'unavailable',
        activeWeeks: 'unavailable',
        nightCommitRatio: 'unavailable'
      }
    };

    const degradedSpec = await compileIdentitySpec({
      githubUserId: 'octocat', // Username-seeded degraded identity
      telemetry: degradedTelemetry
    });

    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation((...args: any[]) => ({
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM guardians')) {
              return {
                id: 'g-degraded-1',
                user_id: 'u-degraded-1',
                github_user_id: 0,
                name: 'octocat',
                species: degradedSpec.species,
                element: degradedSpec.element,
                rarity_tier: degradedSpec.rarity,
                dna_seed: degradedSpec.dnaSeed,
                reference_sha256: null,
                identity_spec: JSON.stringify(degradedSpec)
              };
            }
            if (query.includes('FROM github_accounts')) {
              return {
                login: 'octocat'
              };
            }
            if (query.includes('FROM guardian_hatch_jobs')) {
              return {
                id: 'job-degraded-1',
                guardian_id: 'g-degraded-1',
                state: 'PENDING',
                model_id: 'nano-banana-pro-preview'
              };
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('UPDATE guardians SET status =')) {
              updatedStatus.push(args[0] || 'QUARANTINED');
            }
            return { meta: { changes: 1 } };
          })
        }))
      })),
      batch: vi.fn().mockImplementation(async (stmts: any[]) => {
        const res: any[] = [];
        for (const s of stmts) {
          if (typeof s?.run === 'function') await s.run();
          res.push({ meta: { changes: 1 }, success: true });
        }
        return res;
      })
    };

    const ackFn = vi.fn();
    const mockBatch = {
      messages: [{
        id: 'msg-deg-1',
        timestamp: new Date(),
        body: { type: 'HATCH_JOB', guardianId: 'g-degraded-1', jobId: 'job-degraded-1' },
        ack: ackFn,
        retry: vi.fn()
      }]
    };

    const validPng = createValidCenteredSubjectPng(256, 256);
    const sampleB64 = Buffer.from(validPng).toString('base64');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: sampleB64 } }] } }]
    }), { status: 200 }));
    const mockBucket = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null)
    };

    const mockEnv: Partial<Env> = {
      DB: mockDb as any,
      ASSETS_BUCKET: mockBucket as any,
      AI_MODEL_TIER: 'nano-banana-pro-preview',
      GEMINI_API_KEY: 'test-key'
    };

    await handleGenerationQueue(mockBatch as any, mockEnv as Env);

    // Assert that the degraded identity passed validation and was NOT quarantined
    expect(updatedStatus).not.toContain('QUARANTINED');
    expect(ackFn).toHaveBeenCalled();
  });
});

describe('Phase 2: Hatch CLI Async Contract Smoke Tests', () => {
  it('executes hatch.mjs compile cleanly without unhandled promises or undefined fields', async () => {
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');

    const testJob = {
      guardianId: 'test-guardian',
      githubUserId: 11829471,
      telemetry: {
        topLanguages: ['TypeScript', 'Rust'],
        stars: 100, forks: 10, publicRepos: 5, followers: 20,
        accountAgeYears: 3, mergedExternalPRs: 2, releases: 1,
        reviewRatio: 0.5, collaborators: 2, activeWeeks: 20, nightCommitRatio: 0.1,
        provenance: {
          topLanguages: 'measured', stars: 'measured', forks: 'measured', publicRepos: 'measured', followers: 'measured',
          accountAgeYears: 'measured', mergedExternalPRs: 'measured', releases: 'measured', reviewRatio: 'measured',
          collaborators: 'measured', activeWeeks: 'measured', nightCommitRatio: 'measured'
        }
      },
      outDir: 'plans/reports'
    };

    const tempJobPath = path.resolve(process.cwd(), 'plans/reports/test-cli-compile-smoke.json');
    fs.writeFileSync(tempJobPath, JSON.stringify(testJob, null, 2));

    try {
      const out = execSync(`node .agents/skills/githoot-hatch/scripts/hatch.mjs compile --job plans/reports/test-cli-compile-smoke.json`, {
        encoding: 'utf8'
      });
      const parsed = JSON.parse(out);
      expect(parsed.identity.species).toBe('neonbyte');
      expect(parsed.identity.identityHash).toMatch(/^[0-9a-f]{64}$/);
      expect(parsed.poses.length).toBe(16);
      expect(parsed.poses[0].promptHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      if (fs.existsSync(tempJobPath)) {
        fs.unlinkSync(tempJobPath);
      }
    }
  });
});
