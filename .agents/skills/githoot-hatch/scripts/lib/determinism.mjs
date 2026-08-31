// ============================================================================
// Deterministic layer: telemetry normalization -> IdentitySpec -> prompt bytes.
// PURE Web Crypto SHA-256 implementation.
// ============================================================================

import {
  VERSIONS, POSE_SET, POSE_PROMPT, FRAME, CHROMA,
  ELEMENTS, LANGUAGE_ELEMENT, BUILDS, BUILD_PROMPT, SILHOUETTES, CRESTS,
  MARKINGS, MATERIALS, AURAS, TEMPERAMENTS, RARITIES, RARITY_CUTS, MERIT_WEIGHTS, SPECIES, SPECIES_PHENOTYPE, SPECIES_BUILDS,
  IDENTITY_TELEMETRY_FIELDS
} from './contracts.mjs';

export async function sha256(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Canonical JSON: sorted keys, no whitespace. Key ordering can never change a hash. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value;
  return '{' + Object.keys(obj).sort()
    .filter(k => obj[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
    .join(',') + '}';
}

/**
 * Normalize raw GitHub telemetry into the frozen identity snapshot with complete provenance.
 */
export function normalizeTelemetry(raw = {}) {
  const parseNum = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };
  const parseRatio = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };

  const langs = Array.isArray(raw.topLanguages) ? raw.topLanguages : [];
  const prov = raw.provenance || {};

  const completeProvenance = {
    topLanguages: prov.topLanguages || 'unavailable',
    stars: prov.stars || 'unavailable',
    forks: prov.forks || 'unavailable',
    publicRepos: prov.publicRepos || 'unavailable',
    followers: prov.followers || 'unavailable',
    accountAgeYears: prov.accountAgeYears || 'unavailable',
    mergedExternalPRs: prov.mergedExternalPRs || 'unavailable',
    releases: prov.releases || 'unavailable',
    reviewRatio: prov.reviewRatio || 'unavailable',
    collaborators: prov.collaborators || 'unavailable',
    activeWeeks: prov.activeWeeks || 'unavailable',
    nightCommitRatio: prov.nightCommitRatio || 'unavailable'
  };

  return {
    topLanguages: langs.map(l => String(l).trim().toLowerCase()).filter(Boolean).slice(0, 3).sort(),
    stars: parseNum(raw.stars),
    forks: parseNum(raw.forks),
    publicRepos: parseNum(raw.publicRepos),
    followers: parseNum(raw.followers),
    accountAgeYears: parseNum(raw.accountAgeYears),
    mergedExternalPRs: parseNum(raw.mergedExternalPRs),
    releases: parseNum(raw.releases),
    reviewRatio: parseRatio(raw.reviewRatio),
    collaborators: parseNum(raw.collaborators),
    activeWeeks: parseNum(raw.activeWeeks),
    nightCommitRatio: parseRatio(raw.nightCommitRatio),
    provenance: completeProvenance
  };
}

/** Saturating normalizer so whales don't dominate and newcomers aren't zeroed. */
const sat = (x, k) => 1 - Math.exp(-Math.log1p(Math.max(0, x)) / Math.log1p(k));

/**
 * Domain-separated deterministic pick. Each locus hashes independently.
 */
export async function pick(seedHex, domain, list) {
  const h = await sha256(`${seedHex}:${domain}:${VERSIONS.identitySpec}`);
  return list[parseInt(h.slice(0, 8), 16) % list.length];
}

export async function dnaSeed(githubUserId) {
  if (githubUserId === undefined || githubUserId === null || String(githubUserId).trim() === '') {
    throw new Error('dnaSeed requires a github_user_id');
  }
  return await sha256(`githoot:dna:${VERSIONS.dna}:${githubUserId}`);
}

