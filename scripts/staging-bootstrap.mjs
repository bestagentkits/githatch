// ============================================================================
// GitHoot Fail-Closed Staging Bootstrap & Prerequisite Provisioner
// (scripts/staging-bootstrap.mjs)
// ============================================================================
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const STAGING_RESOURCES = {
  d1: 'githoot_db_staging',
  r2: 'githoot-staging',
  kv: 'GITHOOT_CACHE_STAGING',
  queue: 'githoot-ai-queue-staging',
  dlq: 'githoot-ai-dlq-staging',
  worker: 'githoot-generation-consumer-staging',
  pages: 'githoot-staging'
};

const REQUIRED_RUNTIME_SECRETS = [
  'GEMINI_API_KEY',
  'AUTH_SECRET',
  'ADMIN_REVIEW_SECRET',
  'GITHUB_TOKENS',
  'CLOUDFLARE_API_TOKEN'
];

export function loadModelAllowlist() {
  const allowlistPath = path.resolve(process.cwd(), 'src/server/services/dna/model-allowlist.json');
  if (!fs.existsSync(allowlistPath)) {
    throw new Error(`Missing single-source model allowlist at ${allowlistPath}`);
  }
  const data = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Invalid or empty model allowlist at ${allowlistPath}`);
  }
  return Object.freeze(data);
}

export const MODEL_ALLOWLIST = Object.freeze(loadModelAllowlist());

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

function defaultWranglerRunner(cmd) {
  try {
    const out = execSync(`npx wrangler ${cmd}`, {
      encoding: 'utf8',
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: err.stderr || err.stdout || err.message };
  }
}

function getExpectedMigrationFiles() {
  const migrationsDir = path.resolve(process.cwd(), 'src/server/db/migrations');
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

/**
 * Validates a strict UUID v4 format.
 */
function isValidUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates a strict 32-character hex ID (e.g. Cloudflare KV or Queue ID).
 */
function isValidHexId(id) {
  return typeof id === 'string' && /^[0-9a-f]{32}$/i.test(id);
}

function isCanonicalBase64(str) {
  if (typeof str !== 'string' || str.length === 0 || str.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
  try {
    const buf = Buffer.from(str, 'base64');
    if (buf.length === 0) return false;
    return buf.toString('base64') === str;
  } catch {
    return false;
  }
}

/**
 * Decodes and validates complete image binary structure via sharp.
 */
async function decodeAndValidateImage(bytes, mimeType) {
  if (!bytes || bytes.length < 50) {
    return { valid: false, reason: 'Image binary is too small (<50 bytes)' };
  }

  if (!mimeType || !mimeType.startsWith('image/')) {
    return { valid: false, reason: `Invalid image MIME type: ${mimeType}` };
  }

  try {
    const image = sharp(bytes);
    const meta = await image.metadata();
    if (!meta || !meta.width || !meta.height || meta.width === 0 || meta.height === 0) {
      return { valid: false, reason: 'Image has 0 dimensions or invalid metadata' };
    }

    const format = meta.format;
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
      return { valid: false, reason: `Decoded format ${format} is not allowed` };
    }

    const expectedFormat = (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ? 'jpeg' : (mimeType === 'image/png' ? 'png' : (mimeType === 'image/webp' ? 'webp' : ''));
    if (format !== expectedFormat) {
      return { valid: false, reason: `MIME type (${mimeType}) does not match decoded image format (${format})` };
    }

    // Decode full raw pixels to ensure non-truncated image
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    if (!data || data.length === 0 || info.width === 0 || info.height === 0) {
      return { valid: false, reason: 'Decoded pixel buffer is empty' };
    }

    return { valid: true, width: info.width, height: info.height, format };
  } catch (err) {
    return { valid: false, reason: `Image decode failed: ${err.message}` };
  }
}

export async function verifyOrProvisionStaging(
  runLabel = 'current',
  customRunner = null,
  customFetch = null,
  customEnv = null,
  outputDir = path.join(process.cwd(), 'plans', 'reports')
) {
  const runner = customRunner || defaultWranglerRunner;
  const fetchImpl = customFetch || fetch;
  const envObj = customEnv || process.env;

  const accountId = envObj.CLOUDFLARE_ACCOUNT_ID || '009dc0fcd0da3e503fbf38eb2b586e4b';
  const cfApiToken = envObj.CLOUDFLARE_API_TOKEN;

  const failures = [];
  let createdCount = 0;

  // Single-source model allowlist verification
  let allowlist = [];
  try {
    allowlist = loadModelAllowlist();
  } catch (err) {
    failures.push(`Model allowlist single-source verification failed: ${err.message}`);
  }

  let verifierDigest = 'unknown';
  try {
    const scriptContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/staging-bootstrap.mjs'));
    const digestBuf = await crypto.subtle.digest('SHA-256', scriptContent);
    verifierDigest = Array.from(new Uint8Array(digestBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {}
  const manifest = {
    timestamp: new Date().toISOString(),
    runLabel,
    environment: 'staging',
    verifier_digest: verifierDigest,
    createdCount: 0,
    resources: {},
    applied_migrations: [],
    credentials: {},
    gemini_canary: {},
    ready: false
  };
  // 0. Verify Cloudflare Account Authentication (Strict: runner must succeed)
  const whoami = runner('whoami');
  if (whoami.ok && !whoami.output.includes('not logged in') && !whoami.output.includes('unauthorized') && !whoami.output.includes('ERROR')) {
    manifest.credentials.cloudflare_auth = 'verified';
  } else {
    failures.push(`Cloudflare authentication failed: ${whoami.output || 'Not authenticated'}`);
    manifest.credentials.cloudflare_auth = 'failed';
  }

  // 1. Verify / Create D1 Staging Database & Apply Migrations
  const findD1 = () => {
    const d1List = runner('d1 list --json');
    if (!d1List.ok) return null;
    try {
      const parsed = JSON.parse(d1List.output);
      if (!Array.isArray(parsed)) return null;
      const db = parsed.find(item => item.name === STAGING_RESOURCES.d1 || item.database_name === STAGING_RESOURCES.d1);
      if (db) {
        const id = db.uuid || db.id;
        if (id && isValidUuid(id)) {
          return { id, name: STAGING_RESOURCES.d1 };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  let d1Record = findD1();
  if (d1Record) {
    manifest.resources.d1 = { name: STAGING_RESOURCES.d1, id: d1Record.id, status: 'verified' };
  } else {
    const createD1 = runner(`d1 create ${STAGING_RESOURCES.d1}`);
    if (createD1.ok) {
      createdCount++;
      const recheck = findD1();
      if (recheck) {
        manifest.resources.d1 = { name: STAGING_RESOURCES.d1, id: recheck.id, status: 'provisioned' };
      } else {
        failures.push(`D1 database ${STAGING_RESOURCES.d1} was created but exact re-fetch failed or returned invalid UUID.`);
      }
    } else {
      failures.push(`Failed to provision D1 database ${STAGING_RESOURCES.d1}: ${createD1.output}`);
    }
  }

  // Apply D1 Migrations on staging
  const migrateResult = runner(`d1 migrations apply ${STAGING_RESOURCES.d1} --config wrangler.staging.toml --remote`);
  if (!migrateResult.ok) {
    failures.push(`D1 remote migration failed on ${STAGING_RESOURCES.d1}: ${migrateResult.output}`);
  }

  // Query and verify exact applied migration versions against disk files
  const expectedMigrations = getExpectedMigrationFiles();
  const listMigQuery = runner(`d1 execute ${STAGING_RESOURCES.d1} --config wrangler.staging.toml --remote --command "SELECT name, applied_at FROM d1_migrations ORDER BY id ASC;" --json`);
  if (listMigQuery.ok) {
    try {
      const parsed = JSON.parse(listMigQuery.output);
      const rows = parsed[0]?.results || [];
      const appliedNames = rows.map(r => r.name);
      manifest.applied_migrations = appliedNames;

      // Strict exact equality: cardinality and ordering
      const isExactMatch = expectedMigrations.length > 0 &&
        expectedMigrations.length === appliedNames.length &&
        expectedMigrations.every((m, i) => appliedNames[i] === m);

      if (!isExactMatch) {
        failures.push(`Migration mismatch on ${STAGING_RESOURCES.d1}: expected [${expectedMigrations.join(', ')}], got [${appliedNames.join(', ')}]`);
      }
    } catch (e) {
      failures.push(`Failed to parse migration query output from ${STAGING_RESOURCES.d1}: ${listMigQuery.output}`);
    }
  } else {
    failures.push(`Failed to query applied migrations from ${STAGING_RESOURCES.d1}: ${listMigQuery.output}`);
  }

  // 2. Verify / Create R2 Staging Bucket with Mandatory Post-Create Re-Fetch
  const findR2 = () => {
    const info = runner(`r2 bucket info ${STAGING_RESOURCES.r2}`);
    if (info.ok) {
      const lines = info.output.split('\n');
      for (const line of lines) {
        const match = line.match(/^name:\s+([a-zA-Z0-9_-]+)$/i);
        if (match && match[1] === STAGING_RESOURCES.r2) {
          return { name: STAGING_RESOURCES.r2 };
        }
      }
    }
    const r2List = runner('r2 bucket list');
    if (r2List.ok) {
      const lines = r2List.output.split('\n');
      for (const line of lines) {
        const match = line.match(/^name:\s+([a-zA-Z0-9_-]+)$/i);
        if (match && match[1] === STAGING_RESOURCES.r2) {
          return { name: STAGING_RESOURCES.r2 };
        }
      }
    }
    return null;
  };

  let r2Record = findR2();
  if (r2Record) {
    manifest.resources.r2 = { name: STAGING_RESOURCES.r2, status: 'verified' };
  } else {
    const createR2 = runner(`r2 bucket create ${STAGING_RESOURCES.r2}`);
    if (createR2.ok) {
      createdCount++;
      if (findR2()) {
        manifest.resources.r2 = { name: STAGING_RESOURCES.r2, status: 'provisioned' };
      } else {
        failures.push(`R2 bucket ${STAGING_RESOURCES.r2} create was attempted but post-create exact re-fetch failed.`);
      }
    } else {
      failures.push(`Failed to create R2 bucket ${STAGING_RESOURCES.r2}: ${createR2.output}`);
    }
  }

  // 3. Verify / Create KV Staging Namespace with Mandatory Post-Create Re-Fetch
  const findKv = () => {
    const kvList = runner('kv namespace list');
    if (!kvList.ok) return null;
    try {
      const parsed = JSON.parse(kvList.output);
      if (!Array.isArray(parsed)) return null;
      const kv = parsed.find(item => item.title === STAGING_RESOURCES.kv || item.name === STAGING_RESOURCES.kv);
      if (kv && kv.id && isValidHexId(kv.id)) {
        return { id: kv.id, name: STAGING_RESOURCES.kv };
      }
      return null;
    } catch {
      return null;
    }
  };

  let kvRecord = findKv();
  if (kvRecord) {
    manifest.resources.kv = { name: STAGING_RESOURCES.kv, id: kvRecord.id, status: 'verified' };
  } else {
    const createKv = runner(`kv namespace create ${STAGING_RESOURCES.kv}`);
    if (createKv.ok) {
      createdCount++;
      const recheck = findKv();
      if (recheck) {
        manifest.resources.kv = { name: STAGING_RESOURCES.kv, id: recheck.id, status: 'provisioned' };
      } else {
        failures.push(`KV namespace ${STAGING_RESOURCES.kv} was created but exact re-fetch failed or returned invalid hex ID.`);
      }
    } else {
      failures.push(`Failed to create KV namespace ${STAGING_RESOURCES.kv}: ${createKv.output}`);
    }
  }

  // 4. Verify / Create Cloudflare Queues & DLQ with Mandatory Post-Create Re-Fetch
  const findQueue = (qName) => {
    const qList = runner('queues list');
    if (!qList.ok) return null;
    const lines = qList.output.split('\n');
    for (const line of lines) {
      if (line.includes('│') || line.includes('|')) {
        const cells = line.split(/[│|]/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const id = cells[0];
          const name = cells[1];
          if (name === qName && isValidHexId(id)) {
            return { id, name };
          }
        }
      }
    }
    return null;
  };

  let queueRecord = findQueue(STAGING_RESOURCES.queue);
  if (queueRecord) {
    manifest.resources.queue = { name: STAGING_RESOURCES.queue, id: queueRecord.id, status: 'verified' };
  } else {
    const qCreate = runner(`queues create ${STAGING_RESOURCES.queue}`);
    if (qCreate.ok || qCreate.output.includes('already taken') || qCreate.output.includes('already exists')) {
      if (qCreate.ok) createdCount++;
      const recheck = findQueue(STAGING_RESOURCES.queue);
      if (recheck) {
        manifest.resources.queue = { name: STAGING_RESOURCES.queue, id: recheck.id, status: qCreate.ok ? 'provisioned' : 'verified' };
      } else {
        failures.push(`Queue ${STAGING_RESOURCES.queue} create was attempted but post-create exact re-fetch failed.`);
      }
    } else {
      failures.push(`Failed to create Queue ${STAGING_RESOURCES.queue}: ${qCreate.output}`);
    }
  }

  let dlqRecord = findQueue(STAGING_RESOURCES.dlq);
  if (dlqRecord) {
    manifest.resources.dlq = { name: STAGING_RESOURCES.dlq, id: dlqRecord.id, status: 'verified' };
  } else {
    const dlqCreate = runner(`queues create ${STAGING_RESOURCES.dlq}`);
    if (dlqCreate.ok || dlqCreate.output.includes('already taken') || dlqCreate.output.includes('already exists')) {
      if (dlqCreate.ok) createdCount++;
      const recheck = findQueue(STAGING_RESOURCES.dlq);
      if (recheck) {
        manifest.resources.dlq = { name: STAGING_RESOURCES.dlq, id: recheck.id, status: dlqCreate.ok ? 'provisioned' : 'verified' };
      } else {
        failures.push(`DLQ ${STAGING_RESOURCES.dlq} create was attempted but post-create exact re-fetch failed.`);
      }
    } else {
      failures.push(`Failed to create DLQ ${STAGING_RESOURCES.dlq}: ${dlqCreate.output}`);
    }
  }

  // 5. Verify Pages Staging Project Remotely with Mandatory Live Remote Bindings Inspection
  const findPages = () => {
    const pList = runner('pages project list');
    if (!pList.ok) return null;
    const lines = pList.output.split('\n');
    for (const line of lines) {
      if (line.includes('│') || line.includes('|')) {
        const cells = line.split(/[│|]/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 1 && cells[0] === STAGING_RESOURCES.pages) {
          const domains = cells[1] || `${STAGING_RESOURCES.pages}.pages.dev`;
          return { name: STAGING_RESOURCES.pages, domains };
        }
      }
    }
    return null;
  };

  let pagesRecord = findPages();
  if (!pagesRecord) {
    const pCreate = runner(`pages project create ${STAGING_RESOURCES.pages} --production-branch main`);
    if (pCreate.ok || pCreate.output.includes('already exists') || pCreate.output.includes('already taken')) {
      if (pCreate.ok) createdCount++;
      pagesRecord = findPages();
      if (!pagesRecord) {
        failures.push(`Pages project ${STAGING_RESOURCES.pages} create was attempted but post-create exact re-fetch failed.`);
      }
    } else {
      failures.push(`Failed to create Pages project ${STAGING_RESOURCES.pages}: ${pCreate.output}`);
    }
  }

  // Remotely fetch and verify normalized Pages bindings from Cloudflare API
  let remotelyObservedPagesBindings = null;
  if (pagesRecord) {
    if (cfApiToken) {
      try {
        const pResp = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${STAGING_RESOURCES.pages}`, {
          headers: { 'Authorization': `Bearer ${cfApiToken}` },
          signal: AbortSignal.timeout(15000)
        });
        if (pResp.ok) {
          const pJson = await pResp.json();
          const pProd = pJson?.result?.deployment_configs?.production;
          remotelyObservedPagesBindings = {
            d1: pProd?.d1_databases?.DB?.id || null,
            r2: pProd?.r2_buckets?.ASSETS_BUCKET?.name || null,
            kv: pProd?.kv_namespaces?.CACHE_KV?.namespace_id || null,
            queue_producer: pProd?.queue_producers?.AI_QUEUE?.name || null
          };

          // Assert exact remote match with expected staging resource IDs/names
          const expectedD1Id = manifest.resources.d1?.id;
          const expectedKvId = manifest.resources.kv?.id;
          if (
            remotelyObservedPagesBindings.d1 !== expectedD1Id ||
            remotelyObservedPagesBindings.r2 !== STAGING_RESOURCES.r2 ||
            remotelyObservedPagesBindings.kv !== expectedKvId ||
            remotelyObservedPagesBindings.queue_producer !== STAGING_RESOURCES.queue
          ) {
            // If bindings are missing or drifted, auto-patch and re-verify
            const patchPayload = {
              deployment_configs: {
                production: {
                  d1_databases: { DB: { id: expectedD1Id } },
                  r2_buckets: { ASSETS_BUCKET: { name: STAGING_RESOURCES.r2 } },
                  kv_namespaces: { CACHE_KV: { namespace_id: expectedKvId } },
                  queue_producers: { AI_QUEUE: { name: STAGING_RESOURCES.queue } },
                  env_vars: {
                    ENVIRONMENT: { value: 'staging' },
                    DOMAIN: { value: 'staging.githoot.com' },
                    CDN_DOMAIN: { value: 'staging-cdn.githoot.com' },
                    EARLY_ACCESS_TOTAL_SLOTS: { value: '100' },
                    AI_MODEL_TIER: { value: 'nano-banana-pro-preview' }
                  }
                }
              }
            };

            const patchResp = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${STAGING_RESOURCES.pages}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${cfApiToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(patchPayload),
              signal: AbortSignal.timeout(15000)
            });

            if (patchResp.ok) {
              const patchJson = await patchResp.json();
              const patchedProd = patchJson?.result?.deployment_configs?.production;
              remotelyObservedPagesBindings = {
                d1: patchedProd?.d1_databases?.DB?.id || null,
                r2: patchedProd?.r2_buckets?.ASSETS_BUCKET?.name || null,
                kv: patchedProd?.kv_namespaces?.CACHE_KV?.namespace_id || null,
                queue_producer: patchedProd?.queue_producers?.AI_QUEUE?.name || null
              };
            }
          }

          // Final fail-closed check on remote Pages bindings
          if (
            remotelyObservedPagesBindings.d1 !== expectedD1Id ||
            remotelyObservedPagesBindings.r2 !== STAGING_RESOURCES.r2 ||
            remotelyObservedPagesBindings.kv !== expectedKvId ||
            remotelyObservedPagesBindings.queue_producer !== STAGING_RESOURCES.queue
          ) {
            failures.push(`Remote Pages binding drift on ${STAGING_RESOURCES.pages}: ${JSON.stringify(remotelyObservedPagesBindings)}`);
          }
        } else {
          failures.push(`Failed to fetch remote Pages project configuration from Cloudflare API: HTTP ${pResp.status}`);
        }
      } catch (err) {
        failures.push(`Remote Pages bindings query error: ${err.message}`);
      }
    } else {
      failures.push('Missing CLOUDFLARE_API_TOKEN: remote Pages binding verification requires API token.');
    }
  }

  if (pagesRecord) {
    manifest.resources.pages = {
      name: STAGING_RESOURCES.pages,
      domains: pagesRecord.domains,
      remotely_observed_bindings: remotelyObservedPagesBindings,
      status: (!remotelyObservedPagesBindings || failures.some(f => f.includes('Pages'))) ? 'failed' : 'verified'
    };
  }

  // 6. Verify Worker Staging Remotely (Strict UUID Validation & Live Remote Bindings Inspection)
  const findWorker = () => {
    const deployCheck = runner('deployments list --config wrangler.worker.toml --env staging');
    if (deployCheck.ok) {
      if (deployCheck.output.includes('No deployments') || deployCheck.output.trim() === '[]') {
        return null;
      }
      const match = deployCheck.output.match(/Version\(s\):\s*(?:\([^)]+\)\s*)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) ||
                    deployCheck.output.match(/Deployment ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (match && isValidUuid(match[1])) {
        return { id: match[1] };
      }
      try {
        const parsed = JSON.parse(deployCheck.output);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && isValidUuid(parsed[0].id)) {
          return { id: parsed[0].id };
        }
      } catch {}
    }
    return null;
  };

  let workerRecord = findWorker();
  if (!workerRecord) {
    const workerDeploy = runner('deploy dist-worker/index.js --config wrangler.worker.toml --env staging --no-bundle');
    if (workerDeploy.ok) {
      createdCount++;
      workerRecord = findWorker();
      if (!workerRecord) {
        failures.push(`Worker ${STAGING_RESOURCES.worker} was deployed but post-deploy remote re-fetch failed to find valid UUID deployment ID.`);
      }
    } else {
      failures.push(`Worker staging remote deployment failed for ${STAGING_RESOURCES.worker}: ${workerDeploy.output}`);
    }
  }

  // Remotely fetch and verify normalized Worker bindings and Queue Consumer settings from Cloudflare API
  let remotelyObservedWorkerBindings = null;
  let remotelyObservedConsumerSettings = null;
  if (workerRecord) {
    if (cfApiToken) {
      try {
        // Fetch Worker bindings
        const wResp = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${STAGING_RESOURCES.worker}/bindings`, {
          headers: { 'Authorization': `Bearer ${cfApiToken}` },
          signal: AbortSignal.timeout(15000)
        });
        if (wResp.ok) {
          const wJson = await wResp.json();
          const wList = wJson?.result || [];
          remotelyObservedWorkerBindings = {
            d1: wList.find(b => b.type === 'd1' && b.name === 'DB')?.database_id || null,
            r2: wList.find(b => b.type === 'r2_bucket' && b.name === 'ASSETS_BUCKET')?.bucket_name || null,
            kv: wList.find(b => b.type === 'kv_namespace' && b.name === 'CACHE_KV')?.namespace_id || null,
            queue_producer: wList.find(b => b.type === 'queue' && b.name === 'AI_QUEUE')?.queue_name || null
          };

          const expectedD1Id = manifest.resources.d1?.id;
          const expectedKvId = manifest.resources.kv?.id;
          if (
            remotelyObservedWorkerBindings.d1 !== expectedD1Id ||
            remotelyObservedWorkerBindings.r2 !== STAGING_RESOURCES.r2 ||
            remotelyObservedWorkerBindings.kv !== expectedKvId ||
            remotelyObservedWorkerBindings.queue_producer !== STAGING_RESOURCES.queue
          ) {
            failures.push(`Remote Worker binding drift on ${STAGING_RESOURCES.worker}: ${JSON.stringify(remotelyObservedWorkerBindings)}`);
          }
        } else {
          failures.push(`Failed to fetch remote Worker bindings from Cloudflare API: HTTP ${wResp.status}`);
        }

        // Fetch Worker Queue Consumer settings
        const queueId = manifest.resources.queue?.id;
        if (queueId) {
          const cResp = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueId}/consumers`, {
            headers: { 'Authorization': `Bearer ${cfApiToken}` },
            signal: AbortSignal.timeout(15000)
          });
          if (cResp.ok) {
            const cJson = await cResp.json();
            const consumer = (cJson?.result || [])[0];
            remotelyObservedConsumerSettings = {
              script: consumer?.script || null,
              queue_name: consumer?.queue_name || null,
              dead_letter_queue: consumer?.dead_letter_queue || null,
              batch_size: consumer?.settings?.batch_size || null,
              max_retries: consumer?.settings?.max_retries || null,
              max_concurrency: consumer?.settings?.max_concurrency || null
            };

            if (
              remotelyObservedConsumerSettings.script !== STAGING_RESOURCES.worker ||
              remotelyObservedConsumerSettings.queue_name !== STAGING_RESOURCES.queue ||
              remotelyObservedConsumerSettings.dead_letter_queue !== STAGING_RESOURCES.dlq ||
              remotelyObservedConsumerSettings.batch_size !== 1 ||
              remotelyObservedConsumerSettings.max_retries !== 5 ||
              remotelyObservedConsumerSettings.max_concurrency !== 2
            ) {
              failures.push(`Remote Queue Consumer topology drift on ${STAGING_RESOURCES.queue}: ${JSON.stringify(remotelyObservedConsumerSettings)}`);
            }
          } else {
            failures.push(`Failed to fetch remote Queue Consumer settings from Cloudflare API: HTTP ${cResp.status}`);
          }
        }
      } catch (err) {
        failures.push(`Remote Worker bindings query error: ${err.message}`);
      }
    } else {
      failures.push('Missing CLOUDFLARE_API_TOKEN: remote Worker binding verification requires API token.');
    }
  }

  if (workerRecord) {
    manifest.resources.worker = {
      name: STAGING_RESOURCES.worker,
      id: workerRecord.id,
      remotely_observed_bindings: remotelyObservedWorkerBindings,
      remotely_observed_consumer: remotelyObservedConsumerSettings,
      status: (!remotelyObservedWorkerBindings || !remotelyObservedConsumerSettings || failures.some(f => f.includes('Worker') || f.includes('Consumer'))) ? 'failed' : 'verified'
    };
  }

  // 7. Verify Secrets & Reviewer Credentials (Strict Separation)
  for (const secret of REQUIRED_RUNTIME_SECRETS) {
    const val = envObj[secret];
    const minLen = secret === 'ADMIN_REVIEW_SECRET' ? 16 : 1;
    if (val && typeof val === 'string' && val.length >= minLen) {
      manifest.credentials[secret] = 'verified';
    } else {
      failures.push(`Required secret "${secret}" is missing or insufficient (min length: ${minLen}).`);
      manifest.credentials[secret] = 'missing';
    }
  }

  // Enforce distinct secret separation: ADMIN_REVIEW_SECRET must NOT equal AUTH_SECRET
  if (envObj.ADMIN_REVIEW_SECRET && envObj.AUTH_SECRET) {
    if (envObj.ADMIN_REVIEW_SECRET === envObj.AUTH_SECRET) {
      failures.push('Security violation: ADMIN_REVIEW_SECRET must be distinct from AUTH_SECRET.');
    }
  }

  // 8. Verify Gemini Staging Quota & Allowlisted Image Model Canary
  const configuredModel = (envObj.AI_MODEL_TIER || 'nano-banana-pro-preview').replace(/^models\//, '');
  let modelValid = true;
  if (!allowlist.includes(configuredModel)) {
    failures.push(`Configured model "${configuredModel}" is not in single-source MODEL_ALLOWLIST (${allowlist.join(', ')}).`);
    modelValid = false;
  }

  if (envObj.GEMINI_API_KEY) {
    try {
      const resp = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${envObj.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || []).map(m => m.name.replace('models/', ''));
        if (models.length === 0 || !models.includes(configuredModel)) {
          failures.push(`Configured model "${configuredModel}" not found in Gemini models list (returned ${models.length} models).`);
          modelValid = false;
        }

        // Strict short-circuit: ZERO canary POST and ZERO D1 reservation if model is forbidden or missing
        if (!modelValid) {
          manifest.gemini_canary = {
            status: 'failed',
            configured_model: configuredModel,
            reason: 'Model is not in single-source allowlist or missing from live ListModels'
          };
        } else {
          // Enforce Atomic D1 Daily Budget Reservation before calling Gemini API
          const todayStr = new Date().toISOString().split('T')[0];
          const reserveQuery = `INSERT INTO ai_budget_ledger (day, reserved_cents, settled_cents, cap_cents, total_calls, updated_at) VALUES ('${todayStr}', 25, 0, 2000, 1, unixepoch()) ON CONFLICT(day) DO UPDATE SET reserved_cents = reserved_cents + 25, total_calls = total_calls + 1, updated_at = unixepoch() WHERE (reserved_cents + settled_cents + 25) <= cap_cents;`;
        const reserveRes = runner(`d1 execute ${STAGING_RESOURCES.d1} --config wrangler.staging.toml --remote --command "${reserveQuery}" --json`);
        let reservationGranted = false;
        if (reserveRes.ok) {
          try {
            const parsed = JSON.parse(reserveRes.output);
            const changes = parsed[0]?.meta?.changes ?? parsed[0]?.changes ?? (Array.isArray(parsed) && parsed.length > 0 && parsed[0].meta ? parsed[0].meta.changes : 0);
            if (changes === 1) {
              reservationGranted = true;
            } else {
              failures.push('Staging Gemini canary blocked: Daily AI budget reservation cap exceeded (0 rows modified, spend cap $20 reached).');
            }
          } catch (e) {
            failures.push(`Failed to parse D1 budget reservation JSON output: ${reserveRes.output}`);
          }
        } else {
          failures.push(`Staging Gemini canary blocked by D1 budget reservation: ${reserveRes.output}`);
        }

        if (reservationGranted) {
          let canarySuccess = false;
          try {
            // Execute canary request against the configured model requiring real image output
            const canaryResp = await fetchImpl(
              `https://generativelanguage.googleapis.com/v1beta/models/${configuredModel}:generateContent?key=${envObj.GEMINI_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(30000),
                body: JSON.stringify({
                  contents: [{ parts: [{ text: 'generate a pixel art companion' }] }],
                  generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                })
              }
            );

            if (canaryResp.ok && canaryResp.status >= 200 && canaryResp.status < 300) {
              const canaryJson = await canaryResp.json().catch(() => null);
              const candidateParts = canaryJson?.candidates?.[0]?.content?.parts || [];
              const imagePart = candidateParts.find(p => p.inlineData || p.inline_data);

              if (imagePart) {
                const rawMime = imagePart.inlineData?.mimeType || imagePart.inline_data?.mime_type;
                const b64Data = imagePart.inlineData?.data || imagePart.inline_data?.data;

                if (typeof rawMime === 'string' && rawMime.startsWith('image/') && isCanonicalBase64(b64Data)) {
                  const rawBytes = Buffer.from(b64Data, 'base64');
                  const structCheck = await decodeAndValidateImage(rawBytes, rawMime);
                  
                  if (structCheck.valid) {
                    canarySuccess = true;
                    manifest.gemini_canary = {
                      status: 'verified',
                      canary_status: 'image_verified',
                      configured_model: configuredModel,
                      available_models_count: models.length,
                      image_mime: rawMime,
                      image_bytes: rawBytes.length,
                      dimensions: `${structCheck.width}x${structCheck.height}`
                    };
                  } else {
                    failures.push(`Gemini canary returned invalid image binary structure for ${rawMime} on ${configuredModel}: ${structCheck.reason}`);
                  }
                } else {
                  failures.push(`Gemini canary returned invalid MIME (${rawMime}) or non-canonical base64 on ${configuredModel}.`);
                }
              } else {
                failures.push(`Gemini canary on ${configuredModel} returned text-only response without image inlineData.`);
              }
            } else {
              const errText = await canaryResp.text().catch(() => 'unknown');
              failures.push(`Gemini generation canary failed on ${configuredModel}: HTTP ${canaryResp.status} - ${errText}`);
            }
          } finally {
            // Settle budget reservation in D1: book full 25 cents per attempted canary request (fail-closed if settlement fails)
            const settleQuery = `UPDATE ai_budget_ledger SET reserved_cents = MAX(0, reserved_cents - 25), settled_cents = settled_cents + 25, updated_at = unixepoch() WHERE day = '${todayStr}';`;
            const settleRes = runner(`d1 execute ${STAGING_RESOURCES.d1} --config wrangler.staging.toml --remote --command "${settleQuery}" --json`);
            if (!settleRes.ok) {
              failures.push(`Staging Gemini canary settlement failed in D1: ${settleRes.output}`);
            }
          }
        }
      }
      } else {
        const txt = await resp.text().catch(() => 'unknown');
        failures.push(`Gemini API key validation failed: HTTP ${resp.status} - ${txt}`);
      }
    } catch (e) {
      failures.push(`Gemini API connectivity error: ${e.message}`);
    }
  }

  manifest.createdCount = createdCount;

  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const manifestPath = path.join(outputDir, `staging-bootstrap-manifest${runLabel !== 'current' ? '-' + runLabel : ''}.json`);
    manifest.ready = failures.length === 0;
    if (failures.length > 0) {
      manifest.failures = failures;
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  if (failures.length > 0) {
    manifest.ready = false;
    manifest.failures = failures;
    return { ok: false, failures, manifest };
  }

  manifest.ready = true;
  return { ok: true, failures: [], manifest };
}

if (process.argv[1] && process.argv[1].endsWith('staging-bootstrap.mjs')) {
  const label = process.argv[2] || 'run3';
  verifyOrProvisionStaging(label).then(result => {
    if (!result.ok) {
      console.error('Staging bootstrap verification failed:', result.failures);
      process.exit(1);
    }
    console.log(`✓ Staging bootstrap verification succeeded! Saved manifest for ${label}.`);
  });
}
