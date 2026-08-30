// Real Gemini Nano Banana 2 (nano-banana-pro-preview) superhero-landing generator.
// Generates 16 SEPARATE full-body frames — one exact pose per call — each
// conditioned on the committed Guardian reference image (immutable identity),
// then contour-centers each whole image (no cells, no fixed offsets) and
// composites a deterministic 4x4 / 256x256 sheet. This avoids model grid-count
// drift and forbidden fixed-cell slicing entirely.
//
// Key is read out-of-band from an untracked local .env, never printed/committed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
// Single source of truth for gates/allowlist lives in the skill lib.
import { validateFrame } from '../.agents/skills/githoot-hatch/scripts/lib/images.mjs';
import { MODEL_ALLOWLIST } from '../.agents/skills/githoot-hatch/scripts/lib/contracts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'sample-pets');
const frameDir = path.join(outDir, 'landing16-frames');
const ENV_PATH = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';
const ID = process.argv[2] || 'neonbyte';

const FRAME = 256, COLS = 4, ROWS = 4, N = 16;
const ALLOWED = MODEL_ALLOWLIST;

const IDENTITY = {
  neonbyte: `Character "Aether Neonbyte": a retro pixel-art humanoid cyber-elemental guardian with cyan flame-like hair/crest, magenta and purple circuit bodysuit with glowing cyan nodes, glowing pink eyes. Build: STOCKY and CHUNKY chibi-heroic proportions — broad shoulders, thick sturdy limbs, large head relative to body, masculine/neutral heroic silhouette. NOT slim, NOT thin, NOT feminine, NOT elongated. MATCH the attached reference image EXACTLY — same silhouette, same palette, same pixel-art sprite style, same proportions. Immutable identity: do not redesign the character, do not turn it into an animal, do not change body type.`
};

const POSES = [
  'hovering airborne with arms spread, feet off the ground',
  'starting to dive forward, body tilting head-down',
  'steep head-first dive with speed motion streaks',
  'fast downward plunge, legs trailing upward',
  'angled descent approaching the ground, arms reaching down',
  'about to land, one fist reaching down toward the ground',
  'classic three-point superhero landing: one fist and one knee planted on the ground, head low, other arm back',
  'deep compressed landing crouch, both feet down, small ground crack beneath',
  'crouched at the moment of a shockwave burst, glowing energy rings exploding outward around the feet',
  'pushing up out of the crouch, slight upward recoil',
  'rising to stand, one knee still lifted',
  'rising higher, a glowing aura beginning to kindle around the body',
  'standing up, legs straightening, arms lowering',
  'standing as a bright energy aura flares outward around the body',
  'standing tall, chest out and shoulders back, settling into a confident stance',
  'majestic full standing heroic victory stance, fists ready, aura steady'
];

// Credential/model resolution order (portable):
//   1. process.env  — the ONLY path that works on CI / other machines
//   2. untracked dotenv at ENV_PATH — local convenience on this PC only
// Fails closed in run() when neither supplies a key. Never prints values.
function readEnv() {
  const strip = s => s.trim().replace(/^["']|["']$/g, '');
  let key = process.env.GEMINI_API_KEY ? strip(process.env.GEMINI_API_KEY) : undefined;
  let model = process.env.GEMINI_MODEL || process.env.AI_MODEL_TIER;
  model = model ? strip(model) : undefined;
  let source = key ? 'process.env' : undefined;

  if ((!key || !model) && fs.existsSync(ENV_PATH)) {
    const t = fs.readFileSync(ENV_PATH, 'utf8');
    if (!key) {
      const m = (t.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)\s*$/m) || [])[1];
      if (m) { key = strip(m); source = 'dotenv'; }
    }
    if (!model) {
      const m = (t.match(/^\s*(?:GEMINI_MODEL|AI_MODEL_TIER)\s*=\s*(.+)\s*$/m) || [])[1];
      if (m) model = strip(m);
    }
  }
  return { key, model, source };
}

async function callGemini(prompt, key, model, ref) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const parts = [{ text: prompt }];
  if (ref) parts.push({ inlineData: { mimeType: ref.mime, data: ref.b64 } });
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const img = (data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData)?.inlineData;
  if (!img?.data) throw new Error('no inlineData');
  return Buffer.from(img.data, 'base64');
}

