// ============================================================================
// GitHoot Authoritative Fail-Closed Single-Subject Image Gate
// (src/server/services/image/frame-gate.ts)
// Strictly enforces AGENTS.md Invariant #4 and GATES Quality Thresholds
// ============================================================================

import { GATES } from '../dna/contracts';
import { decodePngToRgba, encodeRgbaToPng } from './png-codec';
import { decodeJpegToRgba, isJpegBinary } from './jpeg-decoder';
import { removeChromaGreen } from './chroma-removal';
import { findCharacterBoundingBox, type BoundingBox } from './slicer';
import { analyzeConnectedComponents, type CclResult } from './connected-components';
import { scaleAndCenterCharacter } from './scale-to-fit';
import { sha256Hex } from '../crypto/web-crypto';

export interface FrameGateMetrics {
  width: number;
  height: number;
  bbox: BoundingBox;
  fillRatio: number;
  aspectRatio: number;
  componentsCount: number;
  largeComponentsCount: number;
  dominanceRatio: number;
  rawBytesLength: number;
  format: 'png' | 'jpeg';
}

export type FrameGateResult =
  | {
      ok: true;
      normalizedPng: Uint8Array;
      normalizedRgba256: Uint8Array;
      rawSha256: string;
      frameSha256: string;
      metrics: FrameGateMetrics;
    }
  | {
      ok: false;
      reasons: string[];
      metrics?: Partial<FrameGateMetrics>;
    };

export const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

export function isPngBinary(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < PNG_MAGIC.length) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

/**
 * Parses PNG dimensions directly from IHDR chunk with 0 allocations.
 */
export function parsePngHeaderDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPngBinary(bytes) || bytes.length < 24) return null;
  // IHDR chunk: 4 bytes length (offset 8) + 4 bytes 'IHDR' (offset 12) + 4 bytes width + 4 bytes height
  const isIhdr = bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
  if (!isIhdr) return null;
  const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  return { width, height };
}

/**
 * Parses JPEG dimensions directly from SOF0/SOF2 marker segments with 0 allocations.
 * Rejects dimension bombs before passing to WASM/codec.
 */
export function parseJpegHeaderDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isJpegBinary(bytes) || bytes.length < 4) return null;
  let offset = 2;
  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    // Standalone markers without length
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      continue;
    }
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2) break;

    // Start of Frame markers: 0xC0 (baseline), 0xC1 (extended), 0xC2 (progressive)
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      if (offset + 7 > bytes.length) break;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return { width, height };
    }
    offset += length;
  }
  return null;
}

/**
 * Authoritative single-subject frame acceptance gate.
 * Validates binary bounds, extracts header dimensions, verifies format/MIME agreement,
 * decodes to RGBA, applies chroma de-spill, runs contour + CCL gates, and produces normalized 256x256 PNG.
 */
