// Deterministic layer: telemetry normalization -> IdentitySpec -> prompt bytes.
// PURE. No network, no filesystem, no clock, no Math.random.
// Same (github_user_id, frozen telemetry, versions) => byte-identical output.

import { createHash } from 'node:crypto';
import {
  VERSIONS, POSE_SET, POSE_PROMPT, FRAME, CHROMA,
  ELEMENTS, LANGUAGE_ELEMENT, BUILDS, BUILD_PROMPT, SILHOUETTES, CRESTS,
  MARKINGS, MATERIALS, AURAS, TEMPERAMENTS, RARITIES, RARITY_CUTS, MERIT_WEIGHTS,
  IDENTITY_TELEMETRY_FIELDS
} from './contracts.mjs';

export const sha256 = s => createHash('sha256').update(s, 'utf8').digest('hex');

/** Canonical JSON: sorted keys, no whitespace. Key ordering can never change a hash. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort()
    .filter(k => value[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonicalJson(value[k]))
    .join(',') + '}';
}

/**
 * Normalize raw GitHub telemetry into the frozen identity snapshot.
 * Locale, field order, and float noise must not change identity, so values are
 * lowercased, sorted, and bucketed to integers.
 */
export function normalizeTelemetry(raw = {}) {
  const int = (v, d = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d;
  const ratio = v => Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0;

  const langs = Array.isArray(raw.topLanguages) ? raw.topLanguages : [];
  const snap = {
    topLanguages: langs.map(l => String(l).trim().toLowerCase()).filter(Boolean).slice(0, 3).sort(),
    stars: int(raw.stars),
    forks: int(raw.forks),
    publicRepos: int(raw.publicRepos),
    followers: int(raw.followers),
    accountAgeYears: int(raw.accountAgeYears),
    mergedExternalPRs: int(raw.mergedExternalPRs),
    releases: int(raw.releases),
    reviewRatio: ratio(raw.reviewRatio),
    collaborators: int(raw.collaborators),
    activeWeeks: int(raw.activeWeeks),
    nightCommitRatio: ratio(raw.nightCommitRatio)
  };
  // Guard: any field not in the identity allowlist is dropped, never hashed.
  for (const k of Object.keys(snap)) {
    if (!IDENTITY_TELEMETRY_FIELDS.includes(k)) delete snap[k];
  }
  return snap;
}

/** Saturating normalizer so whales don't dominate and newcomers aren't zeroed. */
const sat = (x, k) => 1 - Math.exp(-Math.log1p(Math.max(0, x)) / Math.log1p(k));

/**
 * Domain-separated deterministic pick. Each locus hashes independently, so
 * adding a new cosmetic field never perturbs existing choices.
 */
export function pick(seedHex, domain, list) {
  const h = sha256(`${seedHex}:${domain}:${VERSIONS.identitySpec}`);
  return list[parseInt(h.slice(0, 8), 16) % list.length];
}

export function dnaSeed(githubUserId) {
  if (githubUserId === undefined || githubUserId === null || String(githubUserId).trim() === '') {
    throw new Error('dnaSeed requires a github_user_id');
  }
  // Preserve the existing namespace — changing it would flip every live identity.
  return sha256(`githoot:dna:${VERSIONS.dna}:${githubUserId}`);
}

export function meritScore(snap) {
  const s = {
    stars: sat(snap.stars, 500),
    impact: sat(snap.releases + snap.mergedExternalPRs, 30),
    collaboration: sat(snap.collaborators, 25),
    consistency: sat(snap.activeWeeks, 40),
    review: Math.min(1, Math.max(0, snap.reviewRatio)),
    breadth: sat(snap.publicRepos, 30),
    tenure: sat(snap.accountAgeYears, 8)
  };
  let total = 0;
  for (const [k, w] of Object.entries(MERIT_WEIGHTS)) total += w * s[k];
  return Math.round(Math.min(1, Math.max(0, total)) * 1e6) / 1e6;
}

export function rarityFor(merit) {
  for (const cut of RARITY_CUTS) if (merit < cut.max) return cut.tier;
  return RARITY_CUTS[RARITY_CUTS.length - 1].tier;
}

/** Element: GitHub language evidence first, seed only as tie-break. */
export function elementFor(seedHex, snap) {
  const votes = new Map();
  for (const lang of snap.topLanguages) {
    const el = LANGUAGE_ELEMENT[lang];
    if (el) votes.set(el, (votes.get(el) || 0) + 1);
  }
  if (snap.nightCommitRatio >= 0.5) votes.set('Void', (votes.get('Void') || 0) + 1);
  if (!votes.size) return pick(seedHex, 'element', ELEMENTS);
  const top = Math.max(...votes.values());
  // Deterministic tie-break: sort candidates, then seed-pick among them.
  const tied = [...votes.entries()].filter(([, v]) => v === top).map(([k]) => k).sort();
  return tied.length === 1 ? tied[0] : pick(seedHex, 'element-tie', tied);
}

/** Fields a pre-existing Guardian may pin to match a reference that predates the compiler. */
export const PINNABLE = Object.freeze(['element', 'rarity', 'build', 'silhouette', 'crest', 'markings', 'material', 'aura', 'temperament']);

const ENUM_OF = Object.freeze({
  element: ELEMENTS, build: BUILDS, silhouette: SILHOUETTES, crest: CRESTS,
  markings: MARKINGS, material: MATERIALS, aura: AURAS, temperament: TEMPERAMENTS
});

/**
 * Compile the immutable IdentitySpec. Enum-only: every field is a bounded token,
 * never free text, so untrusted GitHub prose can never reach a prompt.
 *
 * `pin` exists for Guardians whose canonical reference image predates this
 * compiler: their spec MUST agree with the pinned reference, or the prompt would
 * fight the reference. For a new Guardian the reference is rendered FROM the
 * spec, so they agree by construction and `pin` must be omitted.
 * Pins are versioned job input and recorded in `pinnedFields` for audit.
 */
export function compileIdentitySpec({ githubUserId, telemetry, pin }) {
  const snap = normalizeTelemetry(telemetry);
  const seed = dnaSeed(githubUserId);
  const merit = meritScore(snap);

  const spec = {
    identitySpecVersion: VERSIONS.identitySpec,
    dnaVersion: VERSIONS.dna,
    telemetrySnapshotVersion: VERSIONS.telemetrySnapshot,
    githubUserId: String(githubUserId),
    dnaSeed: seed,
    telemetrySnapshotHash: sha256(canonicalJson(snap)),
    element: elementFor(seed, snap),
    rarity: rarityFor(merit),
    merit,
    build: pick(seed, 'build', BUILDS),
    silhouette: pick(seed, 'silhouette', SILHOUETTES),
    crest: pick(seed, 'crest', CRESTS),
    markings: pick(seed, 'markings', MARKINGS),
    material: pick(seed, 'material', MATERIALS),
    aura: pick(seed, 'aura', AURAS),
    temperament: pick(seed, 'temperament', TEMPERAMENTS)
  };

  const pinnedFields = [];
  if (pin) {
    for (const [k, v] of Object.entries(pin)) {
      if (!PINNABLE.includes(k)) throw new Error(`identity pin not allowed for field: ${k}`);
      const allowed = k === 'rarity' ? RARITIES : ENUM_OF[k];
      if (!allowed.includes(v)) throw new Error(`identity pin "${k}" must be one of: ${allowed.join(', ')}`);
      spec[k] = v;
      pinnedFields.push(k);
    }
  }
  spec.pinnedFields = pinnedFields.sort();
  spec.identityHash = sha256(canonicalJson(spec));
  return spec;
}

/** Byte-identical identity block. Enum expansions only — no per-species prose. */
export function identityBlock(spec) {
  return [
    `Character identity (immutable): a ${spec.temperament} ${spec.element}-element guardian creature.`,
    `Silhouette: ${spec.silhouette}. Head feature: ${spec.crest}. Surface: ${spec.material} with ${spec.markings}.`,
    `Aura: ${spec.aura}. Rarity treatment: ${spec.rarity}.`,
    BUILD_PROMPT[spec.build],
    'MATCH the attached reference image EXACTLY: same silhouette, same palette, same art style, same proportions.',
    'Immutable identity: do not redesign the character, do not change species, do not change body type.'
  ].join('\n');
}

/**
 * Compile one pose prompt. Byte-identical for a given (spec, poseId, versions).
 * Creativity is explicitly bounded to subordinate detail.
 */
export function compilePosePrompt(spec, poseId) {
  const pose = POSE_PROMPT[poseId];
  if (!pose) throw new Error(`unknown pose id: ${poseId}`);
  const text = [
    `Draw ONE brand-new single-character sprite frame. The character is ${pose}.`,
    identityBlock(spec),
    'The attached image is a STYLE/IDENTITY reference ONLY: do NOT copy its layout, do NOT reproduce a grid or multiple panels, do NOT copy its poses, do NOT include any text or labels from it.',
    'Output exactly ONE character in ONE pose filling the frame: side-profile 3/4 view, FULL BODY head to feet, centered and large.',
    'No grid, no panels, no borders, no text, no extra characters.',
    `Background: pure solid chroma key ${CHROMA.keyHex}, flat, no shadows on the background, hard clean silhouette edges, no green spill on the character.`,
    'Creative allowance: invent only subordinate texture, lighting, and particle detail consistent with the immutable identity. Do not alter anatomy, build, silhouette, palette, crest, or subject count.'
  ].join('\n');
  return { poseId, text, promptHash: sha256(text) };
}

export function compileAllPosePrompts(spec) {
  return POSE_SET.map(p => compilePosePrompt(spec, p.id));
}

/**
 * Idempotency fingerprint. A hit means accepted bytes may be REUSED after
 * re-validation; it never means validation can be skipped.
 */
export function requestFingerprint({ spec, referenceSha256, modelId }) {
  return sha256(canonicalJson({
    processingPolicyVersion: VERSIONS.processingPolicy,
    promptCompilerVersion: VERSIONS.promptCompiler,
    poseSetVersion: VERSIONS.poseSet,
    frame: FRAME,
    identityHash: spec.identityHash,
    telemetrySnapshotHash: spec.telemetrySnapshotHash,
    referenceSha256,
    modelId
  }));
}
