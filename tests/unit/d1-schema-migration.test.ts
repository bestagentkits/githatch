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

  it('assertDatabaseSchemaReady passes on complete schema and throws on missing table or column', async () => {
    const { assertDatabaseSchemaReady, REQUIRED_V2_TABLES, GUARDIAN_REQUIRED_COLUMNS } = await import('../../src/server/db/schema-guard');

    // Complete database fixture
    const completeTables = REQUIRED_V2_TABLES.map(name => ({ name }));
    const completeCols = GUARDIAN_REQUIRED_COLUMNS.map(c => ({ name: c.name }));

    const readyDb: any = {
      prepare: (sql: string) => ({
        all: async () => {
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
    await expect(assertDatabaseSchemaReady(null)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database binding is null or undefined');
    await expect(assertDatabaseSchemaReady(undefined)).rejects.toThrow('SCHEMA_INVARIANT_VIOLATION: Database binding is null or undefined');
  });

  it('reconcileGuardiansSchema detects missing columns on drifted database and restores parity', async () => {
    const { reconcileGuardiansSchema } = await import('../../src/server/db/schema-guard');

    const existingCols = [
      { name: 'id' }, { name: 'user_id' }, { name: 'github_user_id' }, { name: 'name' },
      { name: 'egg_type' }, { name: 'species' }, { name: 'element' }, { name: 'dna_seed' },
      { name: 'rarity_tier' }, { name: 'hero_image_url' }, { name: 'spritesheet_url' },
      { name: 'traits' }, { name: 'level' }, { name: 'experience' }, { name: 'energy_state' },
      { name: 'created_at' }
    ];

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
          const m = sql.match(/ALTER TABLE guardians ADD COLUMN ([a-zA-Z0-9_]+)/);
          if (m && m[1]) {
            existingCols.push({ name: m[1] });
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
    const { REQUIRED_V2_TABLES } = await import('../../src/server/db/schema-guard');

    let currentCols = [
      { name: 'id' }, { name: 'user_id' }, { name: 'github_user_id' }, { name: 'name' },
      { name: 'egg_type' }, { name: 'species' }, { name: 'element' }, { name: 'dna_seed' },
      { name: 'rarity_tier' }, { name: 'hero_image_url' }, { name: 'spritesheet_url' },
      { name: 'traits' }, { name: 'level' }, { name: 'experience' }, { name: 'energy_state' },
      { name: 'created_at' }
    ];

    const mockRunner = (cmd: string) => {
      if (cmd.includes("SELECT name FROM sqlite_master WHERE type='index'")) {
        return { ok: true, output: JSON.stringify([{ results: [{ name: 'idx_guardians_status' }, { name: 'idx_guardians_ref_sha' }] }]) };
      }
      if (cmd.includes('SELECT name FROM sqlite_master')) {
        return { ok: true, output: JSON.stringify([{ results: REQUIRED_V2_TABLES.map(name => ({ name })) }]) };
      }
      if (cmd.includes('PRAGMA table_info')) {
        return { ok: true, output: JSON.stringify([{ results: currentCols }]) };
      }
      if (cmd.includes('ALTER TABLE guardians ADD COLUMN')) {
        const m = cmd.match(/ALTER TABLE guardians ADD COLUMN ([a-zA-Z0-9_]+)/);
        if (m && m[1]) {
          currentCols.push({ name: m[1] });
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
