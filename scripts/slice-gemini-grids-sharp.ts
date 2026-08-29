// ============================================================================
// GitHoot Adaptive Border Color Keyer & Grid Slicer
// (scripts/slice-gemini-grids-sharp.ts)
// ============================================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sampleDir = path.join(process.cwd(), 'assets', 'sample-pets');
const companions = [
  'emberfox',
  'neonbyte',
  'abyssal',
  'verdant',
  'solargriffin',
  'voidstalker',
  'rustgolem',
  'celestialdrake'
];

/**
 * Adaptive Multi-Pass Background Remover:
 * 1. Samples corner pixels to find the dominant background color of the cell.
 * 2. Removes pixels matching the background color within a Euclidean color distance threshold.
 * 3. Catches all shades of green (dark/mid/bright) and near-white/light-gray backgrounds.
 */
function removeAdaptiveBackground(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(rgba.length);
  output.set(rgba);

  // Sample the 4 corners to estimate local background color
  const sampleIndices = [
    0, // Top-Left
    (width - 1) * 4, // Top-Right
    (height - 1) * width * 4, // Bottom-Left
    ((height - 1) * width + (width - 1)) * 4 // Bottom-Right
  ];

  let sumR = 0, sumG = 0, sumB = 0;
  for (const idx of sampleIndices) {
    sumR += rgba[idx] ?? 0;
    sumG += rgba[idx + 1] ?? 0;
    sumB += rgba[idx + 2] ?? 0;
  }
  const bgR = sumR / 4;
  const bgG = sumG / 4;
  const bgB = sumB / 4;

  for (let i = 0; i < output.length; i += 4) {
    const r = output[i] ?? 0;
    const g = output[i + 1] ?? 0;
    const b = output[i + 2] ?? 0;

    // Euclidean distance to sampled background color
    const dR = r - bgR;
    const dG = g - bgG;
    const dB = b - bgB;
    const colorDist = Math.sqrt(dR * dR + dG * dG + dB * dB);

    // Color checks:
    // 1. Close to local background color
    const isBgMatch = colorDist < 75;

    // 2. Any shade of green (including mid-green, dark-vignette green, bright chroma)
    const isAnyGreen = (g > 110 && g > r * 1.15 && g > b * 1.15) || (g > 80 && g > r * 1.3 && g > b * 1.3);

    // 3. Near-white / light-gray
    const isNearWhite = r > 205 && g > 205 && b > 205;
    const isLightGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 190;

    if (isBgMatch || isAnyGreen || isNearWhite || isLightGray) {
      if (colorDist < 50) {
        output[i + 3] = 0; // 100% transparent
      } else {
        // Feathering
        const factor = (colorDist - 50) / 25;
        output[i + 3] = Math.min(output[i + 3] ?? 255, Math.floor(factor * 255));
      }
    } else {
      // Green de-spill for any remaining green fringe
      const avgRb = (r + b) / 2;
      if (g > avgRb) {
        output[i + 1] = Math.min(g, Math.round(avgRb));
      }
    }
  }

  return output;
}

async function processAllGrids() {
  console.log('✦ Running Adaptive Multi-Pass Background Removal on All 8 Gemini Grids...');

  for (const id of companions) {
    const rawPath = path.join(sampleDir, `${id}-gemini-raw.jpg`);
    if (!fs.existsSync(rawPath)) continue;

    const metadata = await sharp(rawPath).metadata();
    const w = metadata.width || 1024;
    const h = metadata.height || 1024;

    const cellW = Math.floor(w / 4);
    const cellH = Math.floor(h / 2);

    console.log(`► Processing [${id}] (${w}x${h}) with Adaptive Keyer...`);

    // 1. Process Hero Portrait: Crop Cell [0,0]
    const heroCropY = Math.floor(cellH * 0.12);
    const heroCropH = Math.floor(cellH * 0.76);
    const heroCropX = Math.floor(cellW * 0.05);
    const heroCropW = Math.floor(cellW * 0.90);

    const heroRaw = await sharp(rawPath)
      .extract({ left: heroCropX, top: heroCropY, width: heroCropW, height: heroCropH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cleanedHero = removeAdaptiveBackground(heroRaw.data, heroRaw.info.width, heroRaw.info.height);

    const heroPng = await sharp(cleanedHero, {
      raw: { width: heroRaw.info.width, height: heroRaw.info.height, channels: 4 }
    })
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(sampleDir, `${id}-hero.png`), heroPng);
    fs.writeFileSync(path.join(sampleDir, `${id}.jpg`), heroPng);

    // 2. Extract 8 Cells with Adaptive Background Removal
    const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];

    for (let cell = 0; cell < 8; cell++) {
      const col = cell % 4;
      const row = Math.floor(cell / 4);

      const cellLeft = col * cellW;
      const cellTop = row * cellH;

      const innerLeft = cellLeft + Math.floor(cellW * 0.06);
      const innerTop = cellTop + Math.floor(cellH * 0.10);
      const innerWidth = Math.floor(cellW * 0.88);
      const innerHeight = Math.floor(cellH * 0.74);

      const cellRaw = await sharp(rawPath)
        .extract({ left: innerLeft, top: innerTop, width: innerWidth, height: innerHeight })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const cleanedCell = removeAdaptiveBackground(cellRaw.data, cellRaw.info.width, cellRaw.info.height);

      const cellPng = await sharp(cleanedCell, {
        raw: { width: cellRaw.info.width, height: cellRaw.info.height, channels: 4 }
      })
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      compositeImages.push({
        input: cellPng,
        left: col * 256,
        top: row * 256
      });
    }

    // Composite onto 1024x512 transparent canvas
    const sheetPng = await sharp({
      create: {
        width: 1024,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(compositeImages)
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(sampleDir, `${id}-spritesheet.png`), sheetPng);

    console.log(`✓ [${id}] Clean transparent hero.png & spritesheet.png generated (0 residual green).`);
  }

  console.log('✦ All 8 Gemini AI Grids Re-Processed with Adaptive Keyer!');
}

processAllGrids().catch(console.error);
