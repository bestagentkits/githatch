// ============================================================================
// D1 Migration Runner for Workers Integration Tests
// (tests/integration/setup/migrations.ts)
// ============================================================================

import { applyD1Migrations } from 'cloudflare:test';

declare const __D1_MIGRATIONS__: string | Array<{ name: string; queries: string[] }>;

export async function runMigrations(db: any): Promise<void> {
  const migrations = typeof __D1_MIGRATIONS__ === 'string'
    ? JSON.parse(__D1_MIGRATIONS__)
    : __D1_MIGRATIONS__;
  await applyD1Migrations(db, migrations);
}
