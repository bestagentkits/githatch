// ============================================================================
// GitHoot Background AI Generation Queue Worker (src/server/queue/generation-worker.ts)
// ============================================================================

import type { Env, GuardianDNA } from '../types';
import { compileNanoBananaPrompt } from '../services/ai/prompt-compiler';
import { generateSpriteSheetWithGemini } from '../services/ai/gemini-client';
import { processAndUploadGuardianAssets } from '../services/image/slicer';

export interface GenerationQueueMessage {
  type: 'GENERATE_GUARDIAN_ASSET' | 'REVALIDATE_PROFILE';
  guardianId?: string;
  githubUserId?: number;
  dna?: GuardianDNA;
  username?: string;
}

export async function handleQueueBatch(
  batch: MessageBatch<GenerationQueueMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const payload = message.body;

    if (payload.type === 'GENERATE_GUARDIAN_ASSET' && payload.guardianId && payload.dna) {
      try {
        console.log(`[Queue] Processing AI generation for guardian: ${payload.guardianId}`);

        // 1. Compile 4x2 matrix prompt
        const prompt = compileNanoBananaPrompt(payload.dna);

        // 2. Call Gemini Nano Banana 2 API
        const genResult = await generateSpriteSheetWithGemini(prompt, env);

        if (genResult.success && genResult.base64Data) {
          // 3. Process & Upload to R2
          const assets = await processAndUploadGuardianAssets(payload.guardianId, genResult.base64Data, env);

          // 4. Update Guardian record in D1
          await env.DB.prepare(
            'UPDATE guardians SET hero_image_url = ?1, spritesheet_url = ?2 WHERE id = ?3'
          ).bind(assets.heroImageUrl, assets.spritesheetUrl, payload.guardianId).run();

          console.log(`[Queue] Successfully generated and stored assets for ${payload.guardianId}`);
        } else {
          console.warn(`[Queue] AI Generation failed for ${payload.guardianId}:`, genResult.error);
        }

        message.ack();
      } catch (err) {
        console.error(`[Queue] Error processing message ${message.id}:`, err);
        message.retry();
      }
    } else {
      message.ack();
    }
  }
}
