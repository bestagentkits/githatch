// ============================================================================
// Deploy Provenance, Staging & CI Gates Unit Tests (tests/unit/deploy-provenance.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 7: Deploy Provenance, Staging & CI Gates', () => {
  it('records and verifies single-source bundle provenance hash accurately', async () => {
    // @ts-ignore
    const { recordBundleProvenance, verifyBundleProvenance } = await import('../../scripts/bundle-provenance.mjs');
    const tempWorkerPath = path.resolve(process.cwd(), 'dist-worker/test-artifact.js');
    const tempProvPath = path.resolve(process.cwd(), 'dist-worker/test-prov.json');
    fs.writeFileSync(tempWorkerPath, 'console.log("GitHoot Authoritative Worker");', 'utf8');

    // 1. Record provenance
    const record = recordBundleProvenance('dist-worker/test-artifact.js', 'dist-worker/test-prov.json');
    expect(record.sha256.length).toBe(64);
    expect(record.file).toBe('dist-worker/test-artifact.js');
    expect(record.size).toBeGreaterThan(0);

    // 2. Verify provenance
    const check1 = verifyBundleProvenance('dist-worker/test-artifact.js', 'dist-worker/test-prov.json');
    expect(check1.valid).toBe(true);

    // 3. Mutate file -> verify fails closed
    fs.writeFileSync(tempWorkerPath, 'console.log("Mutated bytes");', 'utf8');
    const check2 = verifyBundleProvenance('dist-worker/test-artifact.js', 'dist-worker/test-prov.json');
    expect(check2.valid).toBe(false);
    expect(check2.error).toContain('PROVENANCE_SHA_MISMATCH');

    // Cleanup temp files
    try {
      fs.unlinkSync(tempWorkerPath);
      fs.unlinkSync(tempProvPath);
    } catch {}
  });

  it('verifyDeployedWorker parses active version ID from wrangler deployments output', async () => {
    // @ts-ignore
    const { verifyDeployedWorker } = await import('../../scripts/bundle-provenance.mjs');
    const mockRunnerSuccess = () => ({
      ok: true,
      output: 'Deployment ID: d9a1c24e-4cd1-4529-901b-cc471f71061a\nVersion(s):  (100%) 4cd17a33-a917-4529-901b-cc471f71061a\nCreated at: 2026-08-31T09:00:00.000Z'
    });

    const res = verifyDeployedWorker('wrangler.worker.toml', 'production', mockRunnerSuccess);
    expect(res.verified).toBe(true);
    expect(res.versionId).toBe('d9a1c24e-4cd1-4529-901b-cc471f71061a');

    const mockRunnerFailure = () => ({
      ok: false,
      output: 'Authentication error: Cloudflare API token invalid'
    });

    const resFail = verifyDeployedWorker('wrangler.worker.toml', 'production', mockRunnerFailure);
    expect(resFail.verified).toBe(false);
    expect(resFail.error).toContain('Failed to query deployments');
  });

  it('secret preflight exits with missing secret list when any required secret is missing', async () => {
    // @ts-ignore
    const { validateEnvironmentSecrets } = await import('../../scripts/secret-preflight.mjs');
    // Missing ADMIN_REVIEW_SECRET and GITHUB_TOKENS
    const partialEnv = {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      GEMINI_API_KEY: 'gem-key',
      AUTH_SECRET: 'auth-sec'
    };

    const res = validateEnvironmentSecrets(partialEnv, 'all');
    expect(res.ok).toBe(false);
    expect(res.missing).toContain('ADMIN_REVIEW_SECRET');
    expect(res.missing).toContain('GITHUB_TOKENS');
    expect(res.missing).toContain('GH_CLIENT_ID');

    // When all required secrets are present
    const fullEnv = {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      GEMINI_API_KEY: 'gem-key',
      AUTH_SECRET: 'auth-sec',
      ADMIN_REVIEW_SECRET: 'admin-sec',
      GITHUB_TOKENS: '["ghp_token1"]',
      GH_CLIENT_ID: 'client-id',
      GH_CLIENT_SECRET: 'client-secret',
      CF_ACCESS_AUD: 'aud-1',
      CF_ACCESS_TEAM_NAME: 'team-1',
      R2_ACCESS_KEY_ID: 'r2-id',
      R2_SECRET_ACCESS_KEY: 'r2-sec',
      R2_BUCKET_NAME: 'githoot'
    };

    const fullRes = validateEnvironmentSecrets(fullEnv, 'all');
    expect(fullRes.ok).toBe(true);
    expect(fullRes.missing.length).toBe(0);
  });

  it('verifies wrangler.worker.toml has single-source main, max_concurrency, and env parity', () => {
    const tomlPath = path.resolve(process.cwd(), 'wrangler.worker.toml');
    expect(fs.existsSync(tomlPath)).toBe(true);
    const content = fs.readFileSync(tomlPath, 'utf8');

    // 1. Single-source main
    expect(content).toContain('main = "dist-worker/index.js"');

    // 2. Queue consumer bounds
    expect(content).toContain('max_concurrency = 2');
    expect(content).toContain('max_batch_size = 1');
    expect(content).toContain('dead_letter_queue = "githoot-ai-dlq"');

    // 3. Cron triggers
    expect(content).toContain('crons = ["* * * * *"]');

    // 4. Parity across production and staging blocks
    expect(content).toContain('[env.production]');
    expect(content).toContain('[env.staging]');
    expect(content).toContain('dead_letter_queue = "githoot-ai-dlq-staging"');
  });

  it('verifies deploy.yml has hard secret preflight, test ordering, no soft-skips, and verify-deployed step', () => {
    const deployYmlPath = path.resolve(process.cwd(), '.github/workflows/deploy.yml');
    expect(fs.existsSync(deployYmlPath)).toBe(true);
    const content = fs.readFileSync(deployYmlPath, 'utf8');

    // 1. Deploy command must use --no-bundle and --env production
    expect(content).toContain('--no-bundle');
    expect(content).toContain('--env production');
    expect(content).toContain('node scripts/secret-preflight.mjs all');
    expect(content).toContain('node scripts/staging-bootstrap.mjs');
    expect(content).toContain('node scripts/bundle-provenance.mjs verify-deployed wrangler.worker.toml production');

    // 2. Strict ordering: build precedes test and deploy
    const buildIdx = content.indexOf('npm run build');
    const unitTestIdx = content.indexOf('npx vitest run tests/unit');
    const workerTestIdx = content.indexOf('npx vitest run --config vitest.workers.config.ts');
    const deployIdx = content.indexOf('deploy dist-worker/index.js');

    expect(buildIdx).toBeGreaterThan(0);
    expect(unitTestIdx).toBeGreaterThan(buildIdx);
    expect(workerTestIdx).toBeGreaterThan(unitTestIdx);
    expect(deployIdx).toBeGreaterThan(workerTestIdx);

    // 3. No soft-skips in secret uploading
    expect(content).not.toContain('[ -n "$GEMINI_API_KEY" ] &&');
    expect(content).not.toContain('[ -n "$AUTH_SECRET" ] &&');
    expect(content).not.toContain('[ -n "$ADMIN_REVIEW_SECRET" ] &&');
    expect(content).not.toContain('[ -n "$GITHUB_TOKENS" ] &&');
  });
});
