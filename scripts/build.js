// ============================================================================
// GitHoot Full Client & Server Build Pipeline (scripts/build.js)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Build React Client Bundle with Vite
console.log('► 1. Building React Client Bundle with Vite...');
try {
  execSync('npx vite build --outDir dist', { stdio: 'inherit' });
  console.log('✓ React Client compiled to dist/');
} catch (err) {
  console.error('Vite build failed:', err.message);
  process.exit(1);
}

// 2. Copy design showcase HTML as design-overview.html (avoiding clean-url collision with SPA /design route)
const srcShowcase = path.join(process.cwd(), 'githoot-design-overview.html');
const destShowcase = path.join(distDir, 'design-overview.html');
if (fs.existsSync(srcShowcase)) {
  fs.copyFileSync(srcShowcase, destShowcase);
  console.log('✓ Copied githoot-design-overview.html to dist/design-overview.html');
}

// 3. Copy static assets if present (excluding unreferenced raw generation artifacts)
const srcAssets = path.join(process.cwd(), 'assets');
const destAssets = path.join(distDir, 'assets');
if (fs.existsSync(srcAssets)) {
  fs.cpSync(srcAssets, destAssets, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(process.cwd(), src).replace(/\\/g, '/');
      if (/-gemini-raw\.jpg$/i.test(rel)) return false;
      if (/landing16-frames/i.test(rel)) return false;
      if (/-landing16-.*\.png$/i.test(rel)) return false;
      return true;
    }
  });
  console.log('✓ Copied filtered production assets to dist/assets');
}

// 4. Copy WebAssembly module for Cloudflare Pages static linking
const srcWasm = path.join(process.cwd(), 'src', 'server', 'services', 'image', 'index_bg.wasm');
const destWasm = path.join(distDir, 'index_bg.wasm');
if (fs.existsSync(srcWasm)) {
  fs.copyFileSync(srcWasm, destWasm);
  console.log('✓ Copied index_bg.wasm to dist/index_bg.wasm for Cloudflare WASM module binding');
}

// 5. Bundle Cloudflare Pages Edge Worker
console.log('► 2. Bundling Edge Worker with esbuild...');
try {
  execSync('npx esbuild src/server/index.ts --bundle --format=esm --platform=neutral --outfile=dist/_worker.js --external:cloudflare:* --external:./index_bg.wasm --external:*.wasm', {
    stdio: 'inherit'
  });
  console.log('✓ Edge Worker compiled to dist/_worker.js');
} catch (err) {
  console.error('Esbuild failed:', err.message);
  process.exit(1);
}

console.log('✦ GitHoot Full Build Completed Successfully!');
