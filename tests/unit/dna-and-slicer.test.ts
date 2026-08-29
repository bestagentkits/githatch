// ============================================================================
// GitHoot Unit Tests: DNA Generator, Slicer & PNG Codec
// (tests/unit/dna-and-slicer.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { deriveGuardianDNA, rollRarityTier } from '../../src/server/services/dna/seed';
import { removeChromaGreen } from '../../src/server/services/image/chroma-removal';
import { encodeRgbaToPng, decodePngToRgba } from '../../src/server/services/image/png-codec';
import { findCharacterBoundingBox, centerCharacterPose } from '../../src/server/services/image/slicer';

describe('Deterministic DNA Generator', () => {
  it('produces identical DNA for same GitHub User ID', async () => {
    const dna1 = await deriveGuardianDNA(583231, 'octocat', ['TypeScript']);
    const dna2 = await deriveGuardianDNA(583231, 'octocat', ['TypeScript']);

    expect(dna1.dna_seed).toBe(dna2.dna_seed);
    expect(dna1.egg_archetype_id).toBe(dna2.egg_archetype_id);
    expect(dna1.species).toBe(dna2.species);
    expect(dna1.rarity_tier).toBe(dna2.rarity_tier);
  });

  it('maps Rust/Go to Fire archetype and TypeScript to Cyber archetype', async () => {
    const rustDna = await deriveGuardianDNA(12345, 'rustacean', ['Rust']);
    expect(rustDna.element).toBe('Fire');

    const tsDna = await deriveGuardianDNA(67890, 'webdev', ['TypeScript']);
    expect(tsDna.element).toBe('Cyber');
  });

  it('rolls rarity tiers according to percentage thresholds', () => {
    expect(rollRarityTier(995)).toBe('Mythic');
    expect(rollRarityTier(960)).toBe('Legendary');
    expect(rollRarityTier(880)).toBe('Epic');
    expect(rollRarityTier(650)).toBe('Rare');
    expect(rollRarityTier(300)).toBe('Common');
  });
});

describe('Chroma Key & Green De-Spill Engine', () => {
  it('turns pure green #00FF00 pixels into 100% transparent alpha', () => {
    const width = 2;
    const height = 2;
    const rgba = new Uint8Array([
      0, 255, 0, 255,   // Pure Green #00FF00 -> Should become alpha 0
      255, 0, 0, 255,   // Red -> Should stay alpha 255
      0, 0, 255, 255,   // Blue -> Should stay alpha 255
      20, 240, 20, 255  // Green tint -> Should become alpha 0
    ]);

    const cleaned = removeChromaGreen(rgba, width, height);

    expect(cleaned[3]).toBe(0);   // Alpha 0 for green
    expect(cleaned[7]).toBe(255); // Alpha 255 for red
    expect(cleaned[11]).toBe(255);// Alpha 255 for blue
    expect(cleaned[15]).toBe(0);  // Alpha 0 for green tint
  });

  it('applies green de-spill to boundary pixels', () => {
    const width = 1;
    const height = 1;
    const rgba = new Uint8Array([
      100, 200, 100, 255 // Edge pixel: Green (200) > avg(100+100)=100
    ]);

    const cleaned = removeChromaGreen(rgba, width, height);
    expect(cleaned[1]).toBeLessThanOrEqual(100); // Green capped to avg(r+b)
  });
});

describe('Pure TypeScript PNG Codec', () => {
  it('encodes and decodes RGBA buffer with lossless fidelity', async () => {
    const width = 4;
    const height = 4;
    const original = new Uint8Array(width * height * 4);

    for (let i = 0; i < original.length; i += 4) {
      original[i] = 200;     // R
      original[i + 1] = 100; // G
      original[i + 2] = 50;  // B
      original[i + 3] = 255; // A
    }

    const pngBytes = encodeRgbaToPng(original, width, height);
    expect(pngBytes.length).toBeGreaterThan(50);
    expect(pngBytes[0]).toBe(0x89);
    expect(pngBytes[1]).toBe(0x50); // 'P'
    expect(pngBytes[2]).toBe(0x4e); // 'N'
    expect(pngBytes[3]).toBe(0x47); // 'G'

    const decoded = await decodePngToRgba(pngBytes);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.data[0]).toBe(200);
    expect(decoded.data[1]).toBe(100);
    expect(decoded.data[2]).toBe(50);
    expect(decoded.data[3]).toBe(255);
  });
});

describe('Smart Bounding Box & Centering', () => {
  it('locates character bounding box and centers on 256x256 frame', () => {
    const width = 100;
    const height = 100;
    const rgba = new Uint8Array(width * height * 4);

    // Place a 20x20 character block at (x: 10..30, y: 10..30)
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      }
    }

    const bbox = findCharacterBoundingBox(rgba, width, height);
    expect(bbox.minX).toBe(10);
    expect(bbox.minY).toBe(10);
    expect(bbox.maxX).toBe(29);
    expect(bbox.maxY).toBe(29);
    expect(bbox.width).toBe(20);
    expect(bbox.height).toBe(20);

    const centered = centerCharacterPose(rgba, width, height, 256, 256);
    expect(centered.length).toBe(256 * 256 * 4);

    // Bounding box of centered pose should be roughly centered around x=128, y=128
    const centeredBbox = findCharacterBoundingBox(centered, 256, 256);
    const centerX = centeredBbox.minX + centeredBbox.width / 2;
    const centerY = centeredBbox.minY + centeredBbox.height / 2;

    expect(Math.abs(centerX - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(centerY - 128)).toBeLessThanOrEqual(2);
  });
});
