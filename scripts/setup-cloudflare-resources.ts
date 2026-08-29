// ============================================================================
// GitHoot Cloudflare Resources Bootstrap Script (scripts/setup-cloudflare-resources.ts)
// ============================================================================

import fs from 'fs';
import path from 'path';

function loadEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (k) env[k.trim()] = v.join('=').trim();
      }
    }
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const bucketName = env.R2_BUCKET_NAME || 'githoot';

  if (!accountId || !apiToken) {
    console.error('⚠️ CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN missing in .env');
    process.exit(1);
  }

  console.log(`✦ Bootstrapping Cloudflare Resources for Account: ${accountId.slice(0, 8)}...`);

  // 1. Create R2 Bucket "githoot"
  console.log(`[R2] Ensuring Bucket "${bucketName}" exists...`);
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = (await res.json()) as { success: boolean; errors?: Array<{ message: string }> };
    if (data.success) {
      console.log(`✓ R2 Bucket "${bucketName}" is ready.`);
    } else {
      const msg = data.errors?.[0]?.message || '';
      if (msg.includes('already exists')) {
        console.log(`✓ R2 Bucket "${bucketName}" already exists.`);
      } else {
        console.warn(`[R2] Response:`, data);
      }
    }
  } catch (err) {
    console.error('[R2] Error creating bucket:', err);
  }

  console.log('✦ Cloudflare Resources Bootstrap Complete!');
}

main().catch(console.error);
