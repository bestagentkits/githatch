// ============================================================================
// Upload Canonical Sample Pet References to R2 (Production & Staging)
// (scripts/upload-canonical-references.mjs)
// Strictly enforces Invariant #4: Reference-conditioned character rendering
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const envPath = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
const envArg = fs.existsSync(envPath) ? `--env-file ${envPath}` : '';

const SPECIES = [
  'emberfox',
  'neonbyte',
  'abyssal',
  'verdant',
  'solargriffin',
  'voidstalker',
  'rustgolem',
  'celestialdrake'
];

const BUCKETS = ['githoot', 'githoot-staging'];

console.log('[CanonicalUpload] Uploading 8 canonical Guardian reference images to R2...');

for (const bucket of BUCKETS) {
  console.log(`\nBucket: ${bucket}`);
  for (const s of SPECIES) {
    const srcJpg = path.resolve(process.cwd(), `assets/sample-pets/${s}.jpg`);
    if (!fs.existsSync(srcJpg)) {
      console.warn(`[WARN] Missing source asset: ${srcJpg}`);
      continue;
    }

    const r2Key = `references/canonical/${s}.jpg`;
    try {
      execSync(`npx wrangler r2 object put ${bucket}/${r2Key} --file ${srcJpg} ${envArg} --remote`, { stdio: 'pipe' });
      console.log(`  ✓ ${r2Key} (${fs.statSync(srcJpg).size} bytes)`);
    } catch (err) {
      console.error(`  ❌ Failed uploading ${r2Key}:`, err.message);
    }
  }
}

console.log('\n[CanonicalUpload] All canonical reference images uploaded successfully!');
