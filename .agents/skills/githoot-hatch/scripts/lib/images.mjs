// Image layer: chroma removal, connected-component contour detection, and the
// ONE shared frame validator used for BOTH fresh renders and cached frames.
// A lighter "resume" check is forbidden: that is how an unvalidated frame ships.

import { GATES, CHROMA, FRAME } from './contracts.mjs';

/**
 * Adaptive chroma key + green de-spill, in place on an RGBA buffer.
 * De-spill is exactly g = min(g, (r+b)/2) per the repo invariant.
 */
export function removeChroma(rgba, w, h) {
  const corners = [0, (w - 1) * 4, w * (h - 1) * 4, (w * h - 1) * 4];
  let br = 0, bg = 0, bb = 0;
  for (const c of corners) { br += rgba[c]; bg += rgba[c + 1]; bb += rgba[c + 2]; }
  br /= 4; bg /= 4; bb /= 4;

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const dist = Math.hypot(r - br, g - bg, b - bb);
    const isChroma = g > 90 && g > r * CHROMA.greenBias && g > b * CHROMA.greenBias;
    if (dist < CHROMA.hardCutDistance || isChroma) {
      rgba[i + 3] = 0;
    } else if (dist < CHROMA.featherDistance) {
      const span = CHROMA.featherDistance - CHROMA.hardCutDistance;
      rgba[i + 3] = Math.round(((dist - CHROMA.hardCutDistance) / span) * 255);
    }
    if (rgba[i + 3] > 0 && g > (r + b) / 2) rgba[i + 1] = Math.round((r + b) / 2);
  }
  return rgba;
}

/** Sorted areas of sizeable 8-connected components on the alpha mask. */
export function componentAreas(rgba, w, h) {
  const minArea = Math.floor(w * h * GATES.componentMinAreaRatio);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const areas = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || rgba[s * 4 + 3] <= GATES.alphaThreshold) continue;
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
        if (!seen[q] && rgba[q * 4 + 3] > GATES.alphaThreshold) { seen[q] = 1; stack.push(q); }
      }
    }
    if (area >= minArea) areas.push(area);
  }
  return areas.sort((a, b) => b - a);
}

/** Whole-image character contour bbox. Never a fixed grid-cell crop. */
export function contourBBox(rgba, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > GATES.alphaThreshold) {
        found = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * THE shared structural gate. Call for every fresh render AND every cached frame.
 * Returns { ok, reasons[], metrics } — never throws on a defect, so callers can
 * log metrics and retry deterministically.
 *
 * Detects (empirically observed failures):
 *  - reference-collage echo: the model returns the whole reference sheet
 *  - multi-subject: e.g. a portrait bust plus a diving figure in one frame
 *  - subject too small / far away        (raw stage only)
 *  - strip/banner instead of one figure  (raw stage only)
 * Does NOT detect species/body drift — that needs the semantic identity gate.
 *
 * `stage`:
 *  - 'raw'       full-frame model output; all checks apply.
 *  - 'processed' already contour-cropped and centered into FRAME.size, so
 *                fill/aspect describe the crop, not the composition. Those two
 *                checks are skipped and reported in `metrics.skipped`.
 * Same function, same thresholds — never write a separate lighter checker.
 */
export function validateFrame(rgba, w, h, { stage = 'raw' } = {}) {
  if (stage !== 'raw' && stage !== 'processed') {
    throw new Error(`validateFrame: unknown stage "${stage}"`);
  }
  const reasons = [];
  const bbox = contourBBox(rgba, w, h);
  if (!bbox) {
    return { ok: false, reasons: ['no character contour detected'], metrics: {} };
  }
  const areas = componentAreas(rgba, w, h);
  const fill = (bbox.width * bbox.height) / (w * h);
  const aspect = bbox.width / bbox.height;
  const dominance = areas.length >= 2 ? areas[1] / areas[0] : 0;

  if (areas.length > GATES.maxLargeComponents) {
    reasons.push(`collage echo: ${areas.length} large components > ${GATES.maxLargeComponents}`);
  }
  if (dominance > GATES.dominanceRatio) {
    reasons.push(`multi-subject: 2nd component ${(dominance * 100).toFixed(0)}% > ${GATES.dominanceRatio * 100}%`);
  }
  if (stage === 'raw' && fill < GATES.minBboxFill) {
    reasons.push(`subject too small: fill ${(fill * 100).toFixed(1)}% < ${GATES.minBboxFill * 100}%`);
  }
  if (stage === 'raw' && aspect > GATES.maxBboxAspect) {
    reasons.push(`bbox too wide: aspect ${aspect.toFixed(2)} > ${GATES.maxBboxAspect}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    metrics: {
      stage,
      skipped: stage === 'processed' ? ['fill', 'aspect'] : [],
      components: areas.length,
      dominance: Math.round(dominance * 1000) / 1000,
      fill: Math.round(fill * 10000) / 10000,
      aspect: Math.round(aspect * 100) / 100,
      bbox
    }
  };
}

/** Grid position for a frame index. The compositor owns geometry, not the model. */
export function framePlacement(index) {
  const { size, cols } = FRAME;
  return {
    sheet: { left: (index % cols) * size, top: ((index / cols) | 0) * size },
    strip: { left: index * size, top: 0 }
  };
}
