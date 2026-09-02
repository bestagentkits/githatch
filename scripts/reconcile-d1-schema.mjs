// ============================================================================
// GitHoot D1 Schema Reconciliation CLI & Automation Tool
// (scripts/reconcile-d1-schema.mjs)
// ============================================================================

import fs from 'fs';
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

export const V2_REQUIRED_COLUMNS = [
  { name: 'dna_version', typeDef: "TEXT DEFAULT 'v1'" },
  { name: 'status', typeDef: "TEXT DEFAULT 'PENDING'" },
  { name: 'species_name', typeDef: 'TEXT' },
  { name: 'anatomy', typeDef: 'TEXT' },
  { name: 'telemetry_snapshot', typeDef: 'TEXT' },
  { name: 'identity_spec', typeDef: 'TEXT' },
  { name: 'reference_sha256', typeDef: 'TEXT' },
  { name: 'request_fingerprint', typeDef: 'TEXT' },
  { name: 'manifest_url', typeDef: 'TEXT' }
];

export function reconcileRemoteDatabase(
  dbName = 'githoot_db_staging',
  configPath = 'wrangler.staging.toml',
  customRunner = null
) {
  console.log(`\n[D1Reconciler] Auditing and reconciling schema on ${dbName} (${configPath || 'default config'})...`);
  const envArg = fs.existsSync('D:/www/oss/githatch/.env') ? '--env-file D:/www/oss/githatch/.env' : '';
  const configArg = configPath ? `--config ${configPath}` : '';

  const runner = customRunner || ((cmd) => {
    try {
      const out = execSync(`npx wrangler ${cmd}`, {
        encoding: 'utf8',
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { ok: true, output: out };
    } catch (err) {
      return { ok: false, output: err.stderr || err.stdout || err.message };
    }
  });

  // 1. Initial inspection
  const infoRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA table_info(guardians);" --json`);
  if (!infoRes.ok) {
    throw new Error(`Failed to query table info from ${dbName}: ${infoRes.output}`);
  }

  const parsed = JSON.parse(infoRes.output);
  const initialCols = new Set((parsed[0]?.results || []).map(r => r.name));
  const added = [];

  // 2. Add missing columns
  for (const col of V2_REQUIRED_COLUMNS) {
    if (!initialCols.has(col.name)) {
      console.log(`[D1Reconciler] Adding missing column "${col.name}" to guardians on ${dbName}...`);
      const alterRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "ALTER TABLE guardians ADD COLUMN ${col.name} ${col.typeDef};"`);
      if (alterRes.ok) {
        added.push(col.name);
      } else {
        console.warn(`[D1Reconciler] ALTER TABLE note for "${col.name}":`, alterRes.output);
      }
    }
  }

  // 3. Ensure required indices exist
  runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status); CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);"`);

  // 4. Strict Fail-Closed Post-Verification: Re-query and assert 100% column parity
  const verifyRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA table_info(guardians);" --json`);
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify post-reconciliation schema on ${dbName}: ${verifyRes.output}`);
  }

  const verifyParsed = JSON.parse(verifyRes.output);
  const verifiedCols = new Set((verifyParsed[0]?.results || []).map(r => r.name));
  const missingCols = V2_REQUIRED_COLUMNS.filter(c => !verifiedCols.has(c.name)).map(c => c.name);

  if (missingCols.length > 0) {
    throw new Error(`D1_SCHEMA_RECONCILIATION_FAILED: Schema on ${dbName} is still missing required columns: [${missingCols.join(', ')}]`);
  }

  console.log(`✓ [D1Reconciler] Strict schema parity verified on ${dbName}. Total columns: ${verifiedCols.size}. Reconciled: ${added.length > 0 ? added.join(', ') : 'none (already in sync)'}`);
  return { ok: true, dbName, totalColumns: verifiedCols.size, added };
}

if (process.argv[1] && process.argv[1].endsWith('reconcile-d1-schema.mjs')) {
  const target = process.argv[2] || 'staging';
  try {
    if (target === 'staging') {
      reconcileRemoteDatabase('githoot_db_staging', 'wrangler.staging.toml');
    } else if (target === 'prod' || target === 'production') {
      reconcileRemoteDatabase('githoot_db', '');
    } else if (target === 'all') {
      reconcileRemoteDatabase('githoot_db_staging', 'wrangler.staging.toml');
      reconcileRemoteDatabase('githoot_db', '');
    }
  } catch (err) {
    console.error('❌ Reconciliation failed:', err.message);
    process.exit(1);
  }
}
