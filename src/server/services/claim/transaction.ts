// ============================================================================
// GitHoot Atomic Claim Transaction (src/server/services/claim/transaction.ts)
// ============================================================================

import type { Env, GitHubUserRaw, GuardianSummary, GuardianDNA, IdentitySpec, TelemetrySnapshot } from '../../types';
import { reserveEarlyAccessSlot } from './quota';
import { checkDailyBudgetLimit } from '../billing/budget-guard';
import { compileIdentitySpec, canonicalJson } from '../dna/compiler';
import { sha256Hex } from '../crypto/web-crypto';
import { fetchTelemetrySnapshot } from '../github/resolver';
import { createOutboxStatement } from '../../queue/outbox';
import type { GenerationQueueMessage } from '../../queue/message-schema';

export interface ClaimResult {
  success: boolean;
  guardian: GuardianSummary;
  slotNumber: number | null;
  isFree: boolean;
  isNewClaim: boolean;
  deliveryStatus: 'delivered' | 'pending-delivery';
  error?: string;
}

export async function executeClaimTransaction(
  authUser: GitHubUserRaw,
  env: Env
): Promise<ClaimResult> {
  const now = Date.now();
  const userId = crypto.randomUUID();
  const guardianId = crypto.randomUUID();
  const jobId = crypto.randomUUID();

  // 1. Check if user already has a Guardian (Idempotency)
  const existingGuardian = await env.DB.prepare(
    'SELECT id, name, species, species_name, anatomy, element, rarity_tier, status, level, experience, energy_state, hero_image_url, spritesheet_url, manifest_url FROM guardians WHERE github_user_id = ?'
  ).bind(authUser.id).first<GuardianSummary>();

  if (existingGuardian) {
    return {
      success: true,
      guardian: existingGuardian,
      slotNumber: null,
      isFree: true,
      isNewClaim: false,
      deliveryStatus: 'delivered'
    };
  }

  // 2. Check Daily Budget Limit (Fail-Closed)
  const budget = await checkDailyBudgetLimit(env);
  if (!budget.allowed) {
    throw new Error('DAILY_BUDGET_CAP_EXCEEDED: Daily AI generation budget limit reached ($20). Please try again tomorrow.');
  }
  // 3. Reserve Early Access Slot
  const slotRes = await reserveEarlyAccessSlot(authUser.id, env);

  if (!slotRes.isFree) {
    throw new Error('EARLY_ACCESS_FULL: 100 free slots have been claimed. Please use standard voucher or checkout.');
  }

  // 4. Extract and Freeze Telemetry Snapshot with Provenance
  const telemetry: TelemetrySnapshot = await fetchTelemetrySnapshot(authUser, env);
  // 5. Compile Immutable IdentitySpec (using authUser.id when present, or username on degraded claims)
  const identitySeedKey = (authUser.id && Number(authUser.id) > 0) ? authUser.id : authUser.login;
  const spec: IdentitySpec = await compileIdentitySpec({
    githubUserId: identitySeedKey,
    telemetry
  });
  const requestFingerprint = await sha256Hex(`hatch:job:${guardianId}:${spec.identityHash}`);
  const initialHeroUrl = `/assets/sample-pets/${spec.species}.jpg`;

  // 6. Execute Atomic DB Writes (Batch)
  const batchStatements = [
    // Create or ignore User
    env.DB.prepare(
      'INSERT OR IGNORE INTO users (id, github_user_id, status, created_at, updated_at) VALUES (?1, ?2, "active", ?3, ?3)'
    ).bind(userId, authUser.id, now),

    // Upsert GitHub Account
    env.DB.prepare(`
      INSERT INTO github_accounts (id, user_id, github_user_id, login, avatar_url, name, bio, public_repos, followers, claimed_at, last_synced_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
      ON CONFLICT(github_user_id) DO UPDATE SET
        claimed_at = ?10,
        last_synced_at = ?10
    `).bind(
      crypto.randomUUID(),
      userId,
      authUser.id,
      authUser.login,
      authUser.avatar_url,
      authUser.name,
      authUser.bio,
      authUser.public_repos,
      authUser.followers,
      now
    ),

    // Create Guardian Record (status: PENDING)
    env.DB.prepare(`
      INSERT INTO guardians (
        id, user_id, github_user_id, name, egg_type, species, species_name, anatomy,
        element, dna_seed, dna_version, rarity_tier, status, hero_image_url, spritesheet_url,
        traits, telemetry_snapshot, identity_spec, request_fingerprint, level, experience,
        energy_state, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'v1', ?11, 'PENDING', ?12, NULL, ?13, ?14, ?15, ?16, 1, 0, 'Active', ?17)
    `).bind(
      guardianId,
      userId,
      authUser.id,
      spec.speciesName,
      `${spec.species}-core`,
      spec.species,
      spec.speciesName,
      spec.anatomy,
      spec.element,
      spec.dnaSeed,
      spec.rarity,
      initialHeroUrl,
      canonicalJson(spec),
      canonicalJson(telemetry),
      canonicalJson(spec),
      requestFingerprint,
      now
    ),

    // Create Hatch Job Record
    env.DB.prepare(`
      INSERT INTO guardian_hatch_jobs (
        id, guardian_id, request_fingerprint, state, model_id, attempts_count, frames_completed, created_at, updated_at
      ) VALUES (?1, ?2, ?3, 'PENDING', ?4, 0, 0, ?5, ?5)
    `).bind(
      jobId,
      guardianId,
      requestFingerprint,
      env.AI_MODEL_TIER || 'nano-banana-pro-preview',
      now
    ),

    // Append to Activity Ledger
    env.DB.prepare(
      'INSERT INTO activity_ledger (id, github_user_id, event_type, payload, created_at) VALUES (?1, ?2, "CLAIM_HATCH", ?3, ?4)'
    ).bind(
      crypto.randomUUID(),
      authUser.id,
      JSON.stringify({ slot: slotRes.slotNumber, rarity: spec.rarity, guardian_id: guardianId }),
      now
    ),

    // Transactional Outbox write for HATCH_REFERENCE message
    createOutboxStatement(
      env.DB,
      'githoot-ai-queue',
      {
        v: 1,
        type: 'HATCH_REFERENCE',
        jobId,
        guardianId
      },
      `claim:${guardianId}`
    )
  ];

  await env.DB.batch(batchStatements);

  // 7. Best-effort direct enqueue into AI_QUEUE (Outbox drainer guarantees eventual delivery if this fails)
  let deliveryStatus: 'delivered' | 'pending-delivery' = 'pending-delivery';
  if (env.AI_QUEUE) {
    try {
      await env.AI_QUEUE.send({
        v: 1,
        type: 'HATCH_REFERENCE',
        jobId,
        guardianId
      });
      deliveryStatus = 'delivered';
      // Mark delivered in outbox
      await env.DB.prepare(`
        UPDATE guardian_outbox
        SET state = 'DELIVERED', delivered_at = ?1, updated_at = ?1
        WHERE claim_key = ?2;
      `).bind(Date.now(), `claim:${guardianId}`).run();
      console.log(`[Claim] Enqueued async hatch reference job ${jobId} for guardian ${guardianId}`);
    } catch (queueErr) {
      deliveryStatus = 'pending-delivery';
      console.warn(`[Claim] Direct enqueue failed, message safely stored in outbox for drainer:`, queueErr);
    }
  }
  try {
    await env.CACHE_KV.delete(`gh:profile:${authUser.login.toLowerCase()}`);
  } catch {
    // KV delete non-fatal
  }

  const createdGuardian: GuardianSummary = {
    id: guardianId,
    name: spec.speciesName,
    species: spec.species,
    species_name: spec.speciesName,
    anatomy: spec.anatomy,
    element: spec.element,
    rarity_tier: spec.rarity,
    status: 'PENDING',
    level: 1,
    experience: 0,
    energy_state: 'Active',
    hero_image_url: initialHeroUrl,
    spritesheet_url: null
  };

  return {
    success: true,
    guardian: createdGuardian,
    slotNumber: slotRes.slotNumber,
    isFree: true,
    isNewClaim: true,
    deliveryStatus
  };
}
