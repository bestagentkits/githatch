// ============================================================================
// Deterministic Image Fixture Factory for Workers & TDD Gates
// (tests/integration/fixtures/images.ts)
// ============================================================================

import { encodeRgbaToPng, encodeRgbaToPngAsync, crc32 } from '../../../src/server/services/image/png-codec';
import { GATES } from '../../../src/server/services/dna/contracts';

/**
 * Creates a raw RGBA buffer of size (width x height) with transparent background
 */
function createBlankRgba(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height * 4);
}

/**
 * Draws a filled rectangle on RGBA buffer
 */
function fillRect(
  rgba: Uint8Array,
  width: number,
  height: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  r = 255,
  g = 50,
  b = 150,
  a = 255
): void {
  for (let y = ry; y < Math.min(ry + rh, height); y++) {
    for (let x = rx; x < Math.min(rx + rw, width); x++) {
      const idx = (y * width + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }
}

/**
 * 1. Valid centered single-subject frame (fill ~25%, 1 component, aspect ~1.0)
 */
export function createValidCenteredSubjectPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  const size = Math.floor(Math.min(width, height) * 0.5);
  const x = Math.floor((width - size) / 2);
  const y = Math.floor((height - size) / 2);
  fillRect(rgba, width, height, x, y, size, size, 0, 240, 255, 255);
  return encodeRgbaToPng(rgba, width, height);
}

export async function createValidCenteredSubjectPngAsync(width = 256, height = 256): Promise<Uint8Array> {
  const rgba = createBlankRgba(width, height);
  const size = Math.floor(Math.min(width, height) * 0.5);
  const x = Math.floor((width - size) / 2);
  const y = Math.floor((height - size) / 2);
  fillRect(rgba, width, height, x, y, size, size, 0, 240, 255, 255);
  return await encodeRgbaToPngAsync(rgba, width, height);
}

/**
 * 2. Fully transparent frame (0 fill)
 */
export function createTransparentPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  return encodeRgbaToPng(rgba, width, height);
}

/**
 * 3. Collage echo: >4 large components
 */
export function createCollageEchoPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  const compSize = Math.floor(Math.min(width, height) * 0.15);
  const offsets = [
    [20, 20],
    [100, 20],
    [180, 20],
    [20, 120],
    [100, 120],
    [180, 120]
  ];
  for (const [ox, oy] of offsets) {
    if (ox + compSize < width && oy + compSize < height) {
      fillRect(rgba, width, height, ox, oy, compSize, compSize, 255, 100, 0, 255);
    }
  }
  return encodeRgbaToPng(rgba, width, height);
}

/**
 * 4. Multi-subject: second component > 30% area of main component
 */
export function createMultiSubjectPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  fillRect(rgba, width, height, 40, 80, 80, 80, 0, 200, 255, 255);
  fillRect(rgba, width, height, 150, 80, 60, 60, 255, 0, 120, 255);
  return encodeRgbaToPng(rgba, width, height);
}

/**
 * 5. Scale-to-fit: 1024x1024 valid within-cap image (scales to 256 without clip)
 */
export async function createScaleToFit1024Png(): Promise<Uint8Array> {
  return await createValidCenteredSubjectPngAsync(GATES.maxSidePx, GATES.maxSidePx);
}

/**
 * 6. Oversized: >1024 px on side (1600x1600)
 */
export async function createOversizedPng(): Promise<Uint8Array> {
  const width = 1600;
  const height = 1600;
  const rgba = createBlankRgba(width, height);
  fillRect(rgba, width, height, 400, 400, 800, 800, 100, 200, 255, 255);
  return await encodeRgbaToPngAsync(rgba, width, height);
}

/**
 * 7. Truncated / corrupt PNG
 */
export function createTruncatedPng(): Uint8Array {
  const valid = createValidCenteredSubjectPng(256, 256);
  return valid.slice(0, 45);
}

/**
 * 8. JPEG magic buffer
 */
export function createJpegBuffer(): Uint8Array {
  const buf = new Uint8Array(128);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf.fill(0x55, 4);
  return buf;
}

/**
 * 9. Too-small subject (<6% fill ratio of total 256x256 frame)
 */
export function createTooSmallSubjectPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  fillRect(rgba, width, height, 118, 118, 20, 20, 255, 255, 0, 255);
  return encodeRgbaToPng(rgba, width, height);
}

/**
 * 10. Over-wide aspect subject (aspect ratio > 3.2)
 */
export function createOverWideSubjectPng(width = 256, height = 256): Uint8Array {
  const rgba = createBlankRgba(width, height);
  fillRect(rgba, width, height, 28, 113, 200, 30, 255, 50, 150, 255);
  return encodeRgbaToPng(rgba, width, height);
}

/**
 * 11. Interlaced PNG (IHDR interlace method byte = 1)
 */
export function createInterlacedPng(): Uint8Array {
  const valid = createValidCenteredSubjectPng(256, 256);
  const copy = new Uint8Array(valid);
  if (copy.length >= 33) {
    copy[28] = 1; // InterlaceMethod = 1 (Adam7)
    const crc = crc32(copy.subarray(12, 29));
    copy[29] = (crc >>> 24) & 0xff;
    copy[30] = (crc >>> 16) & 0xff;
    copy[31] = (crc >>> 8) & 0xff;
    copy[32] = crc & 0xff;
  }
  return copy;
}
