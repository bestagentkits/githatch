// ============================================================================
// GitHoot Pure JavaScript JPEG Decoder for Cloudflare Workers & Node.js
// (src/server/services/image/jpeg-decoder.ts)
// Zero-WASM dependency, 100% pure JS execution for Cloudflare Workers runtime
// ============================================================================

import jpeg from 'jpeg-js';
import { encodeRgbaToPng } from './png-codec';

export interface DecodedJpegResult {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];

export function isJpegBinary(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 3) return false;
  return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

/**
 * Decodes JPEG binary buffer into raw 32-bit RGBA pixels using pure JavaScript decoder.
 */
export async function decodeJpegToRgba(jpegBytes: Uint8Array): Promise<DecodedJpegResult> {
  const decoded = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: true });
  return {
    data: decoded.data,
    width: decoded.width,
    height: decoded.height
  };
}

/**
 * Converts JPEG bytes to standard PNG format if input is JPEG,
 * otherwise returns original bytes.
 */
export async function ensurePngBytes(rawBytes: Uint8Array): Promise<Uint8Array> {
  if (isJpegBinary(rawBytes)) {
    const decoded = await decodeJpegToRgba(rawBytes);
    return encodeRgbaToPng(decoded.data, decoded.width, decoded.height);
  }
  return rawBytes;
}
