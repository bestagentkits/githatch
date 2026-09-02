// ============================================================================
// D1 Schema Migration Tests (tests/unit/d1-schema-migration.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('D1 Database Migrations', () => {
  it('0001_initial.sql exists and has valid table creation statements', () => {
    const p = path.join(process.cwd(), 'src', 'server', 'db', 'migrations', '0001_initial.sql');
    expect(fs.existsSync(p)).toBe(true);
    const sql = fs.readFileSync(p, 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guardians');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS early_access_slots');
  });

  it('0002_hatch_pipeline_v2.sql exists and adds required columns and tables', () => {
    const p = path.join(process.cwd(), 'src', 'server', 'db', 'migrations', '0002_hatch_pipeline_v2.sql');
    expect(fs.existsSync(p)).toBe(true);
    const sql = fs.readFileSync(p, 'utf8');
    expect(sql).toContain('ALTER TABLE guardians ADD COLUMN dna_version');
    expect(sql).toContain('ALTER TABLE guardians ADD COLUMN status');
    expect(sql).toContain('ALTER TABLE guardians ADD COLUMN reference_sha256');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guardian_reference_candidates');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guardian_hatch_jobs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS guardian_hatch_frames');
  });

  it('master schema.sql is in sync with migrations', () => {
    const p = path.join(process.cwd(), 'src', 'server', 'db', 'schema.sql');
    expect(fs.existsSync(p)).toBe(true);
    const sql = fs.readFileSync(p, 'utf8');
    expect(sql).toContain('guardian_reference_candidates');
    expect(sql).toContain('guardian_hatch_jobs');
    expect(sql).toContain('guardian_hatch_frames');
    expect(sql).toContain('dna_version');
    expect(sql).toContain('reference_sha256');
  });

  it('assertDatabaseSchemaReady passes on complete schema and throws on missing table, column, wrong default or index drift', async () => {
    const { assertDatabaseSchemaReady, REQUIRED_V2_TABLES, GUARDIAN_CANONICAL_COLUMNS, REQUIRED_CANONICAL_INDEXES } = await import('../../src/server/db/schema-guard');

    // Complete database fixture with normalized types, constraints, defaults and index definitions
    const completeTables = REQUIRED_V2_TABLES.map(name => ({ name }));
    const completeCols = GUARDIAN_CANONICAL_COLUMNS.map(c => ({
      name: c.name,
      type: c.type,
      notnull: c.notnull ? 1 : 0,
      pk: c.pk ? 1 : 0,
      dflt_value: c.dflt_value ? `'${c.dflt_value}'` : null,
      cid: 0
    }));
    const completeIndexes = REQUIRED_CANONICAL_INDEXES.map(exp => ({
      name: exp.name,
      tbl_name: exp.table,
      sql: `CREATE INDEX ${exp.name} ON ${exp.table}(${exp.columns.join(', ')})`
    }));

    const readyDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes("PRAGMA index_list(guardians)")) {
            return {
              results: [
                ...REQUIRED_CANONICAL_INDEXES.map((idx, seq) => ({ seq, name: idx.name, unique: 0, origin: 'c', partial: 0 })),
                { seq: 99, name: 'sqlite_autoindex_guardians_1', unique: 1, origin: 'u', partial: 0 }
              ]
            };
          }
          if (sql.includes("PRAGMA index_info(sqlite_autoindex_guardians_1)")) {
            return { results: [{ seqno: 0, cid: 0, name: 'github_user_id' }] };
          }
          if (sql.includes("PRAGMA index_info(")) {
            const m = sql.match(/PRAGMA index_info\(([a-zA-Z0-9_]+)\)/);
            const found = REQUIRED_CANONICAL_INDEXES.find(i => i.name === (m ? m[1] : ''));
            return { results: (found?.columns || ['status']).map((col, seqno) => ({ seqno, cid: 0, name: col })) };
          }
          if (sql.includes("WHERE type='index'")) return { results: completeIndexes };
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) return { results: completeCols };
          return { results: [] };
        }
      })
    };

    const res = await assertDatabaseSchemaReady(readyDb);
    expect(res.ready).toBe(true);
    expect(res.tablesCount).toBe(REQUIRED_V2_TABLES.length);

    // 2. Subsequent call on SAME valid database uses instance cache
    const resCached = await assertDatabaseSchemaReady(readyDb);
    expect(resCached.ready).toBe(true);

    // 3. Distinct second database object with missing tables MUST throw (isolated per instance)
    const missingTableDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes('sqlite_master')) return { results: [{ name: 'users' }, { name: 'guardians' }] };
          return { results: completeCols };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(missingTableDb)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database is missing required tables');

    // 4. Distinct third database object with missing species_name MUST throw
    const missingColDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) return { results: completeCols.filter(c => c.name !== 'species_name') };
          return { results: [] };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(missingColDb)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Guardians table is missing required columns: [species_name]');

    // 5. Null / undefined / invalid inputs throw fail-closed
    await expect(assertDatabaseSchemaReady(null)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database binding is null, undefined, or missing prepare() method');
    await expect(assertDatabaseSchemaReady(undefined)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database binding is null, undefined, or missing prepare() method');
    await expect(assertDatabaseSchemaReady({ invalid: true })).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database binding is null, undefined, or missing prepare() method');

    // 6. Type mismatch / constraint drift fixture -> must throw fail-closed
    const driftedTypeDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes("WHERE type='index'")) return { results: completeIndexes };
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) {
            return {
              results: completeCols.map(c => c.name === 'hero_image_url' ? { ...c, notnull: 0 } : c)
            };
          }
          return { results: [] };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(driftedTypeDb)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Guardians table has constraint/type drift: [Column hero_image_url must have NOT NULL constraint]');

    // 7. Wrong default value fixture -> must throw fail-closed
    const driftedDefaultDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes("WHERE type='index'")) return { results: completeIndexes };
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) {
            return {
              results: completeCols.map(c => c.name === 'status' ? { ...c, dflt_value: "'ACTIVE'" } : c)
            };
          }
          return { results: [] };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(driftedDefaultDb)).rejects.toThrow("SCHEMA_INVARIANT_VIOLATION: Guardians table has constraint/type drift: [Column status default mismatch: expected 'PENDING', got ''ACTIVE'']");

    // 8. Same-name / wrong-column index definition drift fixture -> must throw fail-closed
    const driftedIndexDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes("PRAGMA index_list(guardians)")) {
            return {
              results: [
                { name: 'idx_guardians_status', unique: 0 },
                { name: 'idx_guardians_ref_sha', unique: 0 },
                { name: 'idx_guardians_gh_id', unique: 0 },
                { name: 'sqlite_autoindex_guardians_1', unique: 1 }
              ]
            };
          }
          if (sql.includes("PRAGMA index_info(sqlite_autoindex_guardians_1)")) {
            return { results: [{ seqno: 0, cid: 0, name: 'github_user_id' }] };
          }
          if (sql.includes("PRAGMA index_info(idx_guardians_status)")) {
            return { results: [{ seqno: 0, cid: 0, name: 'name' }] };
          }
          if (sql.includes("PRAGMA index_info(idx_guardians_ref_sha)")) {
            return { results: [{ seqno: 0, cid: 0, name: 'reference_sha256' }] };
          }
          if (sql.includes("PRAGMA index_info(idx_guardians_gh_id)")) {
            return { results: [{ seqno: 0, cid: 0, name: 'github_user_id' }] };
          }
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) return { results: completeCols };
          return { results: [] };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(driftedIndexDb)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database has index definition drift: [Index idx_guardians_status column mismatch: expected [status], got [name]]');

    // 9. Missing UNIQUE constraint fixture (only non-unique named indexes exist) -> must throw fail-closed
    const missingUniqueDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes("PRAGMA index_list(guardians)")) {
            return {
              results: [
                { name: 'idx_guardians_status', unique: 0 },
                { name: 'idx_guardians_ref_sha', unique: 0 },
                { name: 'idx_guardians_gh_id', unique: 0 }
              ]
            };
          }
          if (sql.includes("PRAGMA index_info(")) {
            const m = sql.match(/PRAGMA index_info\(([a-zA-Z0-9_]+)\)/);
            const col = (m && m[1].includes('ref_sha')) ? 'reference_sha256' : (m && m[1].includes('gh_id')) ? 'github_user_id' : 'status';
            return { results: [{ seqno: 0, cid: 0, name: col }] };
          }
          if (sql.includes('sqlite_master')) return { results: completeTables };
          if (sql.includes('PRAGMA table_info')) return { results: completeCols };
          return { results: [] };
        }
      })
    };
    await expect(assertDatabaseSchemaReady(missingUniqueDb)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database has index definition drift: [Table guardians is missing required UNIQUE constraint/index over columns [github_user_id]]');
  });
  it('reconcileGuardiansSchema detects missing columns on drifted database and restores parity', async () => {
    const { reconcileGuardiansSchema } = await import('../../src/server/db/schema-guard');

    const { GUARDIAN_CANONICAL_COLUMNS } = await import('../../src/server/db/schema-guard');
    const v2Names = new Set(['dna_version', 'status', 'species_name', 'anatomy', 'telemetry_snapshot', 'identity_spec', 'reference_sha256', 'request_fingerprint', 'manifest_url']);
    const existingCols = GUARDIAN_CANONICAL_COLUMNS.filter(c => !v2Names.has(c.name)).map(c => ({
      name: c.name,
      type: c.type,
      notnull: c.notnull ? 1 : 0,
      pk: c.pk ? 1 : 0,
      dflt_value: c.dflt_value ? `'${c.dflt_value}'` : null,
      cid: 0
    }));
    const executedStatements: string[] = [];
    const mockDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
          if (sql.includes('PRAGMA table_info')) {
            return { results: existingCols };
          }
          return { results: [] };
        },
        run: async () => {
          executedStatements.push(sql);
          const m = sql.match(/ALTER TABLE guardians ADD COLUMN ([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/);
          if (m && m[1]) {
            const colName = m[1];
            const found = GUARDIAN_CANONICAL_COLUMNS.find(c => c.name === colName);
            existingCols.push({
              name: colName,
              type: (m[2] || 'TEXT').toUpperCase() as 'TEXT' | 'INTEGER',
              notnull: found?.notnull ? 1 : 0,
              pk: 0,
              dflt_value: found?.dflt_value ? `'${found.dflt_value}'` : null,
              cid: 0
            });
          }
          return { success: true };
        }
      })
    };

    // Run 1: Reconciles all 9 missing V2 columns (including species_name)
    const res1 = await reconcileGuardiansSchema(mockDb);
    expect(res1.reconciled).toBe(true);
    expect(res1.addedColumns.length).toBe(9);
    expect(res1.addedColumns).toContain('species_name');
    expect(res1.addedColumns).toContain('anatomy');
    expect(res1.addedColumns).toContain('telemetry_snapshot');
    expect(res1.addedColumns).toContain('identity_spec');
    expect(res1.addedColumns).toContain('reference_sha256');
    expect(res1.totalColumnsCount).toBe(25);

    // Run 2: Idempotent - adds 0 columns on already reconciled database
    const res2 = await reconcileGuardiansSchema(mockDb);
    expect(res2.reconciled).toBe(false);
    expect(res2.addedColumns.length).toBe(0);
    expect(res2.totalColumnsCount).toBe(25);
  });

  it('auditAndReconcileDatabase CLI audits schema and fails closed on missing tables or columns', async () => {
    // @ts-ignore
    const { auditAndReconcileDatabase } = await import('../../scripts/reconcile-d1-schema.mjs');
    const { REQUIRED_V2_TABLES, GUARDIAN_CANONICAL_COLUMNS } = await import('../../src/server/db/schema-guard');

    const v2Names = new Set(['dna_version', 'status', 'species_name', 'anatomy', 'telemetry_snapshot', 'identity_spec', 'reference_sha256', 'request_fingerprint', 'manifest_url']);
    const existingColsForCli = GUARDIAN_CANONICAL_COLUMNS.filter(c => !v2Names.has(c.name)).map(c => ({
      name: c.name,
      type: c.type,
      notnull: c.notnull ? 1 : 0,
      pk: c.pk ? 1 : 0,
      dflt_value: c.dflt_value ? `'${c.dflt_value}'` : null,
      cid: 0
    }));
    const { REQUIRED_CANONICAL_INDEXES } = await import('../../src/server/db/schema-guard');
    const mockRunner = (cmd: string) => {
      if (cmd.includes("PRAGMA index_list(guardians)")) {
        return { ok: true, output: JSON.stringify([{ results: [
          { name: 'idx_guardians_status', unique: 0 },
          { name: 'idx_guardians_ref_sha', unique: 0 },
          { name: 'idx_guardians_gh_id', unique: 0 }
        ] }]) };
      }
      if (cmd.includes("PRAGMA index_info(")) {
        const m = cmd.match(/PRAGMA index_info\(([a-zA-Z0-9_]+)\)/);
        const idxName = m ? m[1] : '';
        const found = REQUIRED_CANONICAL_INDEXES.find(i => i.name === idxName);
        const col = (found?.columns || ['status'])[0];
        return { ok: true, output: JSON.stringify([{ results: [{ seqno: 0, cid: 0, name: col }] }]) };
      }
      if (cmd.includes("SELECT name FROM sqlite_master WHERE type='index'")) {
        return { ok: true, output: JSON.stringify([{ results: [
          { name: 'idx_guardians_status' },
          { name: 'idx_guardians_ref_sha' },
          { name: 'idx_guardians_gh_id' }
        ] }]) };
      }
      if (cmd.includes('SELECT name FROM sqlite_master')) {
        return { ok: true, output: JSON.stringify([{ results: REQUIRED_V2_TABLES.map(name => ({ name })) }]) };
      }
      if (cmd.includes('PRAGMA table_info')) {
        return { ok: true, output: JSON.stringify([{ results: existingColsForCli }]) };
      }
      if (cmd.includes('ALTER TABLE guardians ADD COLUMN')) {
        const m = cmd.match(/ALTER TABLE guardians ADD COLUMN ([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/);
        if (m && m[1]) {
          const colName = m[1];
          const found = GUARDIAN_CANONICAL_COLUMNS.find(c => c.name === colName);
          existingColsForCli.push({
            name: colName,
            type: (m[2] || 'TEXT').toUpperCase() as 'TEXT' | 'INTEGER',
            notnull: found?.notnull ? 1 : 0,
            pk: 0,
            dflt_value: found?.dflt_value ? `'${found.dflt_value}'` : null,
            cid: 0
          });
        }
        return { ok: true, output: 'ok' };
      }
      return { ok: true, output: 'ok' };
    };
    const res = auditAndReconcileDatabase('mock_db', 'wrangler.staging.toml', mockRunner);
    expect(res.ok).toBe(true);
    expect(res.added.length).toBe(9);
    expect(res.totalColumns).toBe(25);

    // Test fail-closed on missing tables
    const missingTableRunner = (cmd: string) => {
      if (cmd.includes('SELECT name FROM sqlite_master')) {
        return { ok: true, output: JSON.stringify([{ results: [{ name: 'users' }] }]) };
      }
      return { ok: true, output: '[]' };
    };

    expect(() => auditAndReconcileDatabase('bad_db', '', missingTableRunner)).toThrow('D1_SCHEMA_AUDIT_FAILED');
  });
});