export function meritScore(snap) {
  const prov = snap.provenance || {};
  const neutralIfUnavailable = (val, k, field) => {
    if (prov[field] === 'unavailable') return 0.25;
    return sat(val, k);
  };

  let impactScore = 0.25;
  if (prov.releases === 'measured' && prov.mergedExternalPRs === 'measured') {
    impactScore = sat(snap.releases + snap.mergedExternalPRs, 30);
  } else if (prov.releases === 'measured') {
    impactScore = sat(snap.releases, 15);
  } else if (prov.mergedExternalPRs === 'measured') {
    impactScore = sat(snap.mergedExternalPRs, 15);
  }

  const s = {
    stars: neutralIfUnavailable(snap.stars, 500, 'stars'),
    impact: impactScore,
    collaboration: neutralIfUnavailable(snap.collaborators, 25, 'collaborators'),
    consistency: neutralIfUnavailable(snap.activeWeeks, 40, 'activeWeeks'),
    review: prov.reviewRatio === 'unavailable' ? 0.25 : Math.min(1, Math.max(0, snap.reviewRatio)),
    breadth: neutralIfUnavailable(snap.publicRepos, 30, 'publicRepos'),
    tenure: neutralIfUnavailable(snap.accountAgeYears, 8, 'accountAgeYears')
  };
  let total = 0;
  for (const [k, w] of Object.entries(MERIT_WEIGHTS)) total += w * (s[k] || 0);
  return Math.round(Math.min(1, Math.max(0, total)) * 1e6) / 1e6;
}

export function rarityFor(merit) {
  for (const cut of RARITY_CUTS) if (merit < cut.max) return cut.tier;
  return RARITY_CUTS[RARITY_CUTS.length - 1].tier;
}

/** Element: GitHub language evidence first, seed only as tie-break. */
export async function elementFor(seedHex, snap) {
  const prov = snap.provenance || {};
  const votes = {};

  if (prov.topLanguages === 'measured' && Array.isArray(snap.topLanguages)) {
    for (const lang of snap.topLanguages) {
      const el = LANGUAGE_ELEMENT[lang.toLowerCase()];
      if (el) votes[el] = (votes[el] || 0) + 1;
    }
  }

  if (prov.nightCommitRatio === 'measured' && snap.nightCommitRatio >= 0.5) {
    votes['Void'] = (votes['Void'] || 0) + 1;
  }

  const entries = Object.entries(votes);
  if (entries.length === 0) return await pick(seedHex, 'element', ELEMENTS);
  const top = Math.max(...Object.values(votes));
  const tied = entries.filter(([, v]) => v === top).map(([k]) => k).sort();
  return tied.length === 1 ? tied[0] : await pick(seedHex, 'element-tie', tied);
}

export function speciesFor(element) {
  const s = SPECIES.find(x => x.element === element);
  if (!s) throw new Error(`no canonical species for element: ${element}`);
  return s;
}

export const PINNABLE = Object.freeze(['element', 'rarity', 'build', 'silhouette', 'crest', 'markings', 'material', 'aura', 'temperament']);

export async function compileIdentitySpec({ githubUserId, telemetry, pin = {} }) {
  if (githubUserId === undefined || githubUserId === null || String(githubUserId).trim() === '') {
    throw new Error('compileIdentitySpec requires a githubUserId');
  }
  const snap = normalizeTelemetry(telemetry);
  const seedHex = await dnaSeed(githubUserId);

  for (const k of Object.keys(pin)) {
    if (!PINNABLE.includes(k)) {
      throw new Error(`unrecognized pinned field: ${k}`);
    }
  }

  const merit = meritScore(snap);
  const rawRarity = rarityFor(merit);

  let element = pin.element && ELEMENTS.includes(pin.element)
    ? pin.element
    : await elementFor(seedHex, snap);

  const rawSpecies = speciesFor(element);
  const rarity = pin.rarity && RARITIES.includes(pin.rarity)
    ? pin.rarity
    : rawRarity;

  const validBuilds = SPECIES_BUILDS[rawSpecies.id] || BUILDS;
  if (pin.build && !validBuilds.includes(pin.build)) {
    throw new Error(`build ${pin.build} is incompatible with species ${rawSpecies.id}`);
  }
  const build = pin.build || await pick(seedHex, 'build', validBuilds);

  const validSilhouettes = SPECIES_PHENOTYPE[rawSpecies.id]?.silhouettes || SILHOUETTES;
  if (pin.silhouette && !validSilhouettes.includes(pin.silhouette)) {
    throw new Error(`silhouette ${pin.silhouette} is incompatible with species ${rawSpecies.id}`);
  }
  const silhouette = pin.silhouette || await pick(seedHex, 'silhouette', validSilhouettes);

  const validCrests = SPECIES_PHENOTYPE[rawSpecies.id]?.crests || CRESTS;
  if (pin.crest && !validCrests.includes(pin.crest)) {
    throw new Error(`crest ${pin.crest} is incompatible with species ${rawSpecies.id}`);
  }
  const crest = pin.crest || await pick(seedHex, 'crest', validCrests);

  if (pin.markings && !MARKINGS.includes(pin.markings)) {
    throw new Error(`markings ${pin.markings} is not allowed`);
  }
  const markings = pin.markings || await pick(seedHex, 'markings', MARKINGS);

  if (pin.material && !MATERIALS.includes(pin.material)) {
    throw new Error(`material ${pin.material} is not allowed`);
  }
  const material = pin.material || await pick(seedHex, 'material', MATERIALS);

  if (pin.aura && !AURAS.includes(pin.aura)) {
    throw new Error(`aura ${pin.aura} is not allowed`);
  }
  const aura = pin.aura || await pick(seedHex, 'aura', AURAS);

  if (pin.temperament && !TEMPERAMENTS.includes(pin.temperament)) {
    throw new Error(`temperament ${pin.temperament} is not allowed`);
  }
  const temperament = pin.temperament || await pick(seedHex, 'temperament', TEMPERAMENTS);

  const species = speciesFor(element);
  const anatomy = species.anatomy || 'elemental-quadruped';
  const telemetrySnapshotHash = await sha256(canonicalJson(snap));

  const partialSpec = {
    identitySpecVersion: VERSIONS.identitySpec,
    dnaVersion: VERSIONS.dna,
    telemetrySnapshotVersion: VERSIONS.telemetrySnapshot,
    githubUserId: String(githubUserId),
    dnaSeed: seedHex,
    telemetrySnapshotHash,
    element,
    rarity,
    merit,
    species: species.id,
    speciesName: species.name,
    anatomy,
    build,
    silhouette,
    crest,
    markings,
    material,
    aura,
    temperament,
    ...(Object.keys(pin).length > 0 ? { pinnedFields: Object.keys(pin).sort() } : {})
  };

  const identityHash = await sha256(canonicalJson(partialSpec));

  return {
    ...partialSpec,
    identityHash
  };
}

