// ============================================================================
// GitHoot Atomic Claim Transaction (src/server/services/claim/transaction.ts)
// ============================================================================

import type { Env, GuardianSummary, GitHubUserRaw } from '../../types';
import { deriveGuardianDNA } from '../dna/seed';
import { reserveEarlyAccessSlot } from './quota';
import { checkDailyBudgetLimit, recordAiGenerationSpend } from '../billing/budget-guard';
import { compileNanoBananaPrompt } from '../ai/prompt-compiler';
import { generateSpriteSheetWithGemini } from '../ai/gemini-client';
import { processAndUploadGuardianAssets } from '../image/slicer';

export interface ClaimResult {
  success: boolean;
  guardian: GuardianSummary;
  slotNumber: number | null;
  isFree: boolean;
  isNewClaim: boolean;
  error?: string;
}

export async function executeClaimTransaction(
  authUser: GitHubUserRaw,
  env: Env
): Promise<ClaimResult> {
  const now = Date.now();
  const userId = crypto.randomUUID();
  const guardianId = crypto.randomUUID();

  // 1. Check if user already has a Guardian (Idempotency)
  const existingGuardian = await env.DB.prepare(
    'SELECT id, name, species, element, rarity_tier, level, experience, energy_state, hero_image_url, spritesheet_url FROM guardians WHERE github_user_id = ?'
  ).bind(authUser.id).first<GuardianSummary>();

  if (existingGuardian) {
    return {
      success: true,
      guardian: existingGuardian,
      slotNumber: null,
      isFree: true,
      isNewClaim: false
    };
  }

  // 2. Check Daily Budget Limit
  const budget = await checkDailyBudgetLimit(env);
  if (!budget.allowed) {
    console.warn('[Claim] Daily AI budget cap reached ($20). Switching to voucher/waitlist.');
  }

  // 3. Reserve Early Access Slot
  const slotRes = await reserveEarlyAccessSlot(authUser.id, env);

  if (!slotRes.isFree) {
    throw new Error('EARLY_ACCESS_FULL: 100 free slots have been claimed. Please use standard voucher or checkout.');
  }

  // 4. Derive Deterministic DNA
  const dna = await deriveGuardianDNA(authUser.id, authUser.login, []);

  // 5. Default initial hero URL (transparent de-spilled WebP assets)
  const archetypeMap: Record<string, string> = {
    'ember-core': 'emberfox',
    'neon-byte': 'neonbyte',
    'abyssal-pearl': 'abyssal',
    'solar-flare': 'solargriffin',
    'celestial-ray': 'celestialdrake',
    'void-rift': 'voidstalker',
    'rust-gear': 'rustgolem',
    'verdant-sprout': 'verdant'
  };
  const petSlug = archetypeMap[dna.egg_archetype_id] || 'neonbyte';
  let heroUrl = `/assets/sample-pets/${petSlug}.webp`;
  let spritesheetUrl: string | null = null;

  // 6. Execute Direct AI Generation if API key is present
  if (env.GEMINI_API_KEY && budget.allowed) {
    try {
      const prompt = compileNanoBananaPrompt(dna);
      const aiRes = await generateSpriteSheetWithGemini(prompt, env);
      if (aiRes.success && aiRes.base64Data) {
        const assets = await processAndUploadGuardianAssets(guardianId, aiRes.base64Data, env);
        heroUrl = assets.heroImageUrl;
        spritesheetUrl = assets.spritesheetUrl;
        await recordAiGenerationSpend(env);
      }
    } catch (err) {
      console.warn('[Claim] Direct AI generation failed, using fallback:', err);
    }
  }

  // 7. Execute Atomic DB Writes
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

    // Create Guardian Record
    env.DB.prepare(`
      INSERT INTO guardians (id, user_id, github_user_id, name, egg_type, species, element, dna_seed, rarity_tier, hero_image_url, spritesheet_url, traits, level, experience, energy_state, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 1, 0, 'Active', ?13)
    `).bind(
      guardianId,
      userId,
      authUser.id,
      dna.species,
      dna.egg_archetype_id,
      dna.species,
      dna.element,
      dna.dna_seed,
      dna.rarity_tier,
      heroUrl,
      spritesheetUrl,
      JSON.stringify(dna),
      now
    ),

    // Append to Activity Ledger
    env.DB.prepare(
      'INSERT INTO activity_ledger (id, github_user_id, event_type, payload, created_at) VALUES (?1, ?2, "CLAIM_HATCH", ?3, ?4)'
    ).bind(
      crypto.randomUUID(),
      authUser.id,
      JSON.stringify({ slot: slotRes.slotNumber, rarity: dna.rarity_tier }),
      now
    )
  ];

  await env.DB.batch(batchStatements);

  // 8. Invalidate KV Cache so profile instantly reflects claimed status
  try {
    await env.CACHE_KV.delete(`gh:profile:${authUser.login.toLowerCase()}`);
  } catch {
    // Non-blocking
  }

  const createdGuardian: GuardianSummary = {
    id: guardianId,
    name: dna.species,
    species: dna.species,
    element: dna.element,
    rarity_tier: dna.rarity_tier,
    level: 1,
    experience: 0,
    energy_state: 'Active',
    hero_image_url: heroUrl,
    spritesheet_url: spritesheetUrl
  };

  return {
    success: true,
    guardian: createdGuardian,
    slotNumber: slotRes.slotNumber,
    isFree: true,
    isNewClaim: true
  };
}
