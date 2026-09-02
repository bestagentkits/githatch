// ============================================================================
// GitHoot Staging Secrets Upload Tool
// (scripts/upload-staging-secrets.mjs)
// Uploads secrets via stdin pipe to Cloudflare Worker (staging)
// ============================================================================

import fs from 'fs';
import { execSync } from 'child_process';

const envPath = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
if (!fs.existsSync(envPath)) {
  console.error(`[FAIL] Environment file not found at ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envMap = {};

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > 0) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envMap[key] = val;
  }
}

const SECRETS_TO_UPLOAD = [
  'GEMINI_API_KEY',
  'AUTH_SECRET',
  'ADMIN_REVIEW_SECRET',
  'GITHUB_TOKENS',
  'CF_ACCESS_AUD',
  'CF_ACCESS_TEAM_NAME'
];

console.log('[StagingSecrets] Uploading runtime secrets to Cloudflare Worker (env: staging)...');

for (const key of SECRETS_TO_UPLOAD) {
  const val = envMap[key];
  if (!val) {
    console.warn(`[WARN] Secret ${key} is missing in ${envPath}, skipping...`);
    continue;
  }

  try {
    // Pipe secret value via stdin to wrangler secret put
    execSync(`npx wrangler secret put ${key} --config wrangler.worker.toml --env staging --env-file ${envPath}`, {
      input: val,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`✓ Uploaded secret: ${key}`);
  } catch (err) {
    console.error(`[FAIL] Failed to upload ${key}:`, err.message);
  }
}

console.log('[StagingSecrets] Staging worker secrets upload complete!');
