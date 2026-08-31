// ============================================================================
// GitHoot Authoritative Fail-Closed Single-Subject Image Gate
// (src/server/services/image/frame-gate.ts)
// Strictly enforces AGENTS.md Invariant #4 and GATES Quality Thresholds
// ============================================================================

import { GATES } from '../dna/contracts';
import { decodePngToRgba, encodeRgbaToPng } from './png-codec';
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

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

/**
 * Authoritative single-subject frame acceptance gate.
 * Validates PNG binary, applies chroma de-spill, runs contour + CCL gates,
 * and scales-to-fit into a clean 256x256 frame.
 */
export async function validateAndNormalizeFrame(
  rawBytes: Uint8Array
): Promise<FrameGateResult> {
  const reasons: string[] = [];

  // 1. Binary checks & Dimension Contract bounds
  if (!rawBytes || rawBytes.length < 50) {
    return { ok: false, reasons: ['Image binary too small (<50 bytes) or empty'] };
  }

  if (rawBytes.length > GATES.maxBytes) {
    return { ok: false, reasons: [`Image binary exceeds maximum allowed size (${rawBytes.length} > ${GATES.maxBytes} bytes)`] };
  }

  // Verify PNG magic header
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (rawBytes[i] !== PNG_MAGIC[i]) {
      return { ok: false, reasons: ['Invalid image format: buffer does not have valid PNG magic signature'] };
    }
  }

  // 2. Structural PNG decode
  let decoded;
  try {
    decoded = await decodePngToRgba(rawBytes);
  } catch (err) {
    return { ok: false, reasons: [`PNG structural decode failed: ${(err as Error).message}`] };
  }

  const { data: rawRgba, width, height } = decoded;

  if (width <= 0 || height <= 0) {
    return { ok: false, reasons: ['Image has invalid 0 dimensions'] };
  }

  if (width > GATES.maxSidePx || height > GATES.maxSidePx) {
    return { ok: false, reasons: [`Image dimensions exceed max allowed bounds (${width}x${height} > ${GATES.maxSidePx}x${GATES.maxSidePx})`] };
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
    rawBytesLength: rawBytes.length
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

  const rawSha256 = await sha256Hex(rawBytes);
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
