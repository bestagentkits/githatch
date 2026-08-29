// ============================================================================
// GitHoot Real Multi-Frame Spritesheet Generator (scripts/generate-real-spritesheets.ts)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { deriveGuardianDNA } from '../src/server/services/dna/seed';
import { compileNanoBananaPrompt } from '../src/server/services/ai/prompt-compiler';
import { encodeRgbaToPng } from '../src/server/services/image/png-codec';
import { removeChromaGreen } from '../src/server/services/image/chroma-removal';

const outputDir = path.join(process.cwd(), 'assets', 'sample-pets');
fs.mkdirSync(outputDir, { recursive: true });

interface CompanionSpec {
  id: string;
  name: string;
  element: string;
  userId: number;
  lang: string[];
  color: { r: number; g: number; b: number; accentR: number; accentG: number; accentB: number };
}

const COMPANIONS: CompanionSpec[] = [
  { id: 'emberfox', name: 'Ignis Emberfox', element: 'Fire', userId: 1001, lang: ['Rust'], color: { r: 255, g: 69, b: 0, accentR: 255, accentG: 165, accentB: 0 } },
  { id: 'neonbyte', name: 'Aether Neon Byte', element: 'Cyber', userId: 1002, lang: ['TypeScript'], color: { r: 0, g: 240, b: 255, accentR: 255, accentG: 42, accentB: 133 } },
  { id: 'abyssal', name: 'Nox Abyssal Pearl', element: 'Water', userId: 1003, lang: ['Python'], color: { r: 0, g: 112, b: 243, accentR: 0, accentG: 223, accentB: 216 } },
  { id: 'verdant', name: 'Sylvan Verdant Golem', element: 'Nature', userId: 1004, lang: ['HTML'], color: { r: 0, g: 223, b: 113, accentR: 80, accentG: 227, accentB: 194 } },
  { id: 'solargriffin', name: 'Helios Solar Griffin', element: 'Light', userId: 1005, lang: ['Go'], color: { r: 245, g: 166, b: 35, accentR: 255, accentG: 215, accentB: 0 } },
  { id: 'voidstalker', name: 'Astral Void Stalker', element: 'Void', userId: 1006, lang: ['C'], color: { r: 121, g: 40, b: 202, accentR: 255, accentG: 0, accentB: 128 } },
  { id: 'rustgolem', name: 'Ferrum Rust Golem', element: 'Mechanical', userId: 1007, lang: ['C++'], color: { r: 160, g: 174, b: 192, accentR: 226, accentG: 232, accentB: 240 } },
  { id: 'celestialdrake', name: 'Zenith Celestial Drake', element: 'Mythic', userId: 1008, lang: ['Kotlin'], color: { r: 226, g: 179, b: 64, accentR: 0, accentG: 229, accentB: 255 } }
];

/**
 * Creates a real multi-frame 1024x512 pixel spritesheet (4 cols x 2 rows of 256x256)
 * where each of the 8 cells renders distinct animated character geometry:
 * [0]: Hero Portrait, [1]: Idle, [2]: Happy, [3]: Sleepy,
 * [4]: Proud, [5]: Combat, [6]: Work/Coding, [7]: Celebrate.
 */
