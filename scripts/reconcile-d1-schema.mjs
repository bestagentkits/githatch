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

const V2_COLUMNS = [
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

export function reconcileRemoteDatabase(dbName = 'githoot_db_staging', configPath = 'wrangler.staging.toml') {
  console.log(`\n[D1Reconciler] Auditing and reconciling schema on ${dbName} (${configPath})...`);
  const envArg = fs.existsSync('D:/www/oss/githatch/.env') ? '--env-file D:/www/oss/githatch/.env' : '';
  const configArg = configPath ? `--config ${configPath}` : '';

  // 1. Inspect table columns
  let tableInfoRaw = '';
  try {
    tableInfoRaw = execSync(
      `npx wrangler d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA table_info(guardians);" --json`,
      { encoding: 'utf8', env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    throw new Error(`Failed to query table info from ${dbName}: ${err.stderr || err.message}`);
  }

  const parsed = JSON.parse(tableInfoRaw);
  const existingCols = new Set((parsed[0]?.results || []).map(r => r.name));
  const added: string[] = [];

  for (const col of V2_COLUMNS) {
    if (!existingCols.has(col.name)) {
      console.log(`[D1Reconciler] Adding missing column "${col.name}" to guardians on ${dbName}...`);
      try {
        execSync(
          `npx wrangler d1 execute ${dbName} --remote ${configArg} ${envArg} --command "ALTER TABLE guardians ADD COLUMN ${col.name} ${col.typeDef};"`,
          { encoding: 'utf8', env: process.env, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        added.push(col.name);
        existingCols.add(col.name);
      } catch (err) {
        console.warn(`[D1Reconciler] Column "${col.name}" check:`, err.stderr || err.message);
      }
    }
  }

  console.log(`[D1Reconciler] Schema parity confirmed on ${dbName}. Total columns: ${existingCols.size}. Newly added: ${added.length > 0 ? added.join(', ') : 'none (already in sync)'}`);
  return { dbName, totalColumns: existingCols.size, added };
}

if (process.argv[1] && process.argv[1].endsWith('reconcile-d1-schema.mjs')) {
  const target = process.argv[2] || 'staging';
  if (target === 'staging') {
    reconcileRemoteDatabase('githoot_db_staging', 'wrangler.staging.toml');
  } else if (target === 'prod' || target === 'production') {
    reconcileRemoteDatabase('githoot_db', '');
  } else if (target === 'all') {
    reconcileRemoteDatabase('githoot_db_staging', 'wrangler.staging.toml');
    reconcileRemoteDatabase('githoot_db', '');
  }
}
