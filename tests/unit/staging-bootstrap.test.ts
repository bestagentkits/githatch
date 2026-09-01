// ============================================================================
// Staging Bootstrap Fail-Closed Unit Tests
// (tests/unit/staging-bootstrap.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { GATES } from '../../src/server/services/dna/contracts';
// @ts-ignore
import { verifyOrProvisionStaging } from '../../scripts/staging-bootstrap.mjs';

const VALID_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const BASE_VALID_ENV = {
  AI_MODEL_TIER: 'nano-banana-pro-preview',
  GEMINI_API_KEY: 'test-gemini-key',
  AUTH_SECRET: 'test-auth-secret-key-at-least-16',
  ADMIN_REVIEW_SECRET: 'test-admin-review-secret-at-least-16',
  GITHUB_TOKENS: '["ghp_test"]',
  CLOUDFLARE_API_TOKEN: 'test-cf-token',
  CLOUDFLARE_ACCOUNT_ID: '009dc0fcd0da3e503fbf38eb2b586e4b'
};

function createBaseMockRunner() {
  return (cmd: string) => {
    if (cmd.includes('whoami')) {
      return { ok: true, output: 'Logged in to Cloudflare' };
    }
    if (cmd.includes('d1 list --json')) {
      return {
        ok: true,
        output: JSON.stringify([{ uuid: 'd9ccb357-a59c-44e7-a50a-236e51991d65', name: 'githoot_db_staging' }])
      };
    }
    if (cmd.includes('d1 migrations apply')) {
      return { ok: true, output: 'Migrations applied' };
    }
    if (cmd.includes('d1 execute')) {
      if (cmd.includes('ai_budget_ledger')) {
        return {
          ok: true,
          output: JSON.stringify([{ meta: { changes: 1 } }])
        };
      }
      return {
        ok: true,
        output: JSON.stringify([{ results: [{ name: '0001_initial.sql' }, { name: '0002_hatch_pipeline_v2.sql' }, { name: '0003_ai_budget_ledger.sql' }] }])
      };
    }
    if (cmd.includes('r2 bucket info githoot-staging')) {
      return { ok: true, output: 'name: githoot-staging\ncreated: 2026-08-31T08:46:42.754Z\nlocation: APAC\n' };
    }
    if (cmd.includes('r2 bucket list')) {
      return { ok: true, output: 'name: githoot-staging\n' };
    }
    if (cmd.includes('kv namespace list')) {
      return {
        ok: true,
        output: JSON.stringify([{ id: 'efa9aa71d9104284976966dcbdfb111b', title: 'GITHOOT_CACHE_STAGING' }])
      };
    }
    if (cmd.includes('queues list')) {
      return {
        ok: true,
        output: '│ 031ed29543b34d26a62664cea67c5c58 │ githoot-ai-queue-staging │\n│ 7c50da5052de4b37ae83439d94f67965 │ githoot-ai-dlq-staging   │\n'
      };
    }
    if (cmd.includes('pages project list')) {
      return {
        ok: true,
        output: '│ githoot-staging │ githoot-staging.pages.dev │ No │ 3 hours ago │\n'
      };
    }
    if (cmd.includes('deployments list --config wrangler.worker.toml --env staging')) {
      return {
        ok: true,
        output: 'Version(s):  (100%) 4cd17a33-a917-4529-901b-cc471f71061a\n'
      };
    }
    return { ok: true, output: 'ok' };
  };
}

function createBaseMockFetch() {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/models?')) {
      return {
        ok: true,
        json: async () => ({ models: [{ name: 'models/nano-banana-pro-preview' }] })
      };
    }
    if (url.includes(':generateContent')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  mimeType: 'image/png',
                  data: VALID_PNG_BASE64
                }
              }]
            }
          }]
        })
      };
    }
    if (url.includes('/pages/projects/')) {
      return {
        ok: true,
        json: async () => ({
          result: {
            deployment_configs: {
              production: {
                d1_databases: { DB: { id: 'd9ccb357-a59c-44e7-a50a-236e51991d65' } },
                r2_buckets: { ASSETS_BUCKET: { name: 'githoot-staging' } },
                kv_namespaces: { CACHE_KV: { namespace_id: 'efa9aa71d9104284976966dcbdfb111b' } },
                queue_producers: { AI_QUEUE: { name: 'githoot-ai-queue-staging' } }
              }
            }
          }
        })
      };
    }
    if (url.includes('/workers/scripts/') && url.includes('/bindings')) {
      return {
        ok: true,
        json: async () => ({
          result: [
            { name: 'DB', type: 'd1', database_id: 'd9ccb357-a59c-44e7-a50a-236e51991d65' },
            { name: 'ASSETS_BUCKET', type: 'r2_bucket', bucket_name: 'githoot-staging' },
            { name: 'CACHE_KV', type: 'kv_namespace', namespace_id: 'efa9aa71d9104284976966dcbdfb111b' },
            { name: 'AI_QUEUE', type: 'queue', queue_name: 'githoot-ai-queue-staging' }
          ]
        })
      };
    }
    if (url.includes('/queues/') && url.includes('/consumers')) {
      return {
        ok: true,
        json: async () => ({
          result: [{
            script: 'githoot-generation-consumer-staging',
            queue_name: 'githoot-ai-queue-staging',
            dead_letter_queue: 'githoot-ai-dlq-staging',
            settings: { batch_size: 1, max_retries: 5, max_concurrency: 2 }
          }]
        })
      };
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  });
}

