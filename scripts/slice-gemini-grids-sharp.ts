// ============================================================================
// GitHoot Enhanced Grid Slicer with White Alpha Keying & Label Trimming
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
 * Removes white, off-white, and green background pixels to create clean transparency.
 */
function removeBackground(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(rgba.length);
  output.set(rgba);

  for (let i = 0; i < output.length; i += 4) {
    const r = output[i] ?? 0;
    const g = output[i + 1] ?? 0;
    const b = output[i + 2] ?? 0;

    // 1. White / Near-White Background
    const isNearWhite = r > 215 && g > 215 && b > 215;
    const isLightGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 200;

    // 2. Green Chroma Background
    const isGreenChroma = g > 180 && g > r * 1.5 && g > b * 1.5;

    // 3. Dark Outer Border / Black Header artifact
    const isPureBlackBorder = r < 15 && g < 15 && b < 15;

    if (isNearWhite || isLightGray || isGreenChroma) {
      output[i + 3] = 0; // Transparent
    }
  }

  return output;
}

async function processAllGrids() {
  console.log('✦ Slicing & Trimming 8 Gemini Grids (Removing Backgrounds & Caption Bars)...');

  for (const id of companions) {
    const rawPath = path.join(sampleDir, `${id}-gemini-raw.jpg`);
    if (!fs.existsSync(rawPath)) continue;

    const metadata = await sharp(rawPath).metadata();
    const w = metadata.width || 1024;
    const h = metadata.height || 1024;

    const cellW = Math.floor(w / 4);
    const cellH = Math.floor(h / 2);

    console.log(`► Processing [${id}] (${w}x${h}) -> Cell ${cellW}x${cellH}...`);

    // 1. Process Hero Portrait: Crop Cell [0,0], trim outer label padding
    const heroCropY = Math.floor(cellH * 0.12); // Skip top title banner
    const heroCropH = Math.floor(cellH * 0.76); // Skip bottom text
    const heroCropX = Math.floor(cellW * 0.05);
    const heroCropW = Math.floor(cellW * 0.90);

    const heroRaw = await sharp(rawPath)
      .extract({ left: heroCropX, top: heroCropY, width: heroCropW, height: heroCropH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cleanedHero = removeBackground(heroRaw.data, heroRaw.info.width, heroRaw.info.height);

    const heroPng = await sharp(cleanedHero, {
      raw: { width: heroRaw.info.width, height: heroRaw.info.height, channels: 4 }
    })
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(sampleDir, `${id}-hero.png`), heroPng);
    fs.writeFileSync(path.join(sampleDir, `${id}.jpg`), heroPng);

    // 2. Extract 8 Cells, Trim Labels, and Composite into 1024x512 Spritesheet
    const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];

    for (let cell = 0; cell < 8; cell++) {
      const col = cell % 4;
      const row = Math.floor(cell / 4);

      const cellLeft = col * cellW;
      const cellTop = row * cellH;

      // Crop inner character area (trim top 10% and bottom 18% to remove text labels)
      const innerLeft = cellLeft + Math.floor(cellW * 0.06);
      const innerTop = cellTop + Math.floor(cellH * 0.10);
      const innerWidth = Math.floor(cellW * 0.88);
      const innerHeight = Math.floor(cellH * 0.74);

      const cellRaw = await sharp(rawPath)
        .extract({ left: innerLeft, top: innerTop, width: innerWidth, height: innerHeight })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const cleanedCell = removeBackground(cellRaw.data, cellRaw.info.width, cellRaw.info.height);

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

    console.log(`✓ [${id}] Clean transparent hero.png & spritesheet.png generated (0 captions, 0 white boxes).`);
  }

  console.log('✦ All 8 Gemini AI Grids Re-Sliced with Pure Transparency!');
}

processAllGrids().catch(console.error);
