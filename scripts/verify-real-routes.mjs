// ============================================================================
// Real Application Route Browser Verification (scripts/verify-real-routes.mjs)
// ============================================================================

import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const outDir = path.join(__dirname, '..', 'plans', 'reports', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

// Simple HTTP server serving dist/
const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  
  if (req.url?.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url.includes('/api/early-access/status')) {
      res.end(JSON.stringify({ total: 100, claimed: 21, remaining: 79, is_available: true }));
      return;
    }
    if (req.url.includes('/api/profile/')) {
      res.end(JSON.stringify({
        github_user_id: 11829471,
        login: 'mrgoonie',
        name: 'Hoang Anh',
        dna_seed: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        top_languages: ['TypeScript', 'Rust'],
        claimed: true,
        guardian: {
          id: 'g-mrgoonie',
          species: 'neonbyte',
          species_name: 'Aether Neonbyte',
          element: 'Cyber',
          rarity_tier: 'Epic',
          status: 'ASSET_READY',
          hero_image_url: '/assets/sample-pets/neonbyte-hero.png',
          spritesheet_url: '/assets/sample-pets/neonbyte-landing16-strip.png',
          level: 14,
          experience: 4280,
          energy_state: 'Active'
        }
      }));
      return;
    }
    if (req.url.includes('/api/gallery')) {
      res.end(JSON.stringify({
        items: [
          {
            id: 'g-gal-1',
            name: 'Aether Neonbyte',
            species: 'neonbyte',
            species_name: 'Aether Neonbyte',
            element: 'Cyber',
            rarity_tier: 'Epic',
            level: 14,
            experience: 4280,
            energy_state: 'Active',
            hero_image_url: '/assets/sample-pets/neonbyte-hero.png',
            spritesheet_url: '/assets/sample-pets/neonbyte-landing16-strip.png',
            published_at: Date.now(),
            owner: { login: 'mrgoonie', name: 'Hoang Anh', avatar_url: null, total_stars: 42 }
          },
          {
            id: 'g-gal-2',
            name: 'Ignis Emberfox',
            species: 'emberfox',
            species_name: 'Ignis Emberfox',
            element: 'Fire',
            rarity_tier: 'Legendary',
            level: 18,
            experience: 6500,
            energy_state: 'Energetic',
            hero_image_url: '/assets/sample-pets/emberfox.jpg',
            spritesheet_url: null,
            published_at: Date.now() - 3600000,
            owner: { login: 'octocat', name: 'The Octocat', avatar_url: null, total_stars: 180 }
          }
        ],
        page: { limit: 24, has_more: false, next_cursor: null, snapshot_at: Date.now() },
        applied: { q: null, element: null, rarity: null, sort: 'newest' }
      }));
      return;
    }
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(resolve => server.listen(8789, resolve));
console.log('✦ Local Test Server running at http://localhost:8789');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

try {
  // 1. Test Home Route
  await page.goto('http://localhost:8789/', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'real-route-home.png') });
  console.log('✓ Verified route: /');

  // 2. Test Explore Route
  await page.goto('http://localhost:8789/explore', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'real-route-explore.png') });
  console.log('✓ Verified route: /explore');

  // 3. Test Design System Route
  await page.goto('http://localhost:8789/design', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'real-route-design.png') });
  console.log('✓ Verified route: /design');
  // 4. Test Gallery Route (Desktop, Tablet, Mobile)
  await page.goto('http://localhost:8789/gallery', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'real-route-gallery-desktop.png') });
  console.log('✓ Verified route: /gallery (desktop)');

  // Tablet Viewport (768x1024)
  await page.setViewport({ width: 768, height: 1024 });
  await page.screenshot({ path: path.join(outDir, 'real-route-gallery-tablet.png') });
  console.log('✓ Verified route: /gallery (tablet)');

  // Mobile Viewport (375x812)
  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(outDir, 'real-route-gallery-mobile.png') });
  console.log('✓ Verified route: /gallery (mobile)');

  // Reset viewport to desktop
  await page.setViewport({ width: 1400, height: 1000 });

  // 4. Test Hatch Wait Route
  await page.goto('http://localhost:8789/hatch/wait/mrgoonie', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(outDir, 'real-route-hatch-wait.png') });
  console.log('✓ Verified route: /hatch/wait/mrgoonie');

  // 5. Test Profile Route with Gacha Modal
  await page.goto('http://localhost:8789/mrgoonie', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(outDir, 'real-route-profile.png') });
  console.log('✓ Verified route: /mrgoonie');
} finally {
  await browser.close();
  server.close();
}

console.log('Console errors encountered:', consoleErrors.length);
if (consoleErrors.length > 0) {
  console.error('Console errors:', consoleErrors);
  process.exit(1);
}

console.log('REAL APPLICATION ROUTE VERIFICATION PASSED');
