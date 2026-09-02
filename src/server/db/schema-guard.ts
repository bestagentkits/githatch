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

export interface ColumnExpectation {
  name: string;
  type: 'TEXT' | 'INTEGER';
  notnull: boolean;
  dflt_value: string | null;
  pk?: boolean;
}

export interface IndexExpectation {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
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

export const GUARDIAN_CANONICAL_COLUMNS: ColumnExpectation[] = [
  { name: 'id', type: 'TEXT', notnull: false, pk: true, dflt_value: null },
  { name: 'user_id', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'github_user_id', type: 'INTEGER', notnull: true, pk: false, dflt_value: null },
  { name: 'name', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'egg_type', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'species', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'species_name', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'anatomy', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'element', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'dna_seed', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'dna_version', type: 'TEXT', notnull: false, pk: false, dflt_value: 'v1' },
  { name: 'rarity_tier', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'status', type: 'TEXT', notnull: false, pk: false, dflt_value: 'PENDING' },
  { name: 'hero_image_url', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'spritesheet_url', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'traits', type: 'TEXT', notnull: true, pk: false, dflt_value: null },
  { name: 'telemetry_snapshot', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'identity_spec', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'reference_sha256', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'request_fingerprint', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'manifest_url', type: 'TEXT', notnull: false, pk: false, dflt_value: null },
  { name: 'level', type: 'INTEGER', notnull: false, pk: false, dflt_value: '1' },
  { name: 'experience', type: 'INTEGER', notnull: false, pk: false, dflt_value: '0' },
  { name: 'energy_state', type: 'TEXT', notnull: false, pk: false, dflt_value: 'Active' },
  { name: 'created_at', type: 'INTEGER', notnull: true, pk: false, dflt_value: null }
];

export const REQUIRED_UNIQUE_CONSTRAINTS: Array<{ table: string; columns: string[] }> = [
  { table: 'guardians', columns: ['github_user_id'] }
];

export const REQUIRED_CANONICAL_INDEXES: IndexExpectation[] = [
  { name: 'idx_guardians_status', table: 'guardians', columns: ['status'], unique: false },
  { name: 'idx_guardians_ref_sha', table: 'guardians', columns: ['reference_sha256'], unique: false },
  { name: 'idx_guardians_gh_id', table: 'guardians', columns: ['github_user_id'] }
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

export function normalizeDefaultValue(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Shared central validator for guardians table columns, types, nullability, defaults, and PK.
 * Enforces exact declared type equality (TEXT === TEXT, INTEGER === INTEGER).
 */
export function validateGuardianColumns(colMap: Map<string, ColumnInfo>): {
  missingCols: string[];
  constraintDrifts: string[];
} {
  const missingCols: string[] = [];
  const constraintDrifts: string[] = [];

  for (const expected of GUARDIAN_CANONICAL_COLUMNS) {
    const actual = colMap.get(expected.name);
    if (!actual) {
      missingCols.push(expected.name);
      continue;
    }

    // Exact declared type equality (TEXT === TEXT, INTEGER === INTEGER)
    const normalizedActualType = (actual.type || '').trim().toUpperCase();
    if (normalizedActualType !== expected.type) {
      constraintDrifts.push(`Column ${expected.name} type mismatch: expected ${expected.type}, got ${actual.type}`);
    }

    // Primary key check
    if (expected.pk && !actual.pk) {
      constraintDrifts.push(`Column ${expected.name} must be primary key`);
    }

    // NOT NULL constraint check
    if (expected.notnull && actual.notnull === 0) {
      constraintDrifts.push(`Column ${expected.name} must have NOT NULL constraint`);
    }

    // Strict Default value check for all columns
    const normalizedActualDefault = normalizeDefaultValue(actual.dflt_value);
    if (expected.dflt_value === null) {
      if (normalizedActualDefault !== null) {
        constraintDrifts.push(`Column ${expected.name} must not have a default value, got '${actual.dflt_value}'`);
      }
    } else {
      if (normalizedActualDefault !== expected.dflt_value) {
        constraintDrifts.push(`Column ${expected.name} default mismatch: expected '${expected.dflt_value}', got '${actual.dflt_value}'`);
      }
    }
  }

  return { missingCols, constraintDrifts };
}

const verifiedDatabases = new WeakSet<object>();

/**
 * Asserts database schema readiness fail-closed.
 * Tracks verification per DB object instance using WeakSet to prevent cross-database pollution.
 * Throws SCHEMA_INVARIANT_VIOLATION if any required table, column, type, constraint, default, or index is missing/drifted.
 */
export async function assertDatabaseSchemaReady(db: any): Promise<{
  ready: boolean;
  tablesCount: number;
  columnsCount: number;
}> {
  if (!db || typeof db !== 'object' || typeof db.prepare !== 'function') {
    throw new Error('SCHEMA_INVARIANT_VIOLATION: Database binding is null, undefined, or missing prepare() method');
  }

  if (verifiedDatabases.has(db)) {
    return { ready: true, tablesCount: REQUIRED_V2_TABLES.length, columnsCount: GUARDIAN_CANONICAL_COLUMNS.length };
  }

  // 1. Verify required tables exist
  const tableQuery = await db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();
  const existingTables = new Set(((tableQuery.results || []) as Array<{ name: string }>).map(r => r.name));
  const missingTables = REQUIRED_V2_TABLES.filter(t => !existingTables.has(t));

  if (missingTables.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Database is missing required tables: [${missingTables.join(', ')}]`);
  }

  // 2. Verify guardians table columns, types, nullability, defaults, and PK via shared validator
  const colQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const results = (colQuery.results || []) as ColumnInfo[];
  const colMap = new Map<string, ColumnInfo>();
  for (const r of results) {
    colMap.set(r.name, r);
  }

  const { missingCols, constraintDrifts } = validateGuardianColumns(colMap);

  if (missingCols.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Guardians table is missing required columns: [${missingCols.join(', ')}]`);
  }

  if (constraintDrifts.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Guardians table has constraint/type drift: [${constraintDrifts.join('; ')}]`);
  }

  // 3. Verify required indexes exist and inspect exact ordered columns via PRAGMA index_info
  const idxListQuery = await db.prepare("PRAGMA index_list(guardians);").all();
  const indexRows = (idxListQuery.results || []) as Array<{ seq: number; name: string; unique: number; origin: string; partial: number }>;
  const existingIndexMap = new Map<string, { unique: boolean }>();
  for (const idx of indexRows) {
    existingIndexMap.set(idx.name, { unique: idx.unique === 1 });
  }

  const indexDrifts: string[] = [];
  for (const expIdx of REQUIRED_CANONICAL_INDEXES) {
    if (expIdx.table === 'guardians') {
      const idxEntry = existingIndexMap.get(expIdx.name);
      if (!idxEntry) {
        indexDrifts.push(`Missing required index: ${expIdx.name} on table guardians`);
        continue;
      }

      // Query exact ordered columns via PRAGMA index_info
      const infoQuery = await db.prepare(`PRAGMA index_info(${expIdx.name});`).all();
      const colRows = (infoQuery.results || []) as Array<{ seqno: number; cid: number; name: string }>;
      const actualCols = colRows.map(r => r.name);

      const isExactMatch = actualCols.length === expIdx.columns.length &&
        expIdx.columns.every((c, i) => actualCols[i] === c);

      if (!isExactMatch) {
        indexDrifts.push(`Index ${expIdx.name} column mismatch: expected [${expIdx.columns.join(', ')}], got [${actualCols.join(', ')}]`);
      }

      // Uniqueness assertion
      if (expIdx.unique !== undefined && idxEntry.unique !== expIdx.unique) {
        indexDrifts.push(`Index ${expIdx.name} uniqueness mismatch: expected unique=${expIdx.unique}, got unique=${idxEntry.unique}`);
      }
    }
  }

  // 4. Verify contractual UNIQUE constraints (name-independent: inspect all unique=1 indexes)
  const uniqueIndexes = indexRows.filter(i => i.unique === 1);
  for (const expUnique of REQUIRED_UNIQUE_CONSTRAINTS) {
    if (expUnique.table === 'guardians') {
      let uniqueSatisfied = false;
      for (const uIdx of uniqueIndexes) {
        const uInfoQuery = await db.prepare(`PRAGMA index_info(${uIdx.name});`).all();
        const uColRows = (uInfoQuery.results || []) as Array<{ seqno: number; cid: number; name: string }>;
        const uActualCols = uColRows.map(r => r.name);
        if (
          uActualCols.length === expUnique.columns.length &&
          expUnique.columns.every((c, idx) => uActualCols[idx] === c)
        ) {
          uniqueSatisfied = true;
          break;
        }
      }
      if (!uniqueSatisfied) {
        indexDrifts.push(`Table ${expUnique.table} is missing required UNIQUE constraint/index over columns [${expUnique.columns.join(', ')}]`);
      }
    }
  }

  if (indexDrifts.length > 0) {
    throw new Error(`SCHEMA_INVARIANT_VIOLATION: Database has index definition drift: [${indexDrifts.join('; ')}]`);
  }

  verifiedDatabases.add(db);
  return {
    ready: true,
    tablesCount: existingTables.size,
    columnsCount: results.length
  };
}

/**
 * Reconciles guardians table schema if any V2 columns or indexes are missing (defense-in-depth/recovery).
 * Throws fail-closed if any column or index cannot be added or verified.
 */
export async function reconcileGuardiansSchema(db: any): Promise<{
  reconciled: boolean;
  addedColumns: string[];
  totalColumnsCount: number;
}> {
  if (!db || typeof db !== 'object' || typeof db.prepare !== 'function') {
    throw new Error('SCHEMA_INVARIANT_VIOLATION: Database binding is null, undefined, or missing prepare() method');
  }

  const colQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const results = (colQuery.results || []) as ColumnInfo[];
  const existingCols = new Set(results.map(r => r.name));
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

  // Ensure required indexes exist
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status);").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_gh_id ON guardians(github_user_id);").run();

  // Strict post-verification
  const verifyQuery = await db.prepare("PRAGMA table_info(guardians);").all();
  const verifyResults = (verifyQuery.results || []) as ColumnInfo[];
  const verifiedCols = new Set(verifyResults.map(r => r.name));
  const stillMissing = GUARDIAN_CANONICAL_COLUMNS.filter(c => !verifiedCols.has(c.name)).map(c => c.name);

  if (stillMissing.length > 0) {
    throw new Error(`SCHEMA_RECONCILIATION_FAILED: Guardians table is still missing columns after reconciliation: [${stillMissing.join(', ')}]`);
  }

  return {
    reconciled: addedColumns.length > 0,
    addedColumns,
    totalColumnsCount: verifyResults.length
  };
}
