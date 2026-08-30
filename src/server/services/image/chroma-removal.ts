// ============================================================================
// GitHoot Chroma Key & Green De-Spill Engine (src/server/services/image/chroma-removal.ts)
// ============================================================================

export interface ProcessedRgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export function removeChromaGreen(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const output = new Uint8Array(rgbaData.length);
  output.set(rgbaData);

  for (let i = 0; i < output.length; i += 4) {
    const r = output[i] ?? 0;
    const g = output[i + 1] ?? 0;
    const b = output[i + 2] ?? 0;

    // 1. Solid Chroma Green background detection (pure bright green screen)
    const isSolidChroma = g > 180 && g > r * 1.6 && g > b * 1.6 && (r < 80 || b < 80);
    const isPureGreen = g > 210 && r < 80 && b < 80;

    if (isSolidChroma || isPureGreen) {
      // Background pixel -> make 100% transparent
      output[i + 3] = 0;
      output[i + 1] = Math.min(g, Math.round((r + b) / 2));
    } else {
      // 2. Character/Edge pixel -> apply Green De-Spill filter to remove green fringe halos
      const avgRb = (r + b) / 2;
      if (g > avgRb) {
        output[i + 1] = Math.min(g, Math.round(avgRb));
      }
    }
  }

  return output;
}