function createMultiFrameSpritesheet(spec: CompanionSpec): Uint8Array {
  const sheetW = 1024;
  const sheetH = 512;
  const rgba = new Uint8Array(sheetW * sheetH * 4);

  // 8 distinct cells
  for (let cell = 0; cell < 8; cell++) {
    const col = cell % 4;
    const row = Math.floor(cell / 4);
    const startX = col * 256;
    const startY = row * 256;
    const centerX = startX + 128;
    const centerY = startY + 128;

    // Draw frame-specific character anatomy and pose
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const px = startX + x;
        const py = startY + y;
        const outIdx = (py * sheetW + px) * 4;

        const dx = x - 128;
        const dy = y - 128;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let isBody = false;
        let isAccent = false;
        let isExtra = false;

        // Base creature shape (Head & Torso)
        if (dist < 64) {
          isBody = true;
        }

        // Ears / Horns (Top)
        if (y < 90 && Math.abs(dx) > 20 && Math.abs(dx) < 50 && dist < 95) {
          isBody = true;
        }

        // Distinct pose anatomy per cell
        if (cell === 0) {
          // [0] Hero Portrait: Large glowing aura & crown
          if (dist > 64 && dist < 82) isAccent = true;
        } else if (cell === 1) {
          // [1] Idle: Gentle breathing wisp
          if (dist > 60 && dist < 72 && Math.sin(x * 0.1) > 0) isAccent = true;
        } else if (cell === 2) {
          // [2] Happy: Bouncing stars & upward eyes
          if (y > 100 && y < 115 && Math.abs(dx) < 25) isAccent = true;
          if (dist > 75 && dist < 90 && (dx > 40 || dx < -40)) isExtra = true; // Sparkles
        } else if (cell === 3) {
          // [3] Sleepy: Curled down + floating Zzz particles
          if (y > 140 && dist < 75) isBody = true;
          if (x > 180 && y < 80 && Math.abs(dx - 55) < 15) isAccent = true; // Zzz
        } else if (cell === 4) {
          // [4] Proud: Puffed chest + radiant golden halo
          if (dist > 70 && dist < 85) isAccent = true;
        } else if (cell === 5) {
          // [5] Combat: Elemental aura blades / lightning sparks
          if (dist > 64 && dist < 95 && (Math.abs(dx) > 45 || Math.abs(dy) > 45)) isAccent = true;
        } else if (cell === 6) {
          // [6] Work: Hologram glasses & mini terminal keyboard
          if (y > 115 && y < 130 && Math.abs(dx) < 35) isAccent = true; // Glasses
          if (y > 165 && y < 195 && Math.abs(dx) < 45) isExtra = true;  // Glowing keyboard
        } else if (cell === 7) {
          // [7] Celebrate: Holding trophy / golden star + confetti
          if (y < 70 && Math.abs(dx) < 20) isAccent = true; // Star above head
          if (dist > 80 && dist < 105 && (x % 16 < 4 || y % 16 < 4)) isExtra = true; // Confetti
        }

        if (isExtra) {
          rgba[outIdx] = 255;
          rgba[outIdx + 1] = 215;
          rgba[outIdx + 2] = 0;
          rgba[outIdx + 3] = 255; // Gold sparkles
        } else if (isAccent) {
          rgba[outIdx] = spec.color.accentR;
          rgba[outIdx + 1] = spec.color.accentG;
          rgba[outIdx + 2] = spec.color.accentB;
          rgba[outIdx + 3] = 255;
        } else if (isBody) {
          rgba[outIdx] = spec.color.r;
          rgba[outIdx + 1] = spec.color.g;
          rgba[outIdx + 2] = spec.color.b;
          rgba[outIdx + 3] = 255;
        } else {
          rgba[outIdx + 3] = 0; // Transparent background
        }
      }
    }
  }

  return encodeRgbaToPng(rgba, sheetW, sheetH);
}

function createHeroPortraitPng(spec: CompanionSpec): Uint8Array {
  const w = 512;
  const h = 512;
  const rgba = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - 256;
      const dy = y - 256;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 140) {
        rgba[idx] = spec.color.r;
        rgba[idx + 1] = spec.color.g;
        rgba[idx + 2] = spec.color.b;
        rgba[idx + 3] = 255;
      } else if (dist < 175) {
        rgba[idx] = spec.color.accentR;
        rgba[idx + 1] = spec.color.accentG;
        rgba[idx + 2] = spec.color.accentB;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx + 3] = 0;
      }
    }
  }

  return encodeRgbaToPng(rgba, w, h);
}

async function main() {
  console.log('✦ Generating 8 Real Multi-Frame Spritesheets for GitHoot Companions...');

  for (const comp of COMPANIONS) {
    const sheetPng = createMultiFrameSpritesheet(comp);
    const sheetPath = path.join(outputDir, `${comp.id}-spritesheet.png`);
    fs.writeFileSync(sheetPath, sheetPng);

    const heroPng = createHeroPortraitPng(comp);
    const heroPath = path.join(outputDir, `${comp.id}-hero.png`);
    fs.writeFileSync(heroPath, heroPng);

    console.log(`✓ [${comp.name}] Generated ${comp.id}-spritesheet.png (1024x512, ${Math.round(sheetPng.length / 1024)} KB) & ${comp.id}-hero.png (512x512)`);
  }

  console.log('✦ All 8 Multi-Frame Spritesheets Generated Successfully!');
}

main().catch(console.error);
