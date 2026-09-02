#!/usr/bin/env node
// Canonical generic hatch entrypoint. Works for ANY Guardian identity — no
// per-character prose. This is the ONE executable path; sample/demo scripts must
// call it rather than re-implementing policy.
//
// Usage:
//   node hatch.mjs compile --job job.json
//   node hatch.mjs render  --job job.json [--resume]
//
// job.json:
//   { "guardianId": "neonbyte",
//     "githubUserId": 11829471,
//     "telemetry": { ... },                     // raw GitHub telemetry
//     "referencePath": "assets/.../x.jpg",      // pinned identity reference
//     "outDir": "assets/sample-pets" }
//
// Credentials: process.env.GEMINI_API_KEY first, then untracked dotenv at
// GITHOOT_ENV_PATH. Never printed. Missing => exit 2.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  MODEL_ALLOWLIST, GEMINI_ENDPOINT, FRAME, GATES, POSE_SET, VERSIONS, EXIT
} from './lib/contracts.mjs';
import {
  compileIdentitySpec, compileAllPosePrompts, compileReferencePrompt, requestFingerprint, canonicalJson, sha256
} from './lib/determinism.mjs';
import { removeChroma, validateFrame, contourBBox, framePlacement } from './lib/images.mjs';

const ENV_PATH = process.env.GITHOOT_ENV_PATH || 'D:/www/oss/githatch/.env';

function die(code, msg) { console.error(msg); process.exit(code); }

