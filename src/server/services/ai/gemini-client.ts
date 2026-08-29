// ============================================================================
// GitHoot Gemini Nano Banana 2 API Client (src/server/services/ai/gemini-client.ts)
// ============================================================================

import type { Env } from '../../types';

export interface GeminiImageResponse {
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  error?: string;
}

export async function generateSpriteSheetWithGemini(
  prompt: string,
  env: Env
): Promise<GeminiImageResponse> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured in environment.'
    };
  }

  const model = env.AI_MODEL_TIER || 'models/nano-banana-pro-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  let lastError = '';
  // Up to 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 200)}`);
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

      const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (inlineData && inlineData.data) {
        return {
          success: true,
          base64Data: inlineData.data,
          mimeType: inlineData.mimeType || 'image/jpeg'
        };
      }

      throw new Error('No inlineData found in Gemini response.');
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[GeminiClient] Attempt ${attempt} failed:`, lastError);
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return {
    success: false,
    error: lastError
  };
}
