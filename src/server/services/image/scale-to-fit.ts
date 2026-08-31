// ============================================================================
// GitHoot Aspect-Preserving Scale-To-Fit & Centering Resampler
// (src/server/services/image/scale-to-fit.ts)
// ============================================================================

import type { BoundingBox } from './slicer';
import { cropRgbaRegion } from './slicer';

export interface ScaleToFitOptions {
  targetWidth?: number;
  targetHeight?: number;
  maxFitDimension?: number; // e.g. 240px to leave clean margin
}

/**
 * Resamples an RGBA buffer using bilinear interpolation.
 */
export function resampleBilinear(
  srcRgba: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8Array {
  const dstRgba = new Uint8Array(dstWidth * dstHeight * 4);
  if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) {
    return dstRgba;
  }

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let dy = 0; dy < dstHeight; dy++) {
    const srcY = (dy + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.min(srcHeight - 1, Math.floor(srcY)));
    const y1 = Math.max(0, Math.min(srcHeight - 1, y0 + 1));
    const yFrac = Math.max(0, Math.min(1, srcY - y0));

    for (let dx = 0; dx < dstWidth; dx++) {
      const srcX = (dx + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.min(srcWidth - 1, Math.floor(srcX)));
      const x1 = Math.max(0, Math.min(srcWidth - 1, x0 + 1));
      const xFrac = Math.max(0, Math.min(1, srcX - x0));

      const idx00 = (y0 * srcWidth + x0) * 4;
      const idx10 = (y0 * srcWidth + x1) * 4;
      const idx01 = (y1 * srcWidth + x0) * 4;
      const idx11 = (y1 * srcWidth + x1) * 4;

      const dstIdx = (dy * dstWidth + dx) * 4;

      for (let c = 0; c < 4; c++) {
        const top = srcRgba[idx00 + c]! * (1 - xFrac) + srcRgba[idx10 + c]! * xFrac;
        const bottom = srcRgba[idx01 + c]! * (1 - xFrac) + srcRgba[idx11 + c]! * xFrac;
        dstRgba[dstIdx + c] = Math.round(top * (1 - yFrac) + bottom * yFrac);
      }
    }
  }

  return dstRgba;
}

/**
 * Extracts a character bounding box from source RGBA, scales it to fit within
 * the target dimension preserving aspect ratio, and centers it on a target transparent canvas.
 */
export function scaleAndCenterCharacter(
  srcRgba: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  bbox: BoundingBox,
  options: ScaleToFitOptions = {}
): Uint8Array {
  const targetWidth = options.targetWidth || 256;
  const targetHeight = options.targetHeight || 256;
  const maxFit = options.maxFitDimension || 230; // Chibi margin
  const canvas = new Uint8Array(targetWidth * targetHeight * 4);

  if (bbox.width <= 0 || bbox.height <= 0) {
    return canvas;
  }
  const croppedRgba = cropRgbaRegion(
    srcRgba,
    srcWidth,
    bbox.minX,
    bbox.minY,
    bbox.width,
    bbox.height
  );
  // 2. Compute aspect-preserving scaled dimensions
  const scale = Math.min(maxFit / bbox.width, maxFit / bbox.height, 1.0); // Scale down if larger, keep <= 1.0 or scale to fit
  const scaledWidth = Math.max(1, Math.round(bbox.width * scale));
  const scaledHeight = Math.max(1, Math.round(bbox.height * scale));

  // 3. Resample cropped character
  const scaledRgba = (scaledWidth === bbox.width && scaledHeight === bbox.height)
    ? croppedRgba
    : resampleBilinear(croppedRgba, bbox.width, bbox.height, scaledWidth, scaledHeight);

  // 4. Place in center of target canvas
  const offsetX = Math.floor((targetWidth - scaledWidth) / 2);
  const offsetY = Math.floor((targetHeight - scaledHeight) / 2);

  for (let y = 0; y < scaledHeight; y++) {
    const dstY = offsetY + y;
    if (dstY < 0 || dstY >= targetHeight) continue;

    for (let x = 0; x < scaledWidth; x++) {
      const dstX = offsetX + x;
      if (dstX < 0 || dstX >= targetWidth) continue;

      const srcIdx = (y * scaledWidth + x) * 4;
      const dstIdx = (dstY * targetWidth + dstX) * 4;

      canvas[dstIdx] = scaledRgba[srcIdx]!;
      canvas[dstIdx + 1] = scaledRgba[srcIdx + 1]!;
      canvas[dstIdx + 2] = scaledRgba[srcIdx + 2]!;
      canvas[dstIdx + 3] = scaledRgba[srcIdx + 3]!;
    }
  }

  return canvas;
}
