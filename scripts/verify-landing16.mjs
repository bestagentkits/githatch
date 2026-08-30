// Browser-driven verification of the 16-frame landing player.
// Fails closed (nonzero exit) on console errors or wrong frame state.
// Screenshots + report are written to plans/reports/screenshots/.
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'plans', 'reports', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });
const fileUrl = 'file:///' + path.join(root, 'plans', 'reports', 'brainstorm-pet-generation-pipeline.html').replace(/\\/g, '/');

const N = 16, FW = 256;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(fileUrl, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1800)); // let autoplay settle to last frame

await page.screenshot({ path: path.join(outDir, 'landing16-s4-default.png') });

// Verify every frame maps to its own background-position (real 16-frame stepping).
const positions = [];
for (let f = 1; f <= N; f++) {
  await page.evaluate(k => window.goto(k), f);
  await new Promise(r => setTimeout(r, 60));
  positions.push(await page.evaluate(() => getComputedStyle(document.getElementById('sprite')).backgroundPosition));
}
const expected = Array.from({ length: N }, (_, k) => `${-k * FW}px 0px`);
const posOk = positions.every((p, i) => p === expected[i]);
const distinct = new Set(positions).size;

// Capture the signature three-point landing frame (F7) and hero stance (F16).
await page.evaluate(() => window.goto(7));
await new Promise(r => setTimeout(r, 200));
const statusF7 = await page.evaluate(() => document.getElementById('fstatus').textContent);
await (await page.$('#sprite')).screenshot({ path: path.join(outDir, 'landing16-f07-three-point.png') });
await page.evaluate(() => window.goto(16));
await new Promise(r => setTimeout(r, 200));
const statusF16 = await page.evaluate(() => document.getElementById('fstatus').textContent);
await (await page.$('#sprite')).screenshot({ path: path.join(outDir, 'landing16-f16-hero.png') });
await (await page.$('#strip')).screenshot({ path: path.join(outDir, 'landing16-filmstrip.png') });

const meta = await page.evaluate(() => ({
  title: document.title,
  thumbs: document.querySelectorAll('.cellthumb').length,
  statusCard: !!document.querySelector('.status-card'),
  sheetImg: !!document.querySelector('.sheet-box img'),
  mentionsNanoBanana2: /nano-banana-pro-preview/.test(document.body.textContent),
  leaksKey: /AIza[0-9A-Za-z_\-]{10,}/.test(document.documentElement.outerHTML)
}));

await browser.close();

const report = { fileUrl, consoleErrors, meta, framePositionsOk: posOk, distinctPositions: distinct, statusF7, statusF16 };
fs.writeFileSync(path.join(outDir, 'landing16-verify-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const fail = [];
if (consoleErrors.length) fail.push('console errors: ' + consoleErrors.join(' | '));
if (!posOk) fail.push('frame positions wrong: ' + positions.slice(0, 3).join(', ') + ' ...');
if (distinct !== N) fail.push(`expected ${N} distinct frame positions, got ${distinct}`);
if (meta.thumbs !== N) fail.push(`filmstrip thumbs != ${N}: ${meta.thumbs}`);
if (!/3 điểm/.test(statusF7)) fail.push('F7 is not labeled three-point landing: ' + statusF7);
if (!meta.mentionsNanoBanana2) fail.push('page does not state the Nano Banana 2 model id');
if (meta.leaksKey) fail.push('SECURITY: page appears to contain an API key');
if (fail.length) { console.error('VERIFY FAILED:\n- ' + fail.join('\n- ')); process.exit(1); }
console.log('VERIFY PASSED');
