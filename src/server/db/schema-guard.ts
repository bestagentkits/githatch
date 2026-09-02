// ============================================================================
// GitHoot D1 Schema Guard & Idempotent Drift Reconciler
// (src/server/db/schema-guard.ts)
// ============================================================================



export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export const GUARDIAN_V2_COLUMNS: Array<{ name: string; typeDef: string }> = [
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

/**
 * Inspects guardians table schema and idempotently reconciles any drifted/missing columns.
 * Prevents runtime SQLITE_ERROR "no such column: species_name" across all environments.
 */
export async function reconcileGuardiansSchema(db: any): Promise<{
  reconciled: boolean;
  addedColumns: string[];
  totalColumnsCount: number;
}> {
  if (!db) {
    return { reconciled: false, addedColumns: [], totalColumnsCount: 0 };
  }

  try {
    const tableInfo = await db.prepare("PRAGMA table_info(guardians);").all();
    const results = (tableInfo.results || []) as ColumnInfo[];
    const existingNames = new Set(results.map((r: ColumnInfo) => r.name));
    const addedColumns: string[] = [];

    for (const col of GUARDIAN_V2_COLUMNS) {
      if (!existingNames.has(col.name)) {
        await db.prepare(`ALTER TABLE guardians ADD COLUMN ${col.name} ${col.typeDef};`).run();
        addedColumns.push(col.name);
        existingNames.add(col.name);
      }
    }

    // Ensure required indices exist
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_status ON guardians(status);").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_guardians_ref_sha ON guardians(reference_sha256);").run();

    return {
      reconciled: addedColumns.length > 0,
      addedColumns,
      totalColumnsCount: existingNames.size
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SchemaGuard] Schema reconciliation warning:', msg);
    return { reconciled: false, addedColumns: [], totalColumnsCount: 0 };
  }
}
