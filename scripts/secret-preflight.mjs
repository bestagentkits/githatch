// ============================================================================
// GitHoot Fail-Closed Secret Preflight Validator (scripts/secret-preflight.mjs)
// ============================================================================

export const REQUIRED_CI_DEPLOY_CREDENTIALS = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID'
];

export const REQUIRED_WORKER_RUNTIME_SECRETS = [
  'GEMINI_API_KEY',
  'AUTH_SECRET',
  'ADMIN_REVIEW_SECRET',
  'GITHUB_TOKENS',
  'GH_CLIENT_ID',
  'GH_CLIENT_SECRET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME'
];

export const OPTIONAL_SECRETS = [
  'CF_ACCESS_AUD',
  'CF_ACCESS_TEAM_NAME',
  'CF_ACCESS_JWKS'
];

/**
 * Validates that all required environment secrets exist and are non-empty.
 * @param {Record<string, string | undefined>} envSource
 * @param {'ci_deploy' | 'runtime' | 'all'} target
 * @returns {{ ok: boolean, missing: string[], available: string[] }}
 */
export function validateEnvironmentSecrets(
  envSource = process.env,
  target = 'all'
) {
  const missing = [];
  const available = [];
  const effectiveEnv = { ...envSource };
  if (!effectiveEnv.GITHUB_TOKENS && effectiveEnv.GH_TOKENS) {
    effectiveEnv.GITHUB_TOKENS = effectiveEnv.GH_TOKENS;
  }
  if (!effectiveEnv.GH_CLIENT_ID && effectiveEnv.GITHUB_CLIENT_ID) {
    effectiveEnv.GH_CLIENT_ID = effectiveEnv.GITHUB_CLIENT_ID;
  }
  if (!effectiveEnv.GH_CLIENT_SECRET && effectiveEnv.GITHUB_CLIENT_SECRET) {
    effectiveEnv.GH_CLIENT_SECRET = effectiveEnv.GITHUB_CLIENT_SECRET;
  }

  let requiredList = [];
  if (target === 'ci_deploy') {
    requiredList = [...REQUIRED_CI_DEPLOY_CREDENTIALS];
  } else if (target === 'runtime') {
    requiredList = [...REQUIRED_WORKER_RUNTIME_SECRETS];
  } else {
    requiredList = [...REQUIRED_CI_DEPLOY_CREDENTIALS, ...REQUIRED_WORKER_RUNTIME_SECRETS];
  }

  for (const secretKey of requiredList) {
    const val = effectiveEnv[secretKey];
    if (!val || val.trim().length === 0) {
      missing.push(secretKey);
    } else {
      available.push(secretKey);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    available
  };
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('secret-preflight.mjs')) {
  const target = process.argv[2] || 'all';
  const result = validateEnvironmentSecrets(process.env, target);

  console.log(`[SecretPreflight] Validating secrets for target: ${target}`);
  console.log(`[SecretPreflight] Found ${result.available.length} valid secrets.`);

  if (!result.ok) {
    console.error(`[SecretPreflight] FAIL-CLOSED: Missing ${result.missing.length} required secrets:`);
    for (const m of result.missing) {
      console.error(`  - ❌ ${m}`);
    }
    process.exit(1);
  }

  console.log(`[SecretPreflight] ✅ All required secrets are present.`);
}
