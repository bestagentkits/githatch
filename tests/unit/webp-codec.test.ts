// ============================================================================
// Genuine WebP Codec Pixel-Level Unit Tests (tests/unit/webp-codec.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { encodeRgbaToWebp, decodeWebpToRgba } from '../../src/server/services/image/webp-encoder';

describe('Lossless WASM WebP Codec with Pixel Comparison', () => {
  it('encodes and decodes RGBA buffer preserving dimensions, alpha, and colors', async () => {
    const width = 32;
    const height = 32;
    const originalRgba = new Uint8Array(width * height * 4);

    // Create gradient pattern with distinct alpha channel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        originalRgba[idx] = (x * 8) & 255;       // R
        originalRgba[idx + 1] = (y * 8) & 255;   // G
        originalRgba[idx + 2] = 200;             // B
        originalRgba[idx + 3] = x < 16 ? 255 : 128; // Alpha step
      }
    }

    const webpBytes = await encodeRgbaToWebp(originalRgba, width, height);
    expect(webpBytes).toBeInstanceOf(Uint8Array);
    expect(webpBytes.length).toBeGreaterThan(20);

    // Validate RIFF & WEBP magic headers
    const headerStr = String.fromCharCode(...webpBytes.slice(0, 4));
    expect(headerStr).toBe('RIFF');
    const webpStr = String.fromCharCode(...webpBytes.slice(8, 12));
    expect(webpStr).toBe('WEBP');

    // Decode via WASM and Pixel Compare
    const decoded = await decodeWebpToRgba(webpBytes);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.data.length).toBe(width * height * 4);

    // Sample pixel checks (lossless fidelity)
    expect(decoded.data[0]).toBe(originalRgba[0]);
    expect(decoded.data[1]).toBe(originalRgba[1]);
    expect(decoded.data[2]).toBe(originalRgba[2]);
    expect(decoded.data[3]).toBe(originalRgba[3]);

    // Check semi-transparent pixel at x=20, y=10
    const testIdx = (10 * width + 20) * 4;
    expect(decoded.data[testIdx + 3]).toBe(128);
  });

  it('rejects invalid dimensions', async () => {
    const rgba = new Uint8Array(16);
    await expect(encodeRgbaToWebp(rgba, 0, 10)).rejects.toThrow(/invalid/i);
    await expect(encodeRgbaToWebp(rgba, 10, -5)).rejects.toThrow(/invalid/i);
  });
});
