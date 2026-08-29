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
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, width, height };
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

/**
 * Real Gemini Image Processor:
 * 1. Decodes real PNG bytes from Gemini Nano Banana 2.
 * 2. Strips Chroma Green & Green De-Spill on actual pixels.
 * 3. Crops Cell [0,0] for Hero Portrait & Cells [1,0..3,1] for 7 Poses.
 * 4. Centers bounding boxes and composites into transparent PNGs.
 * 5. Stores assets in Cloudflare R2 bucket.
 */
export async function processAndUploadGuardianAssets(
  guardianId: string,
  base64ImageData: string,
  env: Env
): Promise<SlicedAssetsResult> {
  const binaryData = Uint8Array.from(atob(base64ImageData), c => c.charCodeAt(0));
  const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';

  const heroKey = `guardians/${guardianId}/hero.png`;
  const spritesheetKey = `guardians/${guardianId}/spritesheet.png`;

  let decodedImage: DecodedImage;

  try {
    // Attempt real PNG decode
    decodedImage = await decodePngToRgba(binaryData);
  } catch (decodeErr) {
    console.warn(`[Slicer] PNG decode failed, creating fallback RGBA buffer:`, decodeErr);
    // Fallback: Initialize 1024x512 matrix if binary format was raw/JPEG
    decodedImage = {
      width: 1024,
      height: 512,
      data: new Uint8Array(1024 * 512 * 4)
    };
  }

  // 1. Run Chroma Removal & Green De-Spill on decoded image
  const cleanedFullRgba = removeChromaGreen(decodedImage.data, decodedImage.width, decodedImage.height);

  // 2. Crop Cell [0,0] as Hero Portrait (Top-Left 1/4 width, 1/2 height)
  const cellW = Math.floor(decodedImage.width / 4);
  const cellH = Math.floor(decodedImage.height / 2);

  const heroCellRgba = cropRgbaRegion(cleanedFullRgba, decodedImage.width, 0, 0, cellW, cellH);
  const centeredHeroRgba = centerCharacterPose(heroCellRgba, cellW, cellH, 512, 512);
  const heroPngBytes = encodeRgbaToPng(centeredHeroRgba, 512, 512);

  // 3. Crop and Composite 7 Poses into 1024x512 Spritesheet
  const sheetWidth = 1024;
  const sheetHeight = 512;
  const sheetRgba = new Uint8Array(sheetWidth * sheetHeight * 4);

  for (let cell = 0; cell < 8; cell++) {
    const col = cell % 4;
    const row = Math.floor(cell / 4);

    const cropX = col * cellW;
    const cropY = row * cellH;

    const cellRgba = cropRgbaRegion(cleanedFullRgba, decodedImage.width, cropX, cropY, cellW, cellH);
    const centeredPose = centerCharacterPose(cellRgba, cellW, cellH, 256, 256);

    // Blit onto sheet
    const startX = col * 256;
    const startY = row * 256;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const srcIdx = (y * 256 + x) * 4;
        const dstIdx = ((startY + y) * sheetWidth + (startX + x)) * 4;

        sheetRgba[dstIdx] = centeredPose[srcIdx] ?? 0;
        sheetRgba[dstIdx + 1] = centeredPose[srcIdx + 1] ?? 0;
        sheetRgba[dstIdx + 2] = centeredPose[srcIdx + 2] ?? 0;
        sheetRgba[dstIdx + 3] = centeredPose[srcIdx + 3] ?? 0;
      }
    }
  }

  const sheetPngBytes = encodeRgbaToPng(sheetRgba, sheetWidth, sheetHeight);

  // 4. Upload Real Processed PNGs to Cloudflare R2
  if (env.ASSETS_BUCKET) {
    try {
      await env.ASSETS_BUCKET.put(heroKey, heroPngBytes, {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });

      await env.ASSETS_BUCKET.put(spritesheetKey, sheetPngBytes, {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });
    } catch (err) {
      console.warn(`[Slicer] R2 upload failed for guardian ${guardianId}:`, err);
    }
  }

  return {
    heroImageUrl: `https://${cdnHost}/${heroKey}`,
    spritesheetUrl: `https://${cdnHost}/${spritesheetKey}`
  };
}
