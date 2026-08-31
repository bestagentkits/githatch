// ============================================================================
// GitHoot Gemini Nano Banana 2 API Client (src/server/services/ai/gemini-client.ts)
// ============================================================================

import type { Env } from '../../types';
import { MODEL_ALLOWLIST, GEMINI_ENDPOINT } from '../dna/contracts';
import { reserveAiSpend, settleAiSpend, WORST_CASE_COST_PER_IMAGE_CENTS } from '../billing/budget-guard';

export interface GeminiImageResponse {
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  error?: string;
}

export interface GeneratePoseOptions {
  prompt: string;
  referenceImage?: {
    mime: string;
    b64: string;
  } | null;
  modelOverride?: string;
}

export async function generatePoseWithGemini(
  options: GeneratePoseOptions,
  env: Env
): Promise<GeminiImageResponse> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured in environment.'
    };
  }

  const modelName = options.modelOverride || env.AI_MODEL_TIER || 'nano-banana-pro-preview';
  const cleanModel = modelName.replace(/^models\//, '');

  if (!MODEL_ALLOWLIST.includes(cleanModel)) {
    return {
      success: false,
      error: `Model "${cleanModel}" is not in the allowlist (${MODEL_ALLOWLIST.join(', ')}). Fallbacks to Nano Banana 1 are forbidden.`
    };
  }

  const url = `${GEMINI_ENDPOINT}/${cleanModel}:generateContent`;

  const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
  if (options.referenceImage) {
    parts.push({
      inlineData: {
        mimeType: options.referenceImage.mime,
        data: options.referenceImage.b64
      }
    });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    // 1. Atomic reservation per outbound attempt (25 cents worst-case)
    const reservation = await reserveAiSpend(env, WORST_CASE_COST_PER_IMAGE_CENTS);
    if (!reservation.ok) {
      return {
        success: false,
        error: reservation.reason || 'DAILY_BUDGET_CAP_EXCEEDED'
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        const safeError = errorText.slice(0, 200).replaceAll(apiKey, '[REDACTED]');
        throw new Error(`HTTP ${res.status}: ${safeError}`);
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: {
                mimeType: string;
                data: string;
              };
            }>;
          };
        }>;
      };

      const candidateParts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = candidateParts.find(p => p.inlineData?.data)?.inlineData;

      if (imagePart && imagePart.data) {
        return {
          success: true,
          base64Data: imagePart.data,
          mimeType: imagePart.mimeType || 'image/png'
        };
      }

      throw new Error('No image inlineData found in Gemini response parts.');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[GeminiClient] Attempt ${attempt} failed:`, lastError);
      if (attempt < 2) {
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 1000);
        await promise;
      }
    } finally {
      // Settle attempt: books 25 cents per attempt to enforce strict 80 total outbound calls/day cap
      await settleAiSpend(env, WORST_CASE_COST_PER_IMAGE_CENTS, WORST_CASE_COST_PER_IMAGE_CENTS);
    }
  }

  return {
    success: false,
    error: lastError
  };
}

// Backward compatibility wrapper
export async function generateSpriteSheetWithGemini(
  prompt: string,
  env: Env
): Promise<GeminiImageResponse> {
  return generatePoseWithGemini({ prompt }, env);
}
