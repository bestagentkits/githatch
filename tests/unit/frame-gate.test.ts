// ============================================================================
// Phase 3: Fail-Closed Image Acceptance Gate Unit Tests
// (tests/unit/frame-gate.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { validateAndNormalizeFrame } from '../../src/server/services/image/frame-gate';
import { encodeRgbaToPng } from '../../src/server/services/image/png-codec';
import {
  createValidCenteredSubjectPng,
  createTransparentPng,
  createCollageEchoPng,
  createMultiSubjectPng,
  createScaleToFit1024Png,
  createOversizedPng,
  createTruncatedPng,
  createJpegBuffer,
  createTooSmallSubjectPng,
  createOverWideSubjectPng
} from '../integration/fixtures/images';

describe('Phase 3: Fail-Closed Image Acceptance Gate Invariants', () => {
  it('accepts valid single centered character, scales to fit into 256x256, and returns accurate sha256 digests', async () => {
    const validPng = createValidCenteredSubjectPng(256, 256);
    const result = await validateAndNormalizeFrame(validPng);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedPng).toBeDefined();
      expect(result.normalizedRgba256.length).toBe(256 * 256 * 4);
      expect(result.rawSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.frameSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.metrics.componentsCount).toBeGreaterThanOrEqual(1);
      expect(result.metrics.largeComponentsCount).toBeLessThanOrEqual(4);
      expect(result.metrics.dominanceRatio).toBeLessThanOrEqual(0.30);
    }
  });

  it('rejects 100% transparent / empty frame', async () => {
    const emptyPng = createTransparentPng(256, 256);
    const result = await validateAndNormalizeFrame(emptyPng);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('No character pixels detected') || r.includes('transparent'))).toBe(true);
    }
  });

  it('rejects binary buffer smaller than 50 bytes', async () => {
    const tinyBuffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = await validateAndNormalizeFrame(tinyBuffer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('too small'))).toBe(true);
    }
  });

  it('rejects binary buffer exceeding 4MB Dimension Contract limit', async () => {
    const hugeBuffer = new Uint8Array(4 * 1024 * 1024 + 100);
    hugeBuffer[0] = 0x89;
    hugeBuffer[1] = 0x50;
    hugeBuffer[2] = 0x4E;
    hugeBuffer[3] = 0x47;
    hugeBuffer[4] = 0x0D;
    hugeBuffer[5] = 0x0A;
    hugeBuffer[6] = 0x1A;
    hugeBuffer[7] = 0x0A;

    const result = await validateAndNormalizeFrame(hugeBuffer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('exceeds maximum allowed size'))).toBe(true);
    }
  });

  it('rejects unrecognized binary format (neither PNG nor JPEG)', async () => {
    const unknownBuffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(50).fill(0)]); // GIF89a
    const result = await validateAndNormalizeFrame(unknownBuffer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('does not match supported PNG or JPEG'))).toBe(true);
    }
  });

  it('rejects JPEG header dimension bomb (>1024px) before decoding', async () => {
    // Construct a synthetic JPEG with SOF0 marker specifying 2048x2048
    const bombJpeg = new Uint8Array([
      0xFF, 0xD8, // SOI
      0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, // APP0
      0xFF, 0xC0, 0x00, 0x11, 0x08, 0x08, 0x00, 0x08, 0x00, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, // SOF0: 2048x2048 (0x0800 x 0x0800)
      ...new Array(60).fill(0),
      0xFF, 0xD9 // EOI
    ]);

    const result = await validateAndNormalizeFrame(bombJpeg);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('exceed max allowed bounds'))).toBe(true);
    }
  });

  it('rejects MIME mismatch when claimedMime disagrees with binary signature', async () => {
    const validPng = createValidCenteredSubjectPng(256, 256);
    const result = await validateAndNormalizeFrame(validPng, { claimedMime: 'image/jpeg' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('MIME mismatch'))).toBe(true);
    }
  });
  it('rejects truncated PNG buffer', async () => {
    const truncated = createTruncatedPng();
    const result = await validateAndNormalizeFrame(truncated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('too small') || r.includes('Truncated') || r.includes('decode failed'))).toBe(true);
    }
  });

  it('rejects interlaced PNG buffer (interlaceMethod != 0)', async () => {
    const { crc32 } = await import('../../src/server/services/image/png-codec');
    const validPng = createValidCenteredSubjectPng(256, 256);
    const interlacedPng = new Uint8Array(validPng);
    interlacedPng[28] = 1; // Adam7 interlace in IHDR
    const ihdrTypeAndData = interlacedPng.subarray(12, 12 + 17);
    const crc = crc32(ihdrTypeAndData);
    new DataView(interlacedPng.buffer).setUint32(12 + 17, crc);

    const result = await validateAndNormalizeFrame(interlacedPng);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('interlaced') || r.includes('interlaceMethod'))).toBe(true);
    }
  });

  it('rejects PNG with corrupted CRC-32 checksum', async () => {
    const validPng = createValidCenteredSubjectPng(256, 256);
    const corrupted = new Uint8Array(validPng);
    corrupted[corrupted.length - 20] = corrupted[corrupted.length - 20]! ^ 0xff; // Corrupt IDAT data without updating CRC

    const result = await validateAndNormalizeFrame(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('CRC-32 mismatch') || r.includes('Corrupted') || r.includes('decode failed'))).toBe(true);
    }
  });

  it('rejects PNG with unsupported color type or invalid bit depth', async () => {
    const { crc32 } = await import('../../src/server/services/image/png-codec');
    const validPng = createValidCenteredSubjectPng(256, 256);
    const badColor = new Uint8Array(validPng);
    badColor[25] = 3; // ColorType 3 (indexed) unsupported
    const ihdrTypeAndData = badColor.subarray(12, 12 + 17);
    const crc = crc32(ihdrTypeAndData);
    new DataView(badColor.buffer).setUint32(12 + 17, crc);

    const result = await validateAndNormalizeFrame(badColor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('color type') || r.includes('Unsupported'))).toBe(true);
    }
  });

  it('rejects PNG with invalid scanline filter byte (>4)', async () => {
    const { createPngChunk, crc32 } = await import('../../src/server/services/image/png-codec');
    const width = 10;
    const height = 10;
    const stride = 1 + width * 4;
    const rawData = new Uint8Array(height * stride);
    rawData[0] = 5; // Invalid filter type 5 on scanline 0!

    // Compress rawData with deflate
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(rawData).catch(() => {});
    writer.close().catch(() => {});
    const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());

    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdrData = new Uint8Array(13);
    new DataView(ihdrData.buffer).setUint32(0, width);
    new DataView(ihdrData.buffer).setUint32(4, height);
    ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
    const ihdr = createPngChunk('IHDR', ihdrData);
    const idat = createPngChunk('IDAT', compressed);
    const iend = createPngChunk('IEND', new Uint8Array(0));

    const badFilterPng = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length);
    let pos = 0;
    badFilterPng.set(sig, pos); pos += sig.length;
    badFilterPng.set(ihdr, pos); pos += ihdr.length;
    badFilterPng.set(idat, pos); pos += idat.length;
    badFilterPng.set(iend, pos);

    const result = await validateAndNormalizeFrame(badFilterPng);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('Invalid PNG filter type') || r.includes('decode failed'))).toBe(true);
    }
  });

  it('rejects image with dimensions exceeding 1024x1024', async () => {
    const oversizedPng = await createOversizedPng();
    const result = await validateAndNormalizeFrame(oversizedPng);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('exceed max allowed bounds'))).toBe(true);
    }
  });
  it('rejects collage echo (>4 large components)', async () => {
    const collagePng = createCollageEchoPng(256, 256);
    const result = await validateAndNormalizeFrame(collagePng);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('Collage echo detected'))).toBe(true);
    }
  });

  it('rejects multi-subject (2nd largest component > 30% of main)', async () => {
    const multiSubjectPng = createMultiSubjectPng(256, 256);
    const result = await validateAndNormalizeFrame(multiSubjectPng);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('Multi-subject detected'))).toBe(true);
    }
  });

  it('rejects subject that is too small (<6% frame fill)', async () => {
    const tooSmallPng = createTooSmallSubjectPng(256, 256);
    const result = await validateAndNormalizeFrame(tooSmallPng);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('Subject fill ratio too small'))).toBe(true);
    }
  });

  it('rejects subject with over-wide aspect ratio (>3.2)', async () => {
    const overWidePng = createOverWideSubjectPng(256, 256);
    const result = await validateAndNormalizeFrame(overWidePng);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('Subject aspect ratio over-wide'))).toBe(true);
    }
  });

  it('scales 1024x1024 oversized model output to fit within 256x256 without blind cropping', async () => {
    const largePng = await createScaleToFit1024Png();
    const result = await validateAndNormalizeFrame(largePng);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedRgba256.length).toBe(256 * 256 * 4);
      // Non-zero pixels exist in normalized buffer
      let nonZeroCount = 0;
      for (let i = 3; i < result.normalizedRgba256.length; i += 4) {
        if (result.normalizedRgba256[i]! > 0) nonZeroCount++;
      }
      expect(nonZeroCount).toBeGreaterThan(100);
    }
  });

  it('re-running gate on retained raw bytes reproduces identical normalized frameSha256', async () => {
    const rawPng = createValidCenteredSubjectPng(256, 256);

    const run1 = await validateAndNormalizeFrame(rawPng);
    const run2 = await validateAndNormalizeFrame(rawPng);

    expect(run1.ok).toBe(true);
    expect(run2.ok).toBe(true);
    if (run1.ok && run2.ok) {
      expect(run1.rawSha256).toBe(run2.rawSha256);
      expect(run1.frameSha256).toBe(run2.frameSha256);
      expect(run1.normalizedPng).toEqual(run2.normalizedPng);
    }
  });
});