function resolveCredentials() {
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

/**
 * Parse ONLY the expected inlineData part. Model text is untrusted and ignored.
 * `ref` is null for the bootstrap render (no reference exists yet); every pose
 * render MUST pass one.
 */
async function renderPose(promptText, key, modelId, ref) {
  const url = `${GEMINI_ENDPOINT}/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
  const parts = [{ text: promptText }];
  if (ref) parts.push({ inlineData: { mimeType: ref.mime, data: ref.b64 } });
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } })
  });
  if (!res.ok) {
    // Redact any credential echoed back in provider error text.
    const body = (await res.text()).slice(0, 160).replaceAll(key, '[REDACTED]');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  const data = await res.json();
  const img = (data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData)?.inlineData;
  if (!img?.data) throw new Error('no inlineData in response');
  return Buffer.from(img.data, 'base64');
}

/**
 * Raw acceptance: de-chroma the full model output, run the RAW gate, then
 * contour-center into a frame. Returns { frame, metrics, rawSha256 }.
 * This is the only place a fresh frame may be accepted.
 */
async function acceptRawRender(buf) {
  const rawSha256 = await sha256(buf.toString('base64'));
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeChroma(data, info.width, info.height);
  const verdict = validateFrame(data, info.width, info.height, { stage: 'raw' });
  if (!verdict.ok) { const e = new Error(verdict.reasons.join('; ')); e.metrics = verdict.metrics; throw e; }
  const bbox = contourBBox(data, info.width, info.height);
  const frame = await sharp(Buffer.from(data.buffer, data.byteOffset, data.length), {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .extract(bbox)
    .resize(FRAME.size, FRAME.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return { frame, metrics: verdict.metrics, rawSha256 };
}

function loadJob(argv) {
  const i = argv.indexOf('--job');
  if (i === -1 || !argv[i + 1]) die(EXIT.usage, 'usage: hatch.mjs <compile|bootstrap|approve-reference|render> --job <job.json> [--resume]');
  const job = JSON.parse(fs.readFileSync(argv[i + 1], 'utf8'));
  const required = ['guardianId', 'githubUserId', 'telemetry', 'outDir'];
  if (!['compile', 'bootstrap', 'approve-reference'].includes(process.argv[2])) required.push('referencePath');
  for (const f of required) {
    if (job[f] === undefined) die(EXIT.usage, `job.json missing required field: ${f}`);
  }
  // Path confinement: outputs must stay inside the repo.
  const root = process.cwd();
  const abs = path.resolve(root, job.outDir);
  if (!abs.startsWith(root + path.sep)) die(EXIT.usage, `outDir escapes the project root: ${job.outDir}`);
  job._outAbs = abs;
  return job;
}

async function main() {
  const [cmd] = process.argv.slice(2);
  if (!['compile', 'bootstrap', 'approve-reference', 'render'].includes(cmd)) {
    die(EXIT.usage, 'usage: hatch.mjs <compile|bootstrap|approve-reference|render> --job <job.json> [--resume]');
  }
  const job = loadJob(process.argv);

  // ---- deterministic phases (no spend, no network) ----
  const spec = await compileIdentitySpec({ githubUserId: job.githubUserId, telemetry: job.telemetry, pin: job.identityPin });
  const prompts = await compileAllPosePrompts(spec);
  if (cmd === 'compile') {
    console.log(canonicalJson({
      versions: VERSIONS,
      identity: spec,
      poses: prompts.map(p => ({ poseId: p.poseId, promptHash: p.promptHash }))
    }));
    return;
  }

  // ---- approve-reference: promote a candidate to the canonical reference ----
  // The structural gate proves geometry, not identity. A candidate becomes the
  // immutable identity anchor ONLY with an independent verdict bound to its hash.
  // The generating model may never supply this verdict.
  if (cmd === 'approve-reference') {
    const arg = n => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };
    const verdict = arg('--verdict');
    const reviewer = arg('--reviewer');
    const sha = arg('--sha');
    if (verdict !== 'pass' || !reviewer || !sha) {
      die(EXIT.usage,
        'usage: hatch.mjs approve-reference --job <job.json> --verdict pass --reviewer "<name>" --sha <candidateSha256>\n' +
        'Every argument is required. Only --verdict pass promotes; anything else leaves the candidate quarantined.');
    }
    const candPng = path.join(job._outAbs, `${job.guardianId}-reference-candidate.png`);
    const candJson = path.join(job._outAbs, `${job.guardianId}-reference-candidate.json`);
    if (!fs.existsSync(candPng) || !fs.existsSync(candJson)) {
      die(EXIT.referenceMissing, `BLOCKED: no reference candidate for ${job.guardianId}. Run bootstrap first.`);
    }
    const cand = JSON.parse(fs.readFileSync(candJson, 'utf8'));
    const actual = await sha256(fs.readFileSync(candPng).toString('base64'));
    if (actual !== cand.referenceSha256) {
      die(EXIT.gateFailed, `BLOCKED: candidate bytes changed since bootstrap (recorded ${cand.referenceSha256.slice(0, 12)}, actual ${actual.slice(0, 12)}).`);
    }
    if (sha !== actual) {
      die(EXIT.gateFailed, `BLOCKED: --sha does not match the candidate. The verdict must be bound to the exact bytes reviewed (candidate is ${actual.slice(0, 12)}...).`);
    }
    if (cand.identityHash !== spec.identityHash) {
      die(EXIT.gateFailed, 'BLOCKED: the identity spec changed since this candidate was minted. Re-bootstrap before approving.');
    }
    const finalPng = path.join(job._outAbs, `${job.guardianId}-reference.png`);
    if (fs.existsSync(finalPng)) {
      die(EXIT.usage, `BLOCKED: canonical reference already exists: ${finalPng}. A Guardian reference is immutable and cannot be re-approved.`);
    }
    fs.copyFileSync(candPng, finalPng);
    fs.writeFileSync(path.join(job._outAbs, `${job.guardianId}-reference.json`), JSON.stringify({
      ...cand,
      referencePath: path.relative(process.cwd(), finalPng).replaceAll('\\', '/'),
      state: 'APPROVED',
      semanticIdentityVerdict: {
        verdict: 'pass',
        reviewer,
        boundToSha256: actual,
        boundToIdentityHash: spec.identityHash,
        boundToPromptHash: cand.promptHash,
        boundToRawSha256: cand.rawSha256,
        boundToModelId: cand.modelId,
        boundToVersions: cand.versions,
        covers: ['species', 'anatomy/build', 'silhouette', 'palette', 'crest', 'style', 'subject count'],
        approvedBy: 'independent reviewer (not the generating model)'
      }
    }, null, 2));
    console.log(`promoted to canonical reference: ${path.basename(finalPng)}`);
    console.log(`verdict bound to sha256 ${actual.slice(0, 16)}... by ${reviewer}`);
    console.log('Set this path as "referencePath" in the job, then run: hatch.mjs render');
    return;
  }

  // ---- render phase ----
  const { key, model, source } = resolveCredentials();
  if (!key) {
    die(EXIT.noCredential,
      'BLOCKED: no GEMINI_API_KEY. Set the GEMINI_API_KEY environment variable (portable, works on CI),\n' +
      `or on this machine put it in the untracked dotenv at ${ENV_PATH} (override with GITHOOT_ENV_PATH).\n` +
      'The value is never printed or committed.');
  }
  if (model && !MODEL_ALLOWLIST.includes(model)) {
    die(EXIT.modelNotAllowed, `BLOCKED: model "${model}" not in Nano Banana 2/Pro allowlist (${MODEL_ALLOWLIST.join(', ')})`);
  }
  // ONE model for the whole job. Rotating allowlisted ids changes provenance.
  const modelId = model || MODEL_ALLOWLIST[0];
  console.log(`credential source: ${source}`); // name only, never the value
  console.log(`model: ${modelId}`);

  // ---- bootstrap: mint the canonical reference for a brand-new Guardian ----
  // Without this a new GitHub user cannot be hatched, and whichever species the
  // model happened to draw would become the identity. Here the spec defines the
  // character, and the accepted render is pinned by hash.
  if (cmd === 'bootstrap') {
    fs.mkdirSync(job._outAbs, { recursive: true });
    const canonical = path.join(job._outAbs, `${job.guardianId}-reference.png`);
    if (fs.existsSync(canonical)) {
      die(EXIT.usage,
        `BLOCKED: an approved canonical reference already exists: ${canonical}\n` +
        'A Guardian reference is immutable; 1 GitHub ID = 1 Guardian DNA. Re-bootstrapping\n' +
        'would be a free identity reroll, so this path has no override flag.');
    }
    const outPath = path.join(job._outAbs, `${job.guardianId}-reference-candidate.png`);
    if (fs.existsSync(outPath)) {
      die(EXIT.usage,
        `BLOCKED: a reference candidate already exists: ${outPath}\n` +
        'Approve or delete it deliberately. Re-minting is an identity reroll and has no\n' +
        'flag on this path; a migration needs a separately authorized tool.');
    }
    const refPrompt = await compileReferencePrompt(spec);
    let accepted = null, lastErr = '';
    for (let attempt = 1; attempt <= GATES.maxAttemptsPerPose && !accepted; attempt++) {
      let raw;
      try { raw = await renderPose(refPrompt.text, key, modelId, null); }
      catch (e) { lastErr = e.message; console.log(`reference attempt ${attempt}: render failed (${lastErr})`); continue; }
      try { accepted = await acceptRawRender(raw); }
      catch (e) { lastErr = e.message; console.log(`reference attempt ${attempt}: raw gate rejected — ${lastErr}`); }
    }
    if (!accepted) die(EXIT.gateFailed, `BLOCKED: reference failed raw acceptance after ${GATES.maxAttemptsPerPose} attempts (${lastErr})`);
    fs.writeFileSync(outPath, accepted.frame);
    const referenceSha256 = await sha256(accepted.frame.toString('base64'));
    fs.writeFileSync(path.join(job._outAbs, `${job.guardianId}-reference-candidate.json`), JSON.stringify({
      guardianId: job.guardianId,
      referencePath: path.relative(process.cwd(), outPath).replaceAll('\\', '/'),
      referenceSha256,
      identityHash: spec.identityHash,
      species: spec.species,
      promptHash: refPrompt.promptHash,
      modelId,
      rawSha256: accepted.rawSha256,
      rawGate: accepted.metrics,
      versions: VERSIONS,
      state: 'VERIFYING',
      semanticIdentityVerdict: null
    }, null, 2));
    console.log(`minted reference CANDIDATE: ${path.basename(outPath)}`);
    console.log(`referenceSha256: ${referenceSha256}`);
    console.log('This is NOT yet the canonical reference. Inspect it against the compiled spec, then run:');
    console.log(`  hatch.mjs approve-reference --job <job.json> --verdict pass --reviewer "<name>" --sha ${referenceSha256}`);
    console.log('Only an approved candidate may be used by render (structural gate cannot judge identity).');
    return;
  }


  const refAbs = path.resolve(process.cwd(), job.referencePath);
  if (!fs.existsSync(refAbs)) die(EXIT.referenceMissing, `BLOCKED: pinned identity reference missing: ${job.referencePath}`);
  // Refuse to anchor 16 poses on a candidate that no reviewer has approved.
  if (/-reference-candidate\.(png|jpe?g)$/i.test(refAbs)) {
    die(EXIT.referenceMissing,
      'BLOCKED: referencePath points at an unapproved reference CANDIDATE.\n' +
      'Run approve-reference first — the structural gate cannot judge identity, so an\n' +
      'unreviewed candidate must never become the anchor for a whole pose set.');
  }
  {
    const sidecar = refAbs.replace(/\.(png|jpe?g)$/i, '.json');
    if (fs.existsSync(sidecar)) {
      const meta = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      if (meta.state && meta.state !== 'APPROVED') {
        die(EXIT.referenceMissing, `BLOCKED: reference state is "${meta.state}", not APPROVED. Run approve-reference.`);
      }
      const v = meta.semanticIdentityVerdict;
      if (!v || v.verdict !== 'pass') {
        die(EXIT.referenceMissing, 'BLOCKED: approved reference carries no passing semantic identity verdict.');
      }
      if (v.boundToIdentityHash && v.boundToIdentityHash !== spec.identityHash) {
        die(EXIT.referenceMissing,
          'BLOCKED: the identity spec changed since this reference was approved.\n' +
          'The verdict is bound to the reviewed identity, so it no longer covers this spec.');
      }
      if (v.boundToSha256 && v.boundToSha256 !== (await sha256(fs.readFileSync(refAbs).toString('base64')))) {
        die(EXIT.referenceMissing, 'BLOCKED: reference bytes changed since approval; the verdict no longer binds.');
      }
    }
  }
  const refBuf = fs.readFileSync(refAbs);
  const referenceSha256 = await sha256(refBuf.toString('base64'));
  const ref = {
    mime: refAbs.endsWith('.png') ? 'image/png' : 'image/jpeg',
    b64: refBuf.toString('base64')
  };
  const fingerprint = await requestFingerprint({ spec, referenceSha256, modelId });
  const frameDir = path.join(job._outAbs, `${job.guardianId}-landing${POSE_SET.length}-frames`);
  const rawDir = path.join(frameDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const resume = process.argv.includes('--resume');
  const frameRecords = [];

  for (let i = 0; i < POSE_SET.length; i++) {
    const pose = POSE_SET[i];
    const fp = path.join(frameDir, `f${String(i + 1).padStart(2, '0')}.png`);
    const evidencePath = path.join(rawDir, `f${String(i + 1).padStart(2, '0')}.json`);

    // Resume requires RAW-acceptance evidence bound to this policy version.
    // A processed-only recheck is NOT acceptance (see references/quality-gates.md).
    if (resume && fs.existsSync(fp) && fs.existsSync(evidencePath)) {
      const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      const policyMatch = ev.processingPolicyVersion === VERSIONS.processingPolicy
        && ev.promptHash === prompts[i].promptHash
        && ev.referenceSha256 === referenceSha256
        && ev.modelId === modelId;
      if (policyMatch) {
        // Processed-integrity check on the stored artifact.
        const { data, info } = await sharp(fp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const integrity = validateFrame(data, info.width, info.height, { stage: 'processed' });
        if (integrity.ok) {
          console.log(`pose ${i + 1}/${POSE_SET.length} ${pose.id}: reused (raw evidence + processed integrity ok)`);
          frameRecords.push({ ...ev, reused: true, integrity: integrity.metrics });
          continue;
        }
        console.log(`pose ${i + 1} ${pose.id}: stored artifact failed integrity (${integrity.reasons.join('; ')}) — regenerating`);
      } else {
        console.log(`pose ${i + 1} ${pose.id}: raw evidence stale for current policy/prompt/reference/model — regenerating`);
      }
    }

    let accepted = null, lastErr = '';
    for (let attempt = 1; attempt <= GATES.maxAttemptsPerPose && !accepted; attempt++) {
      let raw;
      try { raw = await renderPose(prompts[i].text, key, modelId, ref); }
      catch (e) { lastErr = e.message; console.log(`pose ${i + 1} attempt ${attempt}: render failed (${lastErr})`); continue; }
      try { accepted = await acceptRawRender(raw); }
      catch (e) { lastErr = e.message; console.log(`pose ${i + 1} attempt ${attempt}: raw gate rejected — ${lastErr}`); }
    }
    if (!accepted) {
      die(EXIT.gateFailed, `BLOCKED: pose ${pose.id} failed raw acceptance after ${GATES.maxAttemptsPerPose} attempts (${lastErr})`);
    }

    fs.writeFileSync(fp, accepted.frame);
    const record = {
      poseId: pose.id,
      promptHash: prompts[i].promptHash,
      referenceSha256,
      modelId,
      rawSha256: accepted.rawSha256,
      frameSha256: await sha256(accepted.frame.toString('base64')),
      rawGate: accepted.metrics,
      processingPolicyVersion: VERSIONS.processingPolicy,
      poseSetVersion: VERSIONS.poseSet
    };
    fs.writeFileSync(evidencePath, JSON.stringify(record, null, 2));
    frameRecords.push(record);
    console.log(`pose ${i + 1}/${POSE_SET.length} ${pose.id}: accepted (raw gate passed)`);
  }

  // ---- deterministic composition: geometry is code-owned ----
  const sheetComp = [], stripComp = [];
  for (let i = 0; i < POSE_SET.length; i++) {
    const buf = fs.readFileSync(path.join(frameDir, `f${String(i + 1).padStart(2, '0')}.png`));
    const place = framePlacement(i);
    sheetComp.push({ input: buf, ...place.sheet });
    stripComp.push({ input: buf, ...place.strip });
  }
  const base = path.join(job._outAbs, `${job.guardianId}-landing${POSE_SET.length}`);
  const sheet = await sharp({ create: { width: FRAME.size * FRAME.cols, height: FRAME.size * FRAME.rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(sheetComp).png().toBuffer();
  const strip = await sharp({ create: { width: FRAME.size * POSE_SET.length, height: FRAME.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(stripComp).png().toBuffer();

  // Emit every format together — a png-only rewrite ships a stale webp to the UI.
  const artifacts = {};
  for (const [name, buf] of [['sheet', sheet], ['strip', strip]]) {
    fs.writeFileSync(`${base}-${name}.png`, buf);
    const webp = await sharp(buf).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    fs.writeFileSync(`${base}-${name}.webp`, webp);
    artifacts[`${name}Png`] = { path: `${base}-${name}.png`, sha256: await sha256(buf.toString('base64')) };
    artifacts[`${name}Webp`] = { path: `${base}-${name}.webp`, sha256: await sha256(webp.toString('base64')) };
  }

  const manifest = {
    guardianId: job.guardianId,
    versions: VERSIONS,
    identity: spec,
    modelId,
    referenceSha256,
    requestFingerprint: fingerprint,
    frames: frameRecords,
    artifacts,
    // Publication requires these, and this tool never sets them.
    browserReport: null,
    semanticIdentityVerdict: null,
    state: 'VERIFYING'
  };
  const manifestPath = `${base}-manifest.json`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`composed sheet+strip (png+webp) and wrote ${path.basename(manifestPath)}`);
  console.log('state=VERIFYING — browser report + independent semantic verdict required before ASSET_READY');
}

main().catch(e => die(EXIT.generationFailed, e.message));
