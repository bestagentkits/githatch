// ============================================================================
// GitHoot Genuine WASM WebP Lossless Codec (src/server/services/image/webp-encoder.ts)
// ============================================================================

import type { DecodedImage } from './png-codec';
import encode, { init as initEncode } from '@jsquash/webp/encode.js';
import decode, { init as initDecode } from '@jsquash/webp/decode.js';
import encWasm from '@jsquash/webp/codec/enc/webp_enc.wasm';
import decWasm from '@jsquash/webp/codec/dec/webp_dec.wasm';

let encoderReady: Promise<void> | null = null;
let decoderReady: Promise<void> | null = null;

/**
 * Normalizes static WASM imports (compiled WebAssembly.Module or raw Uint8Array/ArrayBuffer binary bytes)
 * into a compiled WebAssembly.Module for the @jsquash/webp initialization function.
 */
async function normalizeWasmModule(imported: unknown): Promise<WebAssembly.Module> {
  if (imported instanceof WebAssembly.Module) {
    return imported;
  }
  if (imported instanceof Uint8Array) {
    const copy = new Uint8Array(imported.byteLength);
    copy.set(imported);
    return new WebAssembly.Module(copy.buffer);
  }
  if (imported instanceof ArrayBuffer) {
    return new WebAssembly.Module(imported);
  }
  if (imported && typeof imported === 'object' && 'default' in imported) {
    const defaultExport = (imported as { default: unknown }).default;
    return normalizeWasmModule(defaultExport);
  }
  throw new Error('Unrecognized WASM import format for WebP codec');
}

async function ensureEncoderInitialized(): Promise<void> {
  if (!encoderReady) {
    encoderReady = (async () => {
      const module = await normalizeWasmModule(encWasm);
      await initEncode(module);
    })();
  }
  return encoderReady;
}

async function ensureDecoderInitialized(): Promise<void> {
  if (!decoderReady) {
    decoderReady = (async () => {
      const module = await normalizeWasmModule(decWasm);
      await initDecode(module);
    })();
  }
  return decoderReady;
}

/**
 * Encodes 32-bit RGBA pixel buffers into genuine Lossless WebP format via Google Squoosh WASM.
 * Pure Edge & Browser compatible, zero Node.js / fs runtime dependencies.
 */
export async function encodeRgbaToWebp(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array> {
  if (width <= 0 || height <= 0 || width > 16384 || height > 16384) {
    throw new Error(`Invalid WebP dimensions: ${width}x${height}`);
  }

  const expectedLength = width * height * 4;
  if (rgbaData.length < expectedLength) {
    throw new Error(`Buffer size mismatch: expected at least ${expectedLength} bytes, got ${rgbaData.length}`);
  }

  await ensureEncoderInitialized();
  const clamped = rgbaData instanceof Uint8ClampedArray ? rgbaData : new Uint8ClampedArray(rgbaData.buffer, rgbaData.byteOffset, expectedLength);
  
  // Real lossless WebP encoding with exact alpha and color preservation
  const buffer = await encode({ data: clamped, width, height }, { lossless: 1, exact: 1 });
  return new Uint8Array(buffer);
}

/**
 * Decodes WebP bytes into raw 32-bit RGBA pixels and dimensions via WASM.
 */
export async function decodeWebpToRgba(webpBytes: Uint8Array): Promise<DecodedImage> {
  await ensureDecoderInitialized();
  const copy = new Uint8Array(webpBytes.length);
  copy.set(webpBytes);
  const result = await decode(copy.buffer as ArrayBuffer);
  
  return {
    data: new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength),
    width: result.width,
    height: result.height
  };
}
