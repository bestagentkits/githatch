// ============================================================================
// GitHoot Sync Secrets from .env to GitHub Repository Secrets
// (scripts/sync-secrets-to-github.js)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found.');
  process.exit(1);
}

const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
const secretsToSync = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'GEMINI_API_KEY',
  'R2_BUCKET_NAME'
];

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=');
    const cleanKey = key.trim();
    const cleanVal = rest.join('=').trim();

    if (secretsToSync.includes(cleanKey) && cleanVal) {
      console.log(`Setting GitHub Secret: ${cleanKey}...`);
      try {
        execSync(`gh secret set ${cleanKey} --body "${cleanVal}"`, { stdio: 'inherit' });
        console.log(`✓ Secret ${cleanKey} set successfully.`);
      } catch (err) {
        console.warn(`⚠️ Failed to set ${cleanKey}:`, err.message);
      }
    }
  }
}

console.log('✦ Finished syncing secrets to GitHub!');