export async function validateAndNormalizeFrame(
  rawBytes: Uint8Array,
  options: { claimedMime?: string } = {}
): Promise<FrameGateResult> {
  const reasons: string[] = [];

  // 1. Binary checks & Dimension Contract bounds (Pre-Decode / Pre-WASM)
  if (!rawBytes || rawBytes.length < 50) {
    return { ok: false, reasons: ['Image binary too small (<50 bytes) or empty'] };
  }

  if (rawBytes.length > GATES.maxBytes) {
    return { ok: false, reasons: [`Image binary exceeds maximum allowed size (${rawBytes.length} > ${GATES.maxBytes} bytes)`] };
  }

  const rawSha256 = await sha256Hex(rawBytes);

  let detectedFormat: 'png' | 'jpeg' | null = null;
  let headerDims: { width: number; height: number } | null = null;

  if (isPngBinary(rawBytes)) {
    detectedFormat = 'png';
    if (options.claimedMime && options.claimedMime !== 'image/png') {
      return { ok: false, reasons: [`MIME mismatch: claimed "${options.claimedMime}" but buffer signature is PNG`] };
    }
    headerDims = parsePngHeaderDimensions(rawBytes);
  } else if (isJpegBinary(rawBytes)) {
    detectedFormat = 'jpeg';
    if (options.claimedMime && options.claimedMime !== 'image/jpeg') {
      return { ok: false, reasons: [`MIME mismatch: claimed "${options.claimedMime}" but buffer signature is JPEG`] };
    }
    headerDims = parseJpegHeaderDimensions(rawBytes);
  } else {
    return { ok: false, reasons: ['Invalid image format: buffer does not match supported PNG or JPEG magic signatures'] };
  }

  if (!headerDims || headerDims.width <= 0 || headerDims.height <= 0) {
    return { ok: false, reasons: ['Failed to parse image dimensions from binary header'] };
  }

  // Pre-decode dimension-bomb guard
  if (headerDims.width > GATES.maxSidePx || headerDims.height > GATES.maxSidePx) {
    return { ok: false, reasons: [`Image dimensions exceed max allowed bounds (${headerDims.width}x${headerDims.height} > ${GATES.maxSidePx}x${GATES.maxSidePx})`] };
  }

  // 2. Decode verified bytes into raw 32-bit RGBA pixels
  let rawRgba: Uint8Array | Uint8ClampedArray;
  let width: number;
  let height: number;

  try {
    if (detectedFormat === 'png') {
      const decoded = await decodePngToRgba(rawBytes);
      rawRgba = decoded.data;
      width = decoded.width;
      height = decoded.height;
    } else {
      const decoded = await decodeJpegToRgba(rawBytes);
      rawRgba = decoded.data;
      width = decoded.width;
      height = decoded.height;
    }
  } catch (decodeErr) {
    return { ok: false, reasons: [`Image structural decode failed: ${(decodeErr as Error).message}`] };
  }

  if (width <= 0 || height <= 0) {
    return { ok: false, reasons: ['Image has invalid 0 dimensions after decode'] };
  }

  // 3. Green De-Spill Chroma Removal
  const cleanedRgba = removeChromaGreen(rawRgba, width, height);

  // 4. Bounding Box & Contour Detection
  const bbox = findCharacterBoundingBox(cleanedRgba, width, height);
  if (!bbox || bbox.width === 0 || bbox.height === 0) {
    return { ok: false, reasons: ['No character pixels detected (image is 100% transparent after chroma removal)'] };
  }
  const totalPixels = width * height;
  const bboxArea = bbox.width * bbox.height;
  const fillRatio = Math.round((bboxArea / totalPixels) * 1000) / 1000;
  const aspectRatio = Math.round((bbox.width / Math.max(1, bbox.height)) * 1000) / 1000;

  // Check fill ratio gate
  if (fillRatio < GATES.minBboxFill) {
    reasons.push(`Subject fill ratio too small: ${fillRatio} < minimum ${GATES.minBboxFill}`);
  }

  // Check aspect ratio gate
  if (aspectRatio > GATES.maxBboxAspect) {
    reasons.push(`Subject aspect ratio over-wide: ${aspectRatio} > maximum ${GATES.maxBboxAspect}`);
  }

  // 5. Connected Component Analysis (CCL)
  const ccl: CclResult = analyzeConnectedComponents(cleanedRgba, width, height, GATES.alphaThreshold, GATES.componentMinAreaRatio);

  // Check collage echo (>4 large components)
  if (ccl.largeComponentsCount > GATES.maxLargeComponents) {
    reasons.push(`Collage echo detected: ${ccl.largeComponentsCount} large components > maximum allowed ${GATES.maxLargeComponents}`);
  }
  // Check multi-subject dominance (2nd component > 30% of main)
  if (ccl.dominanceRatio > GATES.dominanceRatio) {
    reasons.push(`Multi-subject detected: 2nd largest component is ${Math.round(ccl.dominanceRatio * 100)}% of main (> 30% threshold)`);
  }

  const metrics: FrameGateMetrics = {
    width,
    height,
    bbox,
    fillRatio,
    aspectRatio,
    componentsCount: ccl.totalComponents,
    largeComponentsCount: ccl.largeComponentsCount,
    dominanceRatio: ccl.dominanceRatio,
    rawBytesLength: rawBytes.length,
    format: detectedFormat
  };

  if (reasons.length > 0) {
    return { ok: false, reasons, metrics };
  }

  // 6. Scale-To-Fit Preserving Aspect & Center on 256x256 Canvas
  const normalizedRgba256 = scaleAndCenterCharacter(cleanedRgba, width, height, bbox, {
    targetWidth: 256,
    targetHeight: 256,
    maxFitDimension: 230
  });

  const normalizedPng = encodeRgbaToPng(normalizedRgba256, 256, 256);
  const frameSha256 = await sha256Hex(normalizedPng);

  return {
    ok: true,
    normalizedPng,
    normalizedRgba256,
    rawSha256,
    frameSha256,
    metrics
  };
}
