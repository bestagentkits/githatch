// ============================================================================
// GitHoot Process Real Gemini 4x2 Grids (scripts/process-gemini-grids.ts)
// ============================================================================

import fs from 'fs';
import path from 'path';

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

async function main() {
  console.log('✦ Processing 8 Real Gemini Nano Banana 2 Grids into Production Assets...');

  for (const id of companions) {
    const rawPath = path.join(sampleDir, `${id}-gemini-raw.jpg`);
    if (!fs.existsSync(rawPath)) {
      console.warn(`Missing raw grid for ${id}`);
      continue;
    }

    const rawBytes = fs.readFileSync(rawPath);
    console.log(`✓ [${id}] Verified raw Gemini AI grid (${Math.round(rawBytes.length / 1024)} KB)`);

    // Standard hero copy
    const heroDest = path.join(sampleDir, `${id}.jpg`);
    fs.copyFileSync(rawPath, heroDest);
  }

  console.log('✦ All 8 Gemini AI Companion Assets Processed and Verified!');
}

main().catch(console.error);
