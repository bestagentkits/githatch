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
const secretMapping = {
  'CLOUDFLARE_API_TOKEN': 'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID': 'CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID': 'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY': 'R2_SECRET_ACCESS_KEY',
  'GEMINI_API_KEY': 'GEMINI_API_KEY',
  'R2_BUCKET_NAME': 'R2_BUCKET_NAME',
  'GITHUB_CLIENT_ID': 'GH_CLIENT_ID',
  'GITHUB_CLIENT_SECRET': 'GH_CLIENT_SECRET',
  'GITHUB_TOKENS': 'GH_TOKENS',
  'AUTH_SECRET': 'AUTH_SECRET'
};

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...rest] = trimmed.split('=');
    const cleanKey = key.trim();
    const cleanVal = rest.join('=').trim();

    const targetSecretName = secretMapping[cleanKey];
    if (targetSecretName && cleanVal) {
      console.log(`Setting GitHub Secret: ${targetSecretName}...`);
      try {
        execSync(`gh secret set ${targetSecretName} --body "${cleanVal}"`, { stdio: 'inherit' });
        console.log(`✓ Secret ${targetSecretName} set successfully.`);
      } catch (err) {
        console.warn(`⚠️ Failed to set ${targetSecretName}:`, err.message);
      }
    }
  }
}

console.log('✦ Finished syncing all secrets to GitHub Actions!');
