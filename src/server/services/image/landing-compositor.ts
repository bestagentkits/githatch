// ============================================================================
// GitHoot 16-Pose Landing Compositor (src/server/services/image/landing-compositor.ts)
// ============================================================================

export interface FramePlacement {
  sheet: { left: number; top: number };
  strip: { left: number; top: number };
}

export function calculateFramePlacement(
  index: number,
  frameSize = 256,
  cols = 4
): FramePlacement {
  const col = index % cols;
  const row = Math.floor(index / cols);

  return {
    sheet: { left: col * frameSize, top: row * frameSize },
    strip: { left: index * frameSize, top: 0 }
  };
}

export function validateCompositorInputs(
  frames: Uint8Array[],
  expectedCount = 16
): boolean {
  if (!Array.isArray(frames) || frames.length !== expectedCount) {
    throw new Error(`Invalid compositor inputs: expected exactly ${expectedCount} frames, got ${frames?.length}`);
  }
  return true;
}

export interface CompositedLandingBuffers {
  sheetRgba: Uint8Array;
  sheetWidth: number;
  sheetHeight: number;
  stripRgba: Uint8Array;
  stripWidth: number;
  stripHeight: number;
}

/**
 * Composites 16 RGBA frame buffers (each frameSize x frameSize) into
 * a 4x4 Sheet (1024x1024) and a 16-frame Strip (4096x256).
 */
export function compositeLandingSheetAndStrip(
  frames: Uint8Array[],
  frameSize = 256,
  cols = 4,
  rows = 4
): CompositedLandingBuffers {
  validateCompositorInputs(frames, cols * rows);

  const sheetWidth = cols * frameSize;
  const sheetHeight = rows * frameSize;
  const sheetRgba = new Uint8Array(sheetWidth * sheetHeight * 4);

  const stripWidth = frames.length * frameSize;
  const stripHeight = frameSize;
  const stripRgba = new Uint8Array(stripWidth * stripHeight * 4);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { sheet, strip } = calculateFramePlacement(i, frameSize, cols);

    // Blit onto 4x4 Sheet
    for (let y = 0; y < frameSize; y++) {
      const srcRowStart = y * frameSize * 4;
      const sheetDstStart = ((sheet.top + y) * sheetWidth + sheet.left) * 4;
      sheetRgba.set(frame.subarray(srcRowStart, srcRowStart + frameSize * 4), sheetDstStart);

      // Blit onto 16-Frame Strip
      const stripDstStart = ((strip.top + y) * stripWidth + strip.left) * 4;
      stripRgba.set(frame.subarray(srcRowStart, srcRowStart + frameSize * 4), stripDstStart);
    }
  }

  return {
    sheetRgba,
    sheetWidth,
    sheetHeight,
    stripRgba,
    stripWidth,
    stripHeight
  };
}
