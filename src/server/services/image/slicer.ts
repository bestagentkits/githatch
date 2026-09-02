// ============================================================================
// GitHoot Smart Spritesheet Slicer & R2 Storage (src/server/services/image/slicer.ts)
// ============================================================================

import type { Env } from '../../types';
import { removeChromaGreen } from './chroma-removal';
import { decodePngToRgba, encodeRgbaToPng, type DecodedImage } from './png-codec';

export interface SlicedAssetsResult {
  heroImageUrl: string;
  spritesheetUrl: string;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Scans an RGBA buffer to find the actual bounding box of non-transparent pixels.
 */
export function findCharacterBoundingBox(
  rgba: Uint8Array,
  width: number,
  height: number
): BoundingBox {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = rgba[idx + 3] ?? 0;
      if (alpha > 20) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

/**
 * Copies and centers an extracted character pose into a target 256x256 canvas.
 */
export function centerCharacterPose(
  srcRgba: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth = 256,
  targetHeight = 256
): Uint8Array {
  const bbox = findCharacterBoundingBox(srcRgba, srcWidth, srcHeight);
  const targetRgba = new Uint8Array(targetWidth * targetHeight * 4);

  const offsetX = Math.floor((targetWidth - bbox.width) / 2);
  const offsetY = Math.floor((targetHeight - bbox.height) / 2);

  for (let y = 0; y < bbox.height; y++) {
    const srcY = bbox.minY + y;
    const destY = offsetY + y;
    if (destY < 0 || destY >= targetHeight) continue;

    for (let x = 0; x < bbox.width; x++) {
      const srcX = bbox.minX + x;
      const destX = offsetX + x;
      if (destX < 0 || destX >= targetWidth) continue;

      const srcIdx = (srcY * srcWidth + srcX) * 4;
      const destIdx = (destY * targetWidth + destX) * 4;

      targetRgba[destIdx] = srcRgba[srcIdx] ?? 0;
      targetRgba[destIdx + 1] = srcRgba[srcIdx + 1] ?? 0;
      targetRgba[destIdx + 2] = srcRgba[srcIdx + 2] ?? 0;
      targetRgba[destIdx + 3] = srcRgba[srcIdx + 3] ?? 0;
    }
  }

  return targetRgba;
}

/**
 * Crops a sub-rectangle from a full RGBA image buffer.
 */
export function cropRgbaRegion(
  sourceRgba: Uint8Array,
  sourceWidth: number,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number
): Uint8Array {
  const output = new Uint8Array(cropWidth * cropHeight * 4);

  for (let y = 0; y < cropHeight; y++) {
    const srcY = cropY + y;
    const srcOffset = (srcY * sourceWidth + cropX) * 4;
    const dstOffset = y * cropWidth * 4;

    for (let i = 0; i < cropWidth * 4; i++) {
      output[dstOffset + i] = sourceRgba[srcOffset + i] ?? 0;
    }
  }

  return output;
}

