// ============================================================================
// GitHoot Sharp-Powered Gemini Grid Slicer (scripts/slice-gemini-grids-sharp.ts)
// ============================================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { removeChromaGreen } from '../src/server/services/image/chroma-removal';

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

async function processAllGrids() {
  console.log('✦ Slicing 8 Real Gemini Nano Banana 2 4x2 Grids with Sharp & Chroma Key...');

  for (const id of companions) {
    const rawPath = path.join(sampleDir, `${id}-gemini-raw.jpg`);
    if (!fs.existsSync(rawPath)) {
      console.warn(`⚠️ Missing raw grid for ${id}`);
      continue;
    }

    const metadata = await sharp(rawPath).metadata();
    const w = metadata.width || 1024;
    const h = metadata.height || 1024;

    const cellW = Math.floor(w / 4);
    const cellH = Math.floor(h / 2);

    console.log(`► Processing [${id}]: Image ${w}x${h} -> Cell ${cellW}x${cellH}...`);

    // 1. Extract Cell [0,0] as Hero Portrait
    const heroBuffer = await sharp(rawPath)
      .extract({ left: 0, top: 0, width: cellW, height: cellH })
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const cleanedHeroRgba = removeChromaGreen(heroBuffer.data, heroBuffer.info.width, heroBuffer.info.height);

    const heroPng = await sharp(cleanedHeroRgba, {
      raw: { width: heroBuffer.info.width, height: heroBuffer.info.height, channels: 4 }
    }).png().toBuffer();

    // Save hero PNG and high-quality hero JPG for backwards-compat
    const heroPngPath = path.join(sampleDir, `${id}-hero.png`);
    const heroJpgPath = path.join(sampleDir, `${id}.jpg`);
    fs.writeFileSync(heroPngPath, heroPng);
    fs.writeFileSync(heroJpgPath, heroPng);

    // 2. Extract and Composite 8 Cells into 1024x512 Spritesheet
    const compositeImages: Array<{ input: Buffer; top: number; left: number }> = [];

    for (let cell = 0; cell < 8; cell++) {
      const col = cell % 4;
      const row = Math.floor(cell / 4);
      const cropLeft = col * cellW;
      const cropTop = row * cellH;

      const cellBuffer = await sharp(rawPath)
        .extract({ left: cropLeft, top: cropTop, width: cellW, height: cellH })
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const cleanedCellRgba = removeChromaGreen(cellBuffer.data, cellBuffer.info.width, cellBuffer.info.height);

      const cellPngBuffer = await sharp(cleanedCellRgba, {
        raw: { width: cellBuffer.info.width, height: cellBuffer.info.height, channels: 4 }
      }).png().toBuffer();

      compositeImages.push({
        input: cellPngBuffer,
        left: col * 256,
        top: row * 256
      });
    }

    // Create 1024x512 blank transparent canvas and composite 8 poses
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

    const sheetPath = path.join(sampleDir, `${id}-spritesheet.png`);
    fs.writeFileSync(sheetPath, sheetPng);

    console.log(`✓ [${id}] Generated real sliced ${id}-hero.png (512x512) & ${id}-spritesheet.png (1024x512, ${Math.round(sheetPng.length / 1024)} KB)`);
  }

  console.log('✦ All 8 Real Gemini Grids Sliced and Saved Successfully!');
}

processAllGrids().catch(console.error);
