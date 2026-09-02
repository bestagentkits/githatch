// ============================================================================
// GitHoot Single-Source Bundle Provenance Recorder & Verifier
// (scripts/bundle-provenance.mjs)
// ============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

function loadLocalEnv() {
  const envPath = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadLocalEnv();

/**
 * Computes SHA-256 and byte length of a file.
 * @param {string} filePath
 * @returns {{ sha256: string, size: number }}
 */
export function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for provenance calculation: ${filePath}`);
  }
  const bytes = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  return { sha256: hash, size: bytes.length };
}

/**
 * Records bundle provenance metadata to a JSON file.
 * @param {string} distWorkerPath
 * @param {string} outProvenancePath
 * @returns {{ file: string, sha256: string, size: number, builtAt: number }}
 */
export function recordBundleProvenance(
  distWorkerPath = 'dist-worker/index.js',
  outProvenancePath = 'dist-worker/provenance.json'
) {
  const absWorkerPath = path.resolve(process.cwd(), distWorkerPath);
  const absOutPath = path.resolve(process.cwd(), outProvenancePath);

  const { sha256, size } = computeFileSha256(absWorkerPath);
  const record = {
    file: distWorkerPath,
    sha256,
    size,
    builtAt: Date.now()
  };

  const outDir = path.dirname(absOutPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(absOutPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`[Provenance] Recorded authoritative bundle provenance for ${distWorkerPath} (SHA-256: ${sha256})`);
  return record;
}

/**
 * Verifies that the local on-disk bundle matches recorded provenance.
 * @param {string} distWorkerPath
 * @param {string} provenancePath
 * @returns {{ valid: boolean, error?: string, record?: { file: string, sha256: string, size: number, builtAt: number } }}
 */
export function verifyBundleProvenance(
  distWorkerPath = 'dist-worker/index.js',
  provenancePath = 'dist-worker/provenance.json'
) {
  const absWorkerPath = path.resolve(process.cwd(), distWorkerPath);
  const absProvPath = path.resolve(process.cwd(), provenancePath);

  if (!fs.existsSync(absProvPath)) {
    return { valid: false, error: `Provenance file missing at ${provenancePath}` };
  }

  const rawJson = fs.readFileSync(absProvPath, 'utf8');
  const record = JSON.parse(rawJson);

  const { sha256 } = computeFileSha256(absWorkerPath);
  if (sha256 !== record.sha256) {
    return {
      valid: false,
      error: `PROVENANCE_SHA_MISMATCH: Live file SHA (${sha256}) does not match recorded provenance (${record.sha256})`
    };
  }

  return { valid: true, record };
}

/**
 * Queries Cloudflare to verify the deployed Worker version matches live deployment metadata.
 * @param {string} configPath
 * @param {string} envName
 * @param {(cmd: string) => { ok: boolean, output: string }} [customRunner]
 * @returns {{ verified: boolean, versionId?: string, error?: string }}
 */
export function verifyDeployedWorker(
  configPath = 'wrangler.worker.toml',
  envName = 'production',
  expectedVersionId = null,
  customRunner = null
) {
  // Allow passing customRunner as 3rd arg if expectedVersionId is a function
  let expected = expectedVersionId;
  let runnerFn = customRunner;
  if (typeof expectedVersionId === 'function') {
    runnerFn = expectedVersionId;
    expected = null;
  }

  const runner = runnerFn || ((cmd) => {
    try {
      const out = execSync(`npx wrangler ${cmd}`, { encoding: 'utf8', env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
      return { ok: true, output: out };
    } catch (err) {
      return { ok: false, output: err.stderr || err.stdout || err.message };
    }
  });

  const cmd = `deployments list --config ${configPath} --env ${envName}`;
  const res = runner(cmd);

  if (!res.ok) {
    return { verified: false, error: `Failed to query deployments from Cloudflare: ${res.output}` };
  }

  const output = res.output;
  // Parse all Version IDs from wrangler deployments list output (newest is at the end)
  const versionRegex = /Version\(s\):\s*\(\d+%\)\s*([a-f0-9-]{36})/gi;
  const allMatches = [];
  let match;
  while ((match = versionRegex.exec(output)) !== null) {
    allMatches.push(match[1]);
  }

  // Fallback if Version(s) format differs: scan all UUIDs
  if (allMatches.length === 0) {
    const uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi;
    while ((match = uuidRegex.exec(output)) !== null) {
      allMatches.push(match[1]);
    }
  }

  if (allMatches.length === 0) {
    return { verified: false, error: `Could not parse active deployed Version ID from deployments output: ${output}` };
  }

  // Active/latest version is the last deployment in the chronological list
  const versionId = allMatches[allMatches.length - 1];

  if (expected && expected.trim() !== '') {
    if (versionId !== expected.trim()) {
      return {
        verified: false,
        versionId,
        error: `PROVENANCE_VERSION_MISMATCH: Live active Version ID (${versionId}) does not match expected deployed Version ID (${expected.trim()})`
      };
    }
  }

  console.log(`[Provenance] Verified live deployed Worker on environment "${envName}" (Version ID: ${versionId})`);
  return { verified: true, versionId };
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('bundle-provenance.mjs')) {
  const action = process.argv[2] || 'record';
  if (action === 'record') {
    recordBundleProvenance();
  } else if (action === 'verify') {
    const res = verifyBundleProvenance();
    if (!res.valid) {
      console.error('[Provenance] Verification failed:', res.error);
      process.exit(1);
    }
    console.log('[Provenance] Verified bundle matches recorded SHA-256:', res.record?.sha256);
  } else if (action === 'verify-deployed') {
    const configPath = process.argv[3] || 'wrangler.worker.toml';
    const envName = process.argv[4] || 'production';
    const expectedVersion = process.argv[5] || null;
    const res = verifyDeployedWorker(configPath, envName, expectedVersion);
    if (!res.verified) {
      console.error('[Provenance] Live deploy verification failed:', res.error);
      process.exit(1);
    }
    console.log(`[Provenance] Successfully verified live deployment (${res.versionId})`);
  }
}
