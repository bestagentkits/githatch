// ============================================================================
// GitHoot D1 Schema Reconciliation & Audit CLI
// (scripts/reconcile-d1-schema.mjs)
// Fail-Closed Schema Verification and Drift Repair Across All Environments
// ============================================================================

import fs from 'fs';
import { execSync } from 'child_process';
import {
  REQUIRED_V2_TABLES,
  GUARDIAN_CANONICAL_COLUMNS,
  GUARDIAN_REQUIRED_COLUMNS,
  REQUIRED_CANONICAL_INDEXES,
  REQUIRED_UNIQUE_CONSTRAINTS,
  validateGuardianColumns
} from '../src/server/db/schema-guard.ts';

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

export function auditAndReconcileDatabase(
  dbName = 'githoot_db_staging',
  configPath = 'wrangler.staging.toml',
  customRunner = null
) {
  console.log(`\n[D1Reconciler] Auditing schema on ${dbName} (${configPath || 'default config'})...`);
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

  // 1. Audit Required Tables
  const tableRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "SELECT name FROM sqlite_master WHERE type='table';" --json`);
  if (!tableRes.ok) {
    throw new Error(`Failed to query tables on ${dbName}: ${tableRes.output}`);
  }

  const parsedTables = JSON.parse(tableRes.output);
  const existingTables = new Set(((parsedTables[0]?.results || []).map(r => r.name)));
  const missingTables = REQUIRED_V2_TABLES.filter(t => !existingTables.has(t));

  if (missingTables.length > 0) {
    throw new Error(`D1_SCHEMA_AUDIT_FAILED: Missing required tables on ${dbName}: [${missingTables.join(', ')}]`);
  }

  // 2. Audit Guardians Columns via shared central validator
  const infoRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA table_info(guardians);" --json`);
  if (!infoRes.ok) {
    throw new Error(`Failed to query table info from ${dbName}: ${infoRes.output}`);
  }

  const parsedCols = JSON.parse(infoRes.output);
  const initialCols = new Set((parsedCols[0]?.results || []).map(r => r.name));
  const added = [];

  const v2Cols = GUARDIAN_REQUIRED_COLUMNS.filter(c => [
    'dna_version', 'status', 'species_name', 'anatomy', 'telemetry_snapshot',
    'identity_spec', 'reference_sha256', 'request_fingerprint', 'manifest_url'
  ].includes(c.name));

  for (const col of v2Cols) {
    if (!initialCols.has(col.name)) {
      console.log(`[D1Reconciler] Adding missing column "${col.name}" to guardians on ${dbName}...`);
      const alterRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "ALTER TABLE guardians ADD COLUMN ${col.name} ${col.typeDef};"`);
      if (alterRes.ok) {
        added.push(col.name);
      } else {
        throw new Error(`D1_SCHEMA_ALTER_FAILED: Failed to add column ${col.name} on ${dbName}: ${alterRes.output}`);
      }
    }
  }

  // Ensure required indexes exist
  const idxCreateRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status); CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256); CREATE INDEX IF NOT EXISTS idx_guardians_gh_id ON guardians(github_user_id);"`);
  if (!idxCreateRes.ok) {
    throw new Error(`D1_INDEX_CREATION_FAILED: Failed to create indexes on ${dbName}: ${idxCreateRes.output}`);
  }

  // 3. Strict Fail-Closed Post-Verification of Columns, Types, Defaults & PK via shared validator
  const verifyRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA table_info(guardians);" --json`);
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify post-reconciliation schema on ${dbName}: ${verifyRes.output}`);
  }

  const verifyParsed = JSON.parse(verifyRes.output);
  const verifyResults = (verifyParsed[0]?.results || []);
  const colMap = new Map();
  for (const r of verifyResults) {
    colMap.set(r.name, r);
  }

  const { missingCols, constraintDrifts } = validateGuardianColumns(colMap);

  if (missingCols.length > 0) {
    throw new Error(`D1_SCHEMA_RECONCILIATION_FAILED: Guardians table on ${dbName} is missing columns: [${missingCols.join(', ')}]`);
  }

  if (constraintDrifts.length > 0) {
    throw new Error(`D1_SCHEMA_RECONCILIATION_FAILED: Guardians table on ${dbName} has constraint/type drift: [${constraintDrifts.join('; ')}]`);
  }

  // 4. Strict Fail-Closed Index & Indexed Columns Verification
  const idxListRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA index_list(guardians);" --json`);
  if (!idxListRes.ok) {
    throw new Error(`Failed to query indexes on ${dbName}: ${idxListRes.output}`);
  }
  const parsedIdxList = JSON.parse(idxListRes.output);
  const indexRows = (parsedIdxList[0]?.results || []);
  const existingIdxMap = new Map();
  for (const idx of indexRows) {
    existingIdxMap.set(idx.name, idx);
  }

  const indexDrifts = [];
  for (const expIdx of REQUIRED_CANONICAL_INDEXES) {
    if (!existingIdxMap.has(expIdx.name)) {
      indexDrifts.push(`Missing required index ${expIdx.name} on ${expIdx.table}`);
      continue;
    }

    const infoRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA index_info(${expIdx.name});" --json`);
    if (!infoRes.ok) {
      indexDrifts.push(`Failed to query index_info for ${expIdx.name}: ${infoRes.output}`);
      continue;
    }
    const infoParsed = JSON.parse(infoRes.output);
    const colRows = (infoParsed[0]?.results || []);
    const actualCols = colRows.map(r => r.name);
    const isExactMatch = actualCols.length === expIdx.columns.length &&
      expIdx.columns.every((c, i) => actualCols[i] === c);

    if (!isExactMatch) {
      indexDrifts.push(`Index ${expIdx.name} column mismatch: expected [${expIdx.columns.join(', ')}], got [${actualCols.join(', ')}]`);
    }

    if (expIdx.unique !== undefined && (existingIdxMap.get(expIdx.name)?.unique === 1) !== expIdx.unique) {
      indexDrifts.push(`Index ${expIdx.name} uniqueness mismatch: expected unique=${expIdx.unique}`);
    }
  }

  // 5. Verify contractual UNIQUE constraints
  const uniqueIndexes = indexRows.filter(i => i.unique === 1);
  for (const expUnique of REQUIRED_UNIQUE_CONSTRAINTS) {
    if (expUnique.table === 'guardians') {
      let uniqueSatisfied = false;
      for (const uIdx of uniqueIndexes) {
        const uInfoRes = runner(`d1 execute ${dbName} --remote ${configArg} ${envArg} --command "PRAGMA index_info(${uIdx.name});" --json`);
        if (uInfoRes.ok) {
          const uInfoParsed = JSON.parse(uInfoRes.output);
          const uColRows = (uInfoParsed[0]?.results || []);
          const uActualCols = uColRows.map(r => r.name);
          if (
            uActualCols.length === expUnique.columns.length &&
            expUnique.columns.every((c, idx) => uActualCols[idx] === c)
          ) {
            uniqueSatisfied = true;
            break;
          }
        }
      }
      if (!uniqueSatisfied) {
        indexDrifts.push(`Table ${expUnique.table} is missing required UNIQUE constraint/index over columns [${expUnique.columns.join(', ')}]`);
      }
    }
  }

  if (indexDrifts.length > 0) {
    throw new Error(`D1_SCHEMA_AUDIT_FAILED: Index definition drift on ${dbName}: [${indexDrifts.join('; ')}]`);
  }

  console.log(`✓ [D1Reconciler] Strict schema parity verified on ${dbName}. Total tables: ${existingTables.size}, Total columns: ${verifyResults.length}. Reconciled: ${added.length > 0 ? added.join(', ') : 'none (already in sync)'}`);
  return { ok: true, dbName, totalTables: existingTables.size, totalColumns: verifyResults.length, added };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('reconcile-d1-schema.mjs')) {
  const target = process.argv[2] || 'staging';
  try {
    if (target === 'staging') {
      auditAndReconcileDatabase('githoot_db_staging', 'wrangler.staging.toml');
    } else if (target === 'prod' || target === 'production') {
      auditAndReconcileDatabase('githoot_db', '');
    } else if (target === 'all') {
      auditAndReconcileDatabase('githoot_db_staging', 'wrangler.staging.toml');
      auditAndReconcileDatabase('githoot_db', '');
    } else {
      console.error(`❌ Unknown target "${target}". Must be "staging", "prod", or "all".`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Schema audit/reconciliation failed:', err.message);
    process.exit(1);
  }
}
