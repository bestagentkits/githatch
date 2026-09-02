// ============================================================================
// GitHoot Full Client & Server Build Pipeline (scripts/build.js)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { recordBundleProvenance } from './bundle-provenance.mjs';
const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
const distWorkerDir = path.join(process.cwd(), 'dist-worker');
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(distWorkerDir, { recursive: true });

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

// 4. Bundle Cloudflare Pages Edge Worker (Fetch/Producer only)
console.log('► 2. Bundling Cloudflare Pages Worker with esbuild...');
try {
  execSync('npx esbuild src/server/index.ts --bundle --format=esm --platform=neutral --outfile=dist/_worker.js --loader:.wasm=binary --external:cloudflare:* --external:node:*', {
    stdio: 'inherit'
  });
  console.log('✓ Pages Worker compiled to dist/_worker.js');
} catch (err) {
  console.error('Esbuild Pages failed:', err.message);
  process.exit(1);
}

// 5. Bundle Dedicated Queue Consumer Worker
console.log('► 3. Bundling Dedicated Queue Consumer Worker with esbuild...');
try {
  execSync('npx esbuild src/worker/queue-consumer.ts --bundle --format=esm --platform=neutral --outfile=dist-worker/index.js --loader:.wasm=binary --external:cloudflare:* --external:node:*', {
    stdio: 'inherit'
  });
  console.log('✓ Queue Consumer Worker compiled to dist-worker/index.js');
} catch (err) {
  console.error('Esbuild Consumer failed:', err.message);
  process.exit(1);
}

// 6. Compute & Record Authoritative Single-Source Bundle Provenance
console.log('► 4. Recording Single-Source Bundle Provenance...');
try {
  recordBundleProvenance('dist-worker/index.js', 'dist-worker/provenance.json');
  console.log('✓ Recorded dist-worker/provenance.json');
} catch (err) {
  console.error('Provenance recording failed:', err.message);
  process.exit(1);
}

console.log('✦ GitHoot Full Build Completed Successfully!');
