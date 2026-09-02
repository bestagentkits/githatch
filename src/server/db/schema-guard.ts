// ============================================================================
// GitHoot D1 Schema Guard & Invariant Verifier
// (src/server/db/schema-guard.ts)
// Strict Fail-Closed Schema Verification Across All Environments
// ============================================================================

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export const REQUIRED_V2_TABLES = [
  'users',
  'github_accounts',
  'guardians',
  'early_access_slots',
  'github_token_pool',
  'activity_ledger',
  'guardian_reference_candidates',
  'guardian_hatch_jobs',
  'guardian_hatch_frames',
  'ai_budget_ledger',
  'guardian_pose_attempts',
  'guardian_outbox',
  'guardian_budget_reservations',
  'guardian_dlq_quarantine',
  'guardian_publication',
  'guardian_review_records',
  'github_aggregate_stats'
];

export const GUARDIAN_REQUIRED_COLUMNS: Array<{ name: string; typeDef: string }> = [
  { name: 'id', typeDef: 'TEXT PRIMARY KEY' },
  { name: 'user_id', typeDef: 'TEXT NOT NULL' },
  { name: 'github_user_id', typeDef: 'INTEGER UNIQUE NOT NULL' },
  { name: 'name', typeDef: 'TEXT NOT NULL' },
  { name: 'egg_type', typeDef: 'TEXT NOT NULL' },
  { name: 'species', typeDef: 'TEXT NOT NULL' },
  { name: 'species_name', typeDef: 'TEXT' },
  { name: 'anatomy', typeDef: 'TEXT' },
  { name: 'element', typeDef: 'TEXT NOT NULL' },
  { name: 'dna_seed', typeDef: 'TEXT NOT NULL' },
  { name: 'dna_version', typeDef: "TEXT DEFAULT 'v1'" },
  { name: 'rarity_tier', typeDef: 'TEXT NOT NULL' },
  { name: 'status', typeDef: "TEXT DEFAULT 'PENDING'" },
  { name: 'hero_image_url', typeDef: 'TEXT NOT NULL' },
  { name: 'spritesheet_url', typeDef: 'TEXT' },
  { name: 'traits', typeDef: 'TEXT NOT NULL' },
  { name: 'telemetry_snapshot', typeDef: 'TEXT' },
  { name: 'identity_spec', typeDef: 'TEXT' },
  { name: 'reference_sha256', typeDef: 'TEXT' },
  { name: 'request_fingerprint', typeDef: 'TEXT' },
  { name: 'manifest_url', typeDef: 'TEXT' },
  { name: 'level', typeDef: 'INTEGER DEFAULT 1' },
  { name: 'experience', typeDef: 'INTEGER DEFAULT 0' },
  { name: 'energy_state', typeDef: "TEXT DEFAULT 'Active'" },
  { name: 'created_at', typeDef: 'INTEGER NOT NULL' }
];
const verifiedDatabases = new WeakSet<object>();

/**
 * Asserts database schema readiness fail-closed.
 * Tracks verification per DB object instance using WeakSet to prevent cross-database pollution.
 * Throws SCHEMA_INVARIANT_VIOLATION if any required table or column is missing.
 */
export async function assertDatabaseSchemaReady(db: any): Promise<{
  ready: boolean;
  tablesCount: number;
  columnsCount: number;
}> {
  if (!db || typeof db !== 'object') {
    throw new Error('SCHEMA_INVARIANT_VIOLATION: Database binding is null or undefined');
  }

  if (verifiedDatabases.has(db)) {
    return { ready: true, tablesCount: REQUIRED_V2_TABLES.length, columnsCount: GUARDIAN_REQUIRED_COLUMNS.length };
  }
  const tableQuery = await db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
  const existingTables = new Set(((tableQuery.results || []) as Array<{ name: string }>).map(r => r.name));
  const missingTables = REQUIRED_V2_TABLES.filter(t => !existingTables.has(t));

  if (missingTables.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Database is missing required tables: [${missingTables.join(', ')}]`);
  }

  // 2. Verify guardians table columns
  const colQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const existingCols = new Set(((colQuery.results || []) as ColumnInfo[]).map(r => r.name));
  const missingCols = GUARDIAN_REQUIRED_COLUMNS.filter(c => !existingCols.has(c.name)).map(c => c.name);

  if (missingCols.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Guardians table is missing required columns: [${missingCols.join(', ')}]`);
  }

  verifiedDatabases.add(db);
  return {
    ready: true,
    tablesCount: existingTables.size,
    columnsCount: existingCols.size
  };
}

/**
 * Reconciles guardians table schema if any V2 columns are missing (defense-in-depth/recovery).
 * Throws fail-closed if any column cannot be added or verified.
 */
export async function reconcileGuardiansSchema(db: any): Promise<{
  reconciled: boolean;
  addedColumns: string[];
  totalColumnsCount: number;
}> {
  if (!db) {
    throw new Error('SCHEMA_INVARIANT_VIOLATION: Database binding is null or undefined');
  }

  const colQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const existingCols = new Set(((colQuery.results || []) as ColumnInfo[]).map(r => r.name));
  const addedColumns: string[] = [];

  const v2ColsToAdd = GUARDIAN_REQUIRED_COLUMNS.filter(c => [
    'dna_version', 'status', 'species_name', 'anatomy', 'telemetry_snapshot',
    'identity_spec', 'reference_sha256', 'request_fingerprint', 'manifest_url'
  ].includes(c.name));

  for (const col of v2ColsToAdd) {
    if (!existingCols.has(col.name)) {
      const res = await db.prepare(`ALTER TABLE guardians ADD COLUMN ${col.name} ${col.typeDef};`).run();
      if (res && res.success === false) {
        throw new Error(`SCHEMA_RECONCILIATION_FAILED: Failed to add column ${col.name}`);
      }
      addedColumns.push(col.name);
      existingCols.add(col.name);
    }
  }

  if (addedColumns.length > 0) {
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status);").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);").run();
  }

  // Strict post-verification
  const verifyQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const verifiedCols = new Set(((verifyQuery.results || []) as ColumnInfo[]).map(r => r.name));
  const stillMissing = GUARDIAN_REQUIRED_COLUMNS.filter(c => !verifiedCols.has(c.name)).map(c => c.name);

  if (stillMissing.length > 0) {
    throw new Error(`SCHEMA_RECONCILIATION_FAILED: Guardians table is still missing columns after reconciliation: [${stillMissing.join(', ')}]`);
  }

  return {
    reconciled: addedColumns.length > 0,
    addedColumns,
    totalColumnsCount: verifiedCols.size
  };
}
