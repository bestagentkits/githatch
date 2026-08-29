// ============================================================================
// GitHoot Full Client & Server Build Pipeline (scripts/build.js)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.join(process.cwd(), 'dist');
fs.mkdirSync(distDir, { recursive: true });

// 1. Build React Client Bundle with Vite
console.log('► 1. Building React Client Bundle with Vite...');
try {
  execSync('npx vite build --outDir dist', { stdio: 'inherit' });
  console.log('✓ React Client compiled to dist/');
} catch (err) {
  console.error('Vite build failed:', err.message);
}

// 2. Copy design showcase HTML as design.html
const srcShowcase = path.join(process.cwd(), 'githoot-design-overview.html');
const destShowcase = path.join(distDir, 'design.html');
if (fs.existsSync(srcShowcase)) {
  fs.copyFileSync(srcShowcase, destShowcase);
  console.log('✓ Copied githoot-design-overview.html to dist/design.html');
}

// 3. Copy static assets if present
const srcAssets = path.join(process.cwd(), 'assets');
const destAssets = path.join(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, destAssets, { recursive: true });
  console.log('✓ Copied assets to dist/assets');
}

// 4. Bundle Cloudflare Pages Edge Worker
console.log('► 2. Bundling Edge Worker with esbuild...');
try {
  execSync('npx esbuild src/server/index.ts --bundle --format=esm --platform=neutral --outfile=dist/_worker.js --external:cloudflare:*', {
    stdio: 'inherit'
  });
  console.log('✓ Edge Worker compiled to dist/_worker.js');
} catch (err) {
  console.error('Esbuild failed:', err.message);
  process.exit(1);
}

console.log('✦ GitHoot Full Build Completed Successfully!');