describe('Staging Bootstrap & Prerequisite Contracts', () => {
  it('enforces GATES dimension constants unification', () => {
    expect(GATES.maxSidePx).toBe(1024);
    expect(GATES.maxBytes).toBe(4 * 1024 * 1024);
    expect(GATES.maxLargeComponents).toBe(4);
    expect(GATES.dominanceRatio).toBe(0.30);
    expect(GATES.minBboxFill).toBe(0.06);
    expect(GATES.maxBboxAspect).toBe(3.2);
  });

  it('fails closed when ADMIN_REVIEW_SECRET equals AUTH_SECRET in bootstrap execution', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = createBaseMockFetch();
    const env = {
      ...BASE_VALID_ENV,
      ADMIN_REVIEW_SECRET: 'same-shared-secret-key-16',
      AUTH_SECRET: 'same-shared-secret-key-16'
    };

    const result = await verifyOrProvisionStaging('test-secret-separation', runner, fetchFn, env, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('ADMIN_REVIEW_SECRET must be distinct from AUTH_SECRET'))).toBe(true);
  });

  it('fails closed when ADMIN_REVIEW_SECRET is shorter than 16 chars in bootstrap execution', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = createBaseMockFetch();
    const env = {
      ...BASE_VALID_ENV,
      ADMIN_REVIEW_SECRET: 'short-secret'
    };

    const result = await verifyOrProvisionStaging('test-secret-length', runner, fetchFn, env, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('ADMIN_REVIEW_SECRET'))).toBe(true);
  });

  it('fails closed when Cloudflare authentication whoami fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('whoami')) {
        return { ok: false, output: 'Error: not logged in / unauthorized' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-whoami-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Cloudflare authentication failed'))).toBe(true);
  });

  it('fails closed when migration command fails in staging bootstrap runner', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('d1 migrations apply')) {
        return { ok: false, output: 'D1 error: database locked' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-migration-cmd-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('D1 remote migration failed'))).toBe(true);
  });

  it('fails closed on migration version ordering or count mismatch', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('d1 execute')) {
        return {
          ok: true,
          output: JSON.stringify([{ results: [{ name: '0001_initial.sql' }] }]) // Missing 0002 and 0003
        };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-migration-mismatch', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Migration mismatch'))).toBe(true);
  });

  it('fails closed when D1 database provisioning fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('d1 list --json')) return { ok: true, output: '[]' };
      if (cmd.includes('d1 create')) return { ok: false, output: 'Error: quota exceeded' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-d1-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to provision D1 database'))).toBe(true);
  });

  it('fails closed when D1 creation succeeds but post-create re-fetch returns invalid or missing UUID', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('d1 list --json')) return { ok: true, output: '[]' };
      if (cmd.includes('d1 create')) return { ok: true, output: 'Created' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-d1-refetch-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('D1 database githoot_db_staging was created but exact re-fetch failed'))).toBe(true);
  });

  it('fails closed when R2 bucket creation fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('r2 bucket info')) return { ok: false, output: 'Bucket not found' };
      if (cmd.includes('r2 bucket list')) return { ok: true, output: '' };
      if (cmd.includes('r2 bucket create')) return { ok: false, output: 'Error: bucket name reserved' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-r2-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create R2 bucket'))).toBe(true);
  });

  it('fails closed when R2 creation succeeds but post-create re-fetch fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('r2 bucket info')) return { ok: false, output: 'Not found' };
      if (cmd.includes('r2 bucket list')) return { ok: true, output: '' };
      if (cmd.includes('r2 bucket create')) return { ok: true, output: 'Created' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-r2-refetch-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('R2 bucket githoot-staging create was attempted but post-create exact re-fetch failed'))).toBe(true);
  });

  it('fails closed when KV namespace creation fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('kv namespace list')) return { ok: true, output: '[]' };
      if (cmd.includes('kv namespace create')) return { ok: false, output: 'Error: unauthorized' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-kv-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create KV namespace'))).toBe(true);
  });

  it('fails closed when KV creation succeeds but post-create re-fetch returns invalid hex ID', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('kv namespace list')) return { ok: true, output: '[]' };
      if (cmd.includes('kv namespace create')) return { ok: true, output: 'Created' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-kv-refetch-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('KV namespace GITHOOT_CACHE_STAGING was created but exact re-fetch failed'))).toBe(true);
  });

  it('fails closed when Queue creation fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('queues list')) return { ok: true, output: '' };
      if (cmd.includes('queues create githoot-ai-queue-staging')) return { ok: false, output: 'Error creating queue' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-queue-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create Queue githoot-ai-queue-staging'))).toBe(true);
  });

  it('fails closed when DLQ creation fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('queues list')) {
        return { ok: true, output: '│ 031ed29543b34d26a62664cea67c5c58 │ githoot-ai-queue-staging │\n' };
      }
      if (cmd.includes('queues create githoot-ai-dlq-staging')) return { ok: false, output: 'Error creating DLQ' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-dlq-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create DLQ githoot-ai-dlq-staging'))).toBe(true);
  });

  it('fails closed when Pages project creation fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('pages project list')) return { ok: true, output: '' };
      if (cmd.includes('pages project create')) return { ok: false, output: 'Error: invalid project' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-pages-create-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create Pages project'))).toBe(true);
  });

  it('fails closed when Pages creation succeeds but post-create re-fetch fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('pages project list')) return { ok: true, output: '' };
      if (cmd.includes('pages project create')) return { ok: true, output: 'Created' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-pages-refetch-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Pages project githoot-staging create was attempted but post-create exact re-fetch failed'))).toBe(true);
  });

  it('fails closed when Worker deployment fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('deployments list')) return { ok: true, output: '[]' };
      if (cmd.includes('deploy dist-worker/index.js')) return { ok: false, output: 'Error: worker script syntax error' };
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-worker-deploy-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Worker staging remote deployment failed'))).toBe(true);
  });

  it('fails closed when Worker deployment returns non-UUID ID (e.g. worker-dep-stable-123 or Version(s): healthy)', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('deployments list')) {
        return {
          ok: true,
          output: 'Version(s):  (100%) worker-dep-stable-123\n' // Not a UUID
        };
      }
      if (cmd.includes('deploy dist-worker/index.js')) {
        return { ok: true, output: 'Deployed' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-worker-non-uuid', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('failed to find valid UUID deployment ID'))).toBe(true);
  });

  it('fails closed when Gemini models-list returns HTTP 403 Forbidden', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: false, status: 403, text: async () => 'Forbidden: API key invalid' };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-gemini-403', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Gemini API key validation failed: HTTP 403'))).toBe(true);
  });

  it('fails closed when configured model is outside single-source model-allowlist.json (zero generateContent calls and zero budget reservations)', async () => {
    let budgetInsertCalls = 0;
    const runner = (cmd: string) => {
      if (cmd.includes('ai_budget_ledger') && cmd.includes('INSERT INTO')) {
        budgetInsertCalls++;
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: true, json: async () => ({ models: [{ name: 'models/gemini-2.5-flash-image' }] }) }; // Live provider returns it!
      }
      return createBaseMockFetch()(url);
    });
    const env = {
      ...BASE_VALID_ENV,
      AI_MODEL_TIER: 'gemini-2.5-flash-image' // Forbidden Nano Banana 1
    };

    const result = await verifyOrProvisionStaging('test-forbidden-model', runner, fetchFn, env, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('is not in single-source MODEL_ALLOWLIST'))).toBe(true);
    // Assert strict short-circuit: ZERO calls to :generateContent and ZERO budget reservations
    const generateCalls = fetchFn.mock.calls.filter((call: any[]) => typeof call[0] === 'string' && call[0].includes(':generateContent'));
    expect(generateCalls.length).toBe(0);
    expect(budgetInsertCalls).toBe(0);
  });

  it('fails closed when configured model is missing from live ListModels (zero generateContent calls and zero budget reservations)', async () => {
    let budgetInsertCalls = 0;
    const runner = (cmd: string) => {
      if (cmd.includes('ai_budget_ledger') && cmd.includes('INSERT INTO')) {
        budgetInsertCalls++;
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: true, json: async () => ({ models: [{ name: 'models/other-model-only' }] }) }; // Allowlisted locally, but missing remotely!
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-missing-model-list', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('not found in Gemini models list'))).toBe(true);
    // Assert strict short-circuit: ZERO calls to :generateContent and ZERO budget reservations
    const generateCalls = fetchFn.mock.calls.filter((call: any[]) => typeof call[0] === 'string' && call[0].includes(':generateContent'));
    expect(generateCalls.length).toBe(0);
    expect(budgetInsertCalls).toBe(0);
  });

  it('fails closed when Gemini canary returns text-only without image parts', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: true, json: async () => ({ models: [{ name: 'models/nano-banana-pro-preview' }] }) };
      }
      if (url.includes(':generateContent')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{ text: 'Here is a text-only companion description.' }]
              }
            }]
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-text-only-canary', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('returned text-only response without image inlineData'))).toBe(true);
  });

  it('fails closed when Gemini canary returns valid image bytes but mismatched MIME format', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: true, json: async () => ({ models: [{ name: 'models/nano-banana-pro-preview' }] }) };
      }
      if (url.includes(':generateContent')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  inlineData: {
                    mimeType: 'image/jpeg', // Declares JPEG but provides PNG bytes!
                    data: VALID_PNG_BASE64
                  }
                }]
              }
            }]
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-mime-mismatch', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('MIME type (image/jpeg) does not match decoded image format (png)'))).toBe(true);
  });

  it('fails closed when Gemini canary is blocked by D1 budget reservation failure (command error)', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('ai_budget_ledger') && cmd.includes('INSERT INTO')) {
        return { ok: false, output: 'D1 error: database locked' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-canary-budget-blocked-cmd', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Staging Gemini canary blocked by D1 budget reservation'))).toBe(true);
  });

  it('fails closed when Gemini canary is blocked by D1 budget reservation returning 0 changed rows (cap exceeded)', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('ai_budget_ledger') && cmd.includes('INSERT INTO')) {
        return { ok: true, output: JSON.stringify([{ meta: { changes: 0 } }]) }; // 0 rows changed => cap reached!
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-canary-budget-zero-changes', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Daily AI budget reservation cap exceeded (0 rows modified'))).toBe(true);
  });

  it('fails closed when Gemini canary settlement in D1 fails', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('UPDATE ai_budget_ledger')) {
        return { ok: false, output: 'D1 settlement error: network timeout' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();
    const result = await verifyOrProvisionStaging('test-canary-settlement-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Staging Gemini canary settlement failed in D1'))).toBe(true);
  });

  it('fails closed when table-shaped output contains target token in an unrelated cell or column', async () => {
    const runner = (cmd: string) => {
      if (cmd.includes('queues list')) {
        // Output contains "githoot-staging" as part of an unrelated long queue name
        return {
          ok: true,
          output: '│ 031ed29543b34d26a62664cea67c5c58 │ unrelated-githoot-staging-custom-queue │\n'
        };
      }
      if (cmd.includes('queues create githoot-ai-queue-staging')) {
        return { ok: false, output: 'Error' };
      }
      return createBaseMockRunner()(cmd);
    };
    const fetchFn = createBaseMockFetch();

    const result = await verifyOrProvisionStaging('test-unrelated-cell', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to create Queue githoot-ai-queue-staging'))).toBe(true);
  });

  it('fails closed when remote Pages bindings have drifted or are misconfigured', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/pages/projects/')) {
        return {
          ok: true,
          json: async () => ({
            result: {
              deployment_configs: {
                production: {
                  d1_databases: { DB: { id: 'wrong-drifted-d1-uuid' } }, // Drifted D1 ID!
                  r2_buckets: { ASSETS_BUCKET: { name: 'wrong-bucket' } }
                }
              }
            }
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-pages-drift', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Remote Pages binding drift'))).toBe(true);
  });

  it('fails closed when remote Worker bindings have drifted or are missing required resources', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/workers/scripts/')) {
        return {
          ok: true,
          json: async () => ({
            result: [
              { name: 'DB', type: 'd1', database_id: 'wrong-d1-uuid' } // Drifted D1!
            ]
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-worker-drift', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Remote Worker binding drift'))).toBe(true);
  });

  it('fails closed when remote Queue Consumer topology has drifted (e.g. wrong DLQ or wrong batch size)', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/queues/') && url.includes('/consumers')) {
        return {
          ok: true,
          json: async () => ({
            result: [{
              script: 'githoot-generation-consumer-staging',
              queue_name: 'githoot-ai-queue-staging',
              dead_letter_queue: 'wrong-drifted-dlq', // Drifted DLQ!
              settings: { batch_size: 10, max_retries: 1, max_concurrency: 1 } // Wrong topology!
            }]
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-consumer-drift', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Remote Queue Consumer topology drift'))).toBe(true);
  });

  it('fails closed when CLOUDFLARE_API_TOKEN is missing for remote observation', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = createBaseMockFetch();
    const envWithoutToken = {
      ...BASE_VALID_ENV,
      CLOUDFLARE_API_TOKEN: '' // Missing token!
    };

    const result = await verifyOrProvisionStaging('test-missing-cf-token', runner, fetchFn, envWithoutToken, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('CLOUDFLARE_API_TOKEN'))).toBe(true);
  });

  it('fails closed when remote Queue Consumer HTTP query fails (e.g. HTTP 500 error)', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/queues/') && url.includes('/consumers')) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error'
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-consumer-http-fail', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Failed to fetch remote Queue Consumer settings from Cloudflare API'))).toBe(true);
  });

  it('fails closed when remote Queue Consumer queue_name has drifted', async () => {
    const runner = createBaseMockRunner();
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/queues/') && url.includes('/consumers')) {
        return {
          ok: true,
          json: async () => ({
            result: [{
              script: 'githoot-generation-consumer-staging',
              queue_name: 'wrong-drifted-queue-name', // Drifted queue_name!
              dead_letter_queue: 'githoot-ai-dlq-staging',
              settings: { batch_size: 1, max_retries: 5, max_concurrency: 2 }
            }]
          })
        };
      }
      return createBaseMockFetch()(url);
    });

    const result = await verifyOrProvisionStaging('test-consumer-queue-name-drift', runner, fetchFn, BASE_VALID_ENV, null);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f: string) => f.includes('Remote Queue Consumer topology drift'))).toBe(true);
  });

  it('stateful two-run test: run 1 provisions all 7 resources and run 2 performs 0 creates with identical authoritative IDs and verified bindings', async () => {
    let d1Created = false;
    let r2Created = false;
    let kvCreated = false;
    let queueCreated = false;
    let dlqCreated = false;
    let pagesCreated = false;
    let workerCreated = false;

    const mockRunner = (cmd: string) => {
      if (cmd.includes('whoami')) {
        return { ok: true, output: 'Logged in to Cloudflare' };
      }
      if (cmd.includes('d1 list --json')) {
        if (!d1Created) return { ok: true, output: '[]' };
        return {
          ok: true,
          output: JSON.stringify([{ uuid: 'd9ccb357-a59c-44e7-a50a-236e51991d65', name: 'githoot_db_staging' }])
        };
      }
      if (cmd.includes('d1 create')) {
        d1Created = true;
        return { ok: true, output: 'Created D1' };
      }
      if (cmd.includes('d1 migrations apply')) {
        return { ok: true, output: 'Migrations applied' };
      }
      if (cmd.includes('d1 execute')) {
        if (cmd.includes('ai_budget_ledger')) {
          return { ok: true, output: JSON.stringify([{ meta: { changes: 1 } }]) };
        }
        const mFiles = ['0001_initial.sql', '0002_github_aggregate_stats.sql', '0002_hatch_pipeline_v2.sql', '0003_ai_budget_ledger.sql', '0004_pose_leases_outbox.sql', '0005_publication_pointer.sql', '0006_review_records.sql'];
        return {
          ok: true,
          output: JSON.stringify([{ results: mFiles.map(name => ({ name })) }])
        };
      }
      if (cmd.includes('r2 bucket info githoot-staging')) {
        if (!r2Created) return { ok: false, output: 'Not found' };
        return { ok: true, output: 'name: githoot-staging\ncreated: 2026-08-31T08:46:42.754Z\nlocation: APAC\n' };
      }
      if (cmd.includes('r2 bucket list')) {
        if (!r2Created) return { ok: true, output: '' };
        return { ok: true, output: 'name: githoot-staging\n' };
      }
      if (cmd.includes('r2 bucket create')) {
        r2Created = true;
        return { ok: true, output: 'Created R2' };
      }
      if (cmd.includes('kv namespace list')) {
        if (!kvCreated) return { ok: true, output: '[]' };
        return {
          ok: true,
          output: JSON.stringify([{ id: 'efa9aa71d9104284976966dcbdfb111b', title: 'GITHOOT_CACHE_STAGING' }])
        };
      }
      if (cmd.includes('kv namespace create')) {
        kvCreated = true;
        return { ok: true, output: 'Created KV' };
      }
      if (cmd.includes('queues list')) {
        const lines: string[] = [];
        if (queueCreated) lines.push('│ 031ed29543b34d26a62664cea67c5c58 │ githoot-ai-queue-staging │');
        if (dlqCreated) lines.push('│ 7c50da5052de4b37ae83439d94f67965 │ githoot-ai-dlq-staging   │');
        return { ok: true, output: lines.join('\n') };
      }
      if (cmd.includes('queues create githoot-ai-queue-staging')) {
        queueCreated = true;
        return { ok: true, output: 'Created queue' };
      }
      if (cmd.includes('queues create githoot-ai-dlq-staging')) {
        dlqCreated = true;
        return { ok: true, output: 'Created DLQ' };
      }
      if (cmd.includes('pages project list')) {
        if (!pagesCreated) return { ok: true, output: '' };
        return {
          ok: true,
          output: '│ githoot-staging │ githoot-staging.pages.dev │ No │ 3 hours ago │\n'
        };
      }
      if (cmd.includes('pages project create')) {
        pagesCreated = true;
        return { ok: true, output: 'Created pages' };
      }
      if (cmd.includes('deployments list --config wrangler.worker.toml --env staging')) {
        if (!workerCreated) return { ok: true, output: '[]' };
        return {
          ok: true,
          output: 'Version(s):  (100%) 4cd17a33-a917-4529-901b-cc471f71061a\n'
        };
      }
      if (cmd.includes('deploy dist-worker/index.js')) {
        workerCreated = true;
        return { ok: true, output: 'Deployed worker' };
      }
      return { ok: true, output: 'ok' };
    };

    const mockFetch = createBaseMockFetch();

    // Run 1: provisions all missing resources (all 7)
    const run1 = await verifyOrProvisionStaging('test-run-1', mockRunner, mockFetch, BASE_VALID_ENV, null);
    expect(run1.ok).toBe(true);
    expect(run1.manifest.createdCount).toBe(7); // D1, R2, KV, Queue, DLQ, Pages, Worker
    expect(run1.manifest.gemini_canary.canary_status).toBe('image_verified');
    expect(run1.manifest.resources.worker.id).toBe('4cd17a33-a917-4529-901b-cc471f71061a');
    expect(run1.manifest.resources.worker.remotely_observed_bindings).toBeDefined();
    expect(run1.manifest.resources.pages.remotely_observed_bindings).toBeDefined();

    // Run 2: idempotent, 0 creates, identical IDs/names across all 7 resources
    const run2 = await verifyOrProvisionStaging('test-run-2', mockRunner, mockFetch, BASE_VALID_ENV, null);
    expect(run2.ok).toBe(true);
    expect(run2.manifest.createdCount).toBe(0);
    expect(run2.manifest.resources.d1.id).toBe(run1.manifest.resources.d1.id);
    expect(run2.manifest.resources.kv.id).toBe(run1.manifest.resources.kv.id);
    expect(run2.manifest.resources.r2.name).toBe(run1.manifest.resources.r2.name);
    expect(run2.manifest.resources.queue.id).toBe(run1.manifest.resources.queue.id);
    expect(run2.manifest.resources.queue.name).toBe(run1.manifest.resources.queue.name);
    expect(run2.manifest.resources.dlq.id).toBe(run1.manifest.resources.dlq.id);
    expect(run2.manifest.resources.dlq.name).toBe(run1.manifest.resources.dlq.name);
    expect(run2.manifest.resources.pages.name).toBe(run1.manifest.resources.pages.name);
    expect(run2.manifest.resources.worker.id).toBe(run1.manifest.resources.worker.id);
    expect(run2.manifest.resources.worker.remotely_observed_bindings).toEqual(run1.manifest.resources.worker.remotely_observed_bindings);
    expect(run2.manifest.resources.pages.remotely_observed_bindings).toEqual(run1.manifest.resources.pages.remotely_observed_bindings);
    expect(run2.manifest.gemini_canary.canary_status).toBe('image_verified');
  });
});
