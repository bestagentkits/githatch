// ============================================================================
// GitHoot Staging Deployment Automation Tool
// (scripts/deploy-staging.mjs)
// Deploys Pages and Dedicated Worker to Staging with strict Staging Bindings
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function loadLocalEnv() {
  const envPath = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadLocalEnv();

export async function deployToStaging() {
  console.log('\n🚀 [StagingDeploy] Starting automated staging deployment...');
  const envArg = fs.existsSync('D:/www/oss/githatch/.env') ? '--env-file D:/www/oss/githatch/.env' : '';

  // 1. Build application artifacts
  console.log('1. Building single-source artifacts...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Apply migrations to staging D1
  console.log('2. Applying D1 migrations to githoot_db_staging...');
  execSync(`npx wrangler d1 migrations apply githoot_db_staging --remote --config wrangler.staging.toml ${envArg}`, { stdio: 'inherit' });

  // 3. Deploy dedicated Queue Consumer Worker to staging
  console.log('3. Deploying Dedicated Queue Consumer Worker to staging...');
  execSync(`npx wrangler deploy dist-worker/index.js --no-bundle --config wrangler.worker.toml --env staging ${envArg}`, { stdio: 'inherit' });

  // 4. Deploy Pages application with staging bindings
  console.log('4. Deploying Pages Frontend to githoot-staging with staging configuration...');
  const wranglerProdBackup = path.resolve(process.cwd(), 'wrangler.prod.tmp.toml');
  const wranglerStaging = path.resolve(process.cwd(), 'wrangler.staging.toml');
  const wranglerRoot = path.resolve(process.cwd(), 'wrangler.toml');

  fs.copyFileSync(wranglerRoot, wranglerProdBackup);
  fs.copyFileSync(wranglerStaging, wranglerRoot);
  try {
    execSync(`npx wrangler pages deploy dist --project-name=githoot-staging --branch main ${envArg}`, { stdio: 'inherit' });
  } finally {
    fs.copyFileSync(wranglerProdBackup, wranglerRoot);
    if (fs.existsSync(wranglerProdBackup)) {
      fs.unlinkSync(wranglerProdBackup);
    }
  }

  // 5. Verify live deployed Worker provenance
  console.log('5. Asserting deployed worker provenance on staging...');
  execSync(`node scripts/bundle-provenance.mjs verify-deployed wrangler.worker.toml staging`, { stdio: 'inherit' });

  console.log('✓ [StagingDeploy] Staging deployment and provenance verification complete!\n');
}

if (process.argv[1] && process.argv[1].endsWith('deploy-staging.mjs')) {
  deployToStaging().catch((err) => {
    console.error('❌ Staging deploy failed:', err.message);
    process.exit(1);
  });
}
