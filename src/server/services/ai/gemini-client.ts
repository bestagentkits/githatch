// ============================================================================
// GitHoot Gemini Nano Banana 2 API Client (src/server/services/ai/gemini-client.ts)
// Single-Outbound-Fetch Architecture with Strict 1:1 Budget Accounting
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

export interface JobReservationToken {
  jobId: string;
  poseId: string;
  attemptNumber: number;
}

export interface GeneratePoseOptions {
  prompt: string;
  referenceImage?: {
    mime: string;
    b64: string;
  } | null;
  modelOverride?: string;
  /**
   * When provided, indicates caller holds an atomic job-aware reservation
   * (via reserveJobAndDailySpend) so gemini-client skips standalone reservation.
   */
  reservation?: JobReservationToken;
}

/**
 * Performs exactly ONE outbound HTTP fetch to Google Gemini Nano Banana 2 API.
 * Guarantees strict 1:1 parity between outbound network requests and budget accounting.
 */
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
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '1:1'
      }
    }
  };
  const hasJobReservation = Boolean(options.reservation);

  // 1. If caller does not manage a job-level reservation, make standalone reservation
  if (!hasJobReservation) {
    const reservationRes = await reserveAiSpend(env, WORST_CASE_COST_PER_IMAGE_CENTS);
    if (!reservationRes.ok) {
      return {
        success: false,
        error: reservationRes.reason || 'DAILY_BUDGET_CAP_EXCEEDED'
      };
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);
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
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[GeminiClient] Outbound Gemini fetch failed:', errMsg);
    return {
      success: false,
      error: errMsg
    };
  } finally {
    // Settle standalone reservation if client was the reservation owner
    if (!hasJobReservation) {
      await settleAiSpend(env, WORST_CASE_COST_PER_IMAGE_CENTS, WORST_CASE_COST_PER_IMAGE_CENTS);
    }
  }
}

// Backward compatibility wrapper
export async function generateSpriteSheetWithGemini(
  prompt: string,
  env: Env
): Promise<GeminiImageResponse> {
  return generatePoseWithGemini({ prompt }, env);
}