export function identityBlock(spec, { withReference = true } = {}) {
  const parts = [
    `Character Identity: ${spec.speciesName} (Species: ${spec.species}, Element: ${spec.element}, Rarity: ${spec.rarity}).`,
    `Anatomy & Build: ${spec.anatomy}; build: ${spec.build} (${BUILD_PROMPT[spec.build] || 'standard'}), silhouette: ${spec.silhouette}.`,
    `Features: crest=${spec.crest}, markings=${spec.markings}, material=${spec.material}, aura=${spec.aura}.`,
    `Temperament: ${spec.temperament}.`
  ];
  if (withReference) {
    parts.push(`Style Reference: condition rendering on reference portrait for color palette, material texture, and facial identity.`);
  }
  return parts.join(' ');
}

export async function compileReferencePrompt(spec) {
  const text = [
    `Canonical reference portrait of a mythical cyber companion creature on solid green #00FF00 chroma background.`,
    `Single character centered in frame, facing camera. Full body visible.`,
    identityBlock(spec, { withReference: false }),
    `Art style: premium 16-bit arcade pixel art, crisp contours, vibrant neon palette, no antialiasing on background edge.`
  ].join(' ');
  const promptHash = await sha256(text);
  return { poseId: 'reference', text, promptHash };
}

export async function compilePosePrompt(spec, poseId) {
  const poseDef = POSE_SET.find(p => p.id === poseId);
  if (!poseDef) {
    throw new Error(`unknown pose id: ${poseId}`);
  }
  const text = [
    `Animation frame: ${poseDef.label} pose of companion creature on solid green #00FF00 chroma background.`,
    POSE_PROMPT[poseDef.id] || `Character performing ${poseDef.label}.`,
    `Single character centered in frame, no grid, no multi-panel, no border.`,
    identityBlock(spec, { withReference: true }),
    `Art style: match reference portrait color palette and identity exactly. Premium pixel art.`
  ].join(' ');
  const promptHash = await sha256(text);
  return { poseId, text, promptHash };
}

export async function compileAllPosePrompts(spec) {
  return await Promise.all(POSE_SET.map(p => compilePosePrompt(spec, p.id)));
}

export async function requestFingerprint({ spec, referenceSha256, modelId }) {
  const payload = {
    identityHash: spec.identityHash,
    referenceSha256,
    modelId,
    promptCompilerVersion: VERSIONS.promptCompiler,
    poseSetVersion: VERSIONS.poseSet
  };
  return await sha256(canonicalJson(payload));
}
