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
});
