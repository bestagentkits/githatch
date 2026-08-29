// ============================================================================
// GitHoot Cross-Platform Build Pipeline (scripts/build.js)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.join(process.cwd(), 'dist');
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy interactive design showcase as index.html
const srcHtml = path.join(process.cwd(), 'githoot-design-overview.html');
const destHtml = path.join(distDir, 'index.html');
if (fs.existsSync(srcHtml)) {
  fs.copyFileSync(srcHtml, destHtml);
  console.log('✓ Copied githoot-design-overview.html to dist/index.html');
}

// 2. Copy static assets if present
const srcAssets = path.join(process.cwd(), 'assets');
const destAssets = path.join(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, destAssets, { recursive: true });
  console.log('✓ Copied assets to dist/assets');
}

// 3. Build Cloudflare Pages Worker function
console.log('► Bundling Edge Worker with esbuild...');
execSync('npx esbuild src/server/index.ts --bundle --format=esm --platform=neutral --outfile=dist/_worker.js --external:cloudflare:*', {
  stdio: 'inherit'
});

console.log('✦ Build completed successfully for Cloudflare Pages deployment!');