// De-chroma-key + green de-spill on the WHOLE single-character image.
function despill(rgba, w, h) {
  const corners = [0, (w - 1) * 4, w * (h - 1) * 4, (w * h - 1) * 4];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += rgba[c]; bg += rgba[c + 1]; bb += rgba[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const dist = Math.hypot(r - br, g - bg, b - bb);
    const green = g > 90 && g > r * 1.25 && g > b * 1.25;
    if (dist < 60 || green) rgba[i + 3] = 0;
    else if (dist < 100) rgba[i + 3] = Math.round(((dist - 60) / 40) * 255);
    if (rgba[i + 3] > 0 && g > (r + b) / 2) rgba[i + 1] = Math.round((r + b) / 2);
  }
}

// Whole-image character contour bbox (largest alpha extent, speckle-tolerant).
function contourBBox(rgba, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > 24) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (!found) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Return sorted areas of sizeable connected components (8-connectivity).
// A valid single-pose frame has ONE dominant blob (+ small FX);
// collage echoes or two-subject frames yield comparable large blobs.
function componentAreas(rgba, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const areas = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || rgba[s * 4 + 3] <= 24) continue;
    let area = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop();
      const px = p % w, py = (p / w) | 0;
      area++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && rgba[q * 4 + 3] > 24) { seen[q] = 1; stack.push(q); }
      }
    }
    if (area >= minArea) areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

