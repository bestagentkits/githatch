// ============================================================================
// Landing preview derivative assets (scripts/build-landing-preview-assets.js)
//
// The accepted contract requires two derived images with hard byte caps:
//   - Guardian poster still, <= 40,000 B  (contract sections 5 / 8)
//   - Creator avatar 96x96,  <= 12,000 B  (contract sections 5 / 7 / 8)
// Both are generated locally with the existing `sharp` devDependency so the
// preview never hotlinks the 282,949 B remote avatar or ships a hero PNG.
//
// Usage: node scripts/build-landing-preview-assets.js
// ============================================================================

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const OUT = 'plans/reports/landing-preview-assets';
const POSTER_CAP = 40000;
const AVATAR_CAP = 12000;
const AVATAR_SRC = 'https://cdn.zuey.me/avatar.png';

fs.mkdirSync(OUT, { recursive: true });
const report = {};

// --- 1. Guardian poster still -----------------------------------------------
let poster = null;
for (const [width, quality] of [[520, 72], [460, 66], [420, 60], [380, 55], [340, 50]]) {
  const buf = await sharp('assets/sample-pets/neonbyte-hero.png')
    .resize({ width })
    .webp({ quality })
    .toBuffer();
  poster = { buf, width, quality };
  if (buf.length <= POSTER_CAP) break;
}
fs.writeFileSync(path.join(OUT, 'neonbyte-poster.webp'), poster.buf);
const posterMeta = await sharp(poster.buf).metadata();
report.poster = {
  bytes: poster.buf.length, cap: POSTER_CAP, pass: poster.buf.length <= POSTER_CAP,
  width: posterMeta.width, height: posterMeta.height, quality: poster.quality
};

// --- 2. Creator avatar ------------------------------------------------------
const res = await fetch(AVATAR_SRC);
if (!res.ok) throw new Error('avatar fetch failed: ' + res.status);
const src = Buffer.from(await res.arrayBuffer());
let avatar = null;
for (const quality of [82, 74, 66, 58, 50]) {
  const buf = await sharp(src).resize(96, 96, { fit: 'cover' }).webp({ quality }).toBuffer();
  avatar = { buf, quality };
  if (buf.length <= AVATAR_CAP) break;
}
fs.writeFileSync(path.join(OUT, 'zuey-avatar-96.webp'), avatar.buf);
report.avatar = {
  bytes: avatar.buf.length, cap: AVATAR_CAP, pass: avatar.buf.length <= AVATAR_CAP,
  source_bytes: src.length, saved: src.length - avatar.buf.length, quality: avatar.quality
};

// --- 3. Demo strip (copied verbatim, must stay byte-identical) --------------
const stripSrc = 'assets/sample-pets/neonbyte-landing16-strip.webp';
fs.copyFileSync(stripSrc, path.join(OUT, 'neonbyte-landing16-strip.webp'));
const stripBytes = fs.statSync(path.join(OUT, 'neonbyte-landing16-strip.webp')).size;
report.strip = { bytes: stripBytes, expected: 286362, match: stripBytes === 286362 };

console.log(JSON.stringify(report, null, 2));