// Acceptance gate + contour centering. Rejects collage echoes, TWO-SUBJECT
// frames (dominance check), and subjects too small / too wide to be one figure.
async function frameFromImage(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  despill(data, w, h);
  const bb = contourBBox(data, w, h);
  if (!bb) throw new Error('no character contour detected');

  const areas = componentAreas(data, w, h, Math.floor(w * h * 0.003));
  if (areas.length > 4) throw new Error(`collage echo rejected (${areas.length} large components)`);
  // Dominance: a single character must clearly dominate. A second comparable
  // blob means two subjects (e.g. bust + figure) -> reject.
  if (areas.length >= 2 && areas[1] > areas[0] * 0.30) {
    throw new Error(`multi-subject rejected (2nd blob ${(areas[1] / areas[0] * 100).toFixed(0)}% of main)`);
  }
  const fill = (bb.width * bb.height) / (w * h);
  if (fill < 0.06) throw new Error(`subject too small (bbox fill ${(fill * 100).toFixed(1)}%)`);
  const ar = bb.width / bb.height;
  if (ar > 3.2) throw new Error(`bbox too wide for one character (aspect ${ar.toFixed(2)})`);

  return sharp(Buffer.from(data.buffer, data.byteOffset, data.length), { raw: { width: w, height: h, channels: 4 } })
    .extract(bb)
    .resize(FRAME, FRAME, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
}

async function run() {
  const { key, model, source } = readEnv();
  if (!key) {
    console.error('BLOCKED: no GEMINI_API_KEY. Set the GEMINI_API_KEY environment variable');
    console.error(`(portable, works on CI), or on this PC put it in the untracked dotenv at ${ENV_PATH}`);
    console.error('(override that path with GITHOOT_ENV_PATH). The value is never printed or committed.');
    process.exit(2);
  }
  console.log(`credential source: ${source}`); // name only, never the value
  if (model && !ALLOWED.includes(model)) { console.error(`BLOCKED: model "${model}" not in Nano Banana 2/Pro allowlist (${ALLOWED.join(', ')})`); process.exit(4); }
  // ONE explicit model for the whole job. Rotating across allowlisted ids would
  // change provenance/reproducibility, so a failure is a hard stop, not a swap.
  const modelId = model || ALLOWED[0];
  console.log(`model: ${modelId}`);

  const identity = IDENTITY[ID];
  if (!identity) { console.error('no identity prompt for ' + ID); process.exit(1); }
  const refPath = path.join(outDir, `${ID}-gemini-raw.jpg`);
  if (!fs.existsSync(refPath)) { console.error('BLOCKED: identity reference missing: ' + refPath); process.exit(5); }
  const ref = { mime: 'image/jpeg', b64: fs.readFileSync(refPath).toString('base64') };

  fs.mkdirSync(frameDir, { recursive: true });
  const framePaths = [];
  for (let i = 0; i < N; i++) {
    const fp = path.join(frameDir, `f${String(i + 1).padStart(2, '0')}.png`);
    framePaths.push(fp);
    if (process.env.RESUME && fs.existsSync(fp)) {
      // Re-validate caches with THE shared validator (skill lib) — never a
      // lighter ad-hoc recheck. 'processed' stage: fill/aspect describe the
      // existing crop, so only collage/multi-subject checks are meaningful.
      try {
        const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const v = validateFrame(data, info.width, info.height, { stage: 'processed' });
        if (!v.ok) throw new Error(v.reasons.join('; '));
        console.log(`frame ${i + 1}/16: cached (re-validated, components=${v.metrics.components})`);
        continue;
      } catch (e) {
        console.log(`frame ${i + 1}: cached frame REJECTED (${e.message}) — regenerating`);
        fs.rmSync(fp);
      }
    }
    // Pose instruction FIRST; reference explicitly style-only to stop collage echo.
    const prompt = `Draw ONE brand-new single-character sprite frame. The character is ${POSES[i]}.\n${identity}\nThe attached image is a STYLE/IDENTITY reference ONLY — do NOT copy its layout, do NOT reproduce a grid or multiple panels, do NOT copy its poses, do NOT include any text or labels from it. Output exactly ONE character in ONE pose filling the frame: side-profile 3/4 view, FULL BODY head to feet, centered and large. No grid, no panels, no borders, no text, no extra characters. Background: pure solid chroma key green #00FF00, flat, no shadows on the green, hard clean silhouette edges, no green spill on the character.`;
    let frame = null, lastErr = '';
    for (let attempt = 1; attempt <= 3 && !frame; attempt++) {
      let img = null;
      try { img = await callGemini(prompt, key, modelId, ref); }
      catch (e) { lastErr = `model ${modelId}: ${e.message}`; }
      if (!img) { console.log(`frame ${i + 1} attempt ${attempt}: no image (${lastErr})`); continue; }
      try { frame = await frameFromImage(img); }
      catch (e) { lastErr = e.message; console.log(`frame ${i + 1} attempt ${attempt}: rejected — ${e.message}`); }
    }
    if (!frame) { console.error(`BLOCKED: frame ${i + 1} failed acceptance after 3 attempts (${lastErr})`); process.exit(3); }
    fs.writeFileSync(fp, frame);
    console.log(`frame ${i + 1}/16: accepted (single-subject, contour-centered)`);
  }

  // Composite deterministic 4x4 sheet (1024x1024) and a 16-wide strip (4096x256).
  const gridComp = [], stripComp = [];
  for (let i = 0; i < N; i++) {
    const b = fs.readFileSync(framePaths[i]);
    gridComp.push({ input: b, left: (i % COLS) * FRAME, top: ((i / COLS) | 0) * FRAME });
    stripComp.push({ input: b, left: i * FRAME, top: 0 });
  }
  // Emit BOTH png and webp for each artifact — the HTML builder embeds the
  // webp, so a png-only rewrite would silently ship a stale sheet.
  const sheet = await sharp({ create: { width: FRAME * COLS, height: FRAME * ROWS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(gridComp).png().toBuffer();
  fs.writeFileSync(path.join(outDir, `${ID}-landing16-sheet.png`), sheet);
  await sharp(sheet).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(outDir, `${ID}-landing16-sheet.webp`));

  const strip = await sharp({ create: { width: FRAME * N, height: FRAME, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(stripComp).png().toBuffer();
  fs.writeFileSync(path.join(outDir, `${ID}-landing16-strip.png`), strip);
  await sharp(strip).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(outDir, `${ID}-landing16-strip.webp`));
  console.log('composited 4x4 sheet (1024x1024) + 16-frame strip (4096x256), png+webp — identity-conditioned, contour-centered');
}

run().catch(e => { console.error(e.message); process.exit(1); });
