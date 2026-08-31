// ============================================================================
// GitHoot Deterministic Identity & Prompt Compiler (src/server/services/dna/compiler.ts)
// Single-Source Async Web Crypto SHA-256 Engine
// ============================================================================

import type { IdentitySpec, RarityTier, TelemetrySnapshot } from '../../types';
import { sha256Hex } from '../crypto/web-crypto';
import {
  VERSIONS, POSE_SET, POSE_PROMPT, FRAME, CHROMA,
  ELEMENTS, LANGUAGE_ELEMENT, BUILDS, BUILD_PROMPT, SILHOUETTES, CRESTS,
  MARKINGS, MATERIALS, AURAS, TEMPERAMENTS, RARITIES, RARITY_CUTS, MERIT_WEIGHTS,
  SPECIES, SPECIES_PHENOTYPE, SPECIES_BUILDS, IDENTITY_TELEMETRY_FIELDS,
  type SpeciesEntry
} from './contracts';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).sort()
    .filter(k => obj[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k]))
    .join(',') + '}';
}

export function normalizeTelemetry(
  raw: Partial<Omit<TelemetrySnapshot, 'provenance'>> & {
    provenance?: Partial<TelemetrySnapshot['provenance']>;
  } = {}
): TelemetrySnapshot {
  const parseNum = (v: unknown, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  };
  const parseRatio = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };

  const langs = Array.isArray(raw.topLanguages) ? raw.topLanguages : [];
  const prov = (raw.provenance || {}) as Partial<TelemetrySnapshot['provenance']>;

  const completeProvenance: TelemetrySnapshot['provenance'] = {
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

  const snap: TelemetrySnapshot = {
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

  return snap;
}

const sat = (x: number, k: number) => 1 - Math.exp(-Math.log1p(Math.max(0, x)) / Math.log1p(k));

export async function pick<T>(seedHex: string, domain: string, list: readonly T[]): Promise<T> {
  const h = await sha256Hex(`${seedHex}:${domain}:${VERSIONS.identitySpec}`);
  return list[parseInt(h.slice(0, 8), 16) % list.length]!;
}

export async function dnaSeed(githubUserId: string | number): Promise<string> {
  if (githubUserId === undefined || githubUserId === null || String(githubUserId).trim() === '') {
    throw new Error('dnaSeed requires a github_user_id');
  }
  return await sha256Hex(`githoot:dna:${VERSIONS.dna}:${githubUserId}`);
}

export function meritScore(snap: TelemetrySnapshot): number {
  const prov = snap.provenance || {};
  const neutralIfUnavailable = (val: number, k: number, field: keyof Omit<TelemetrySnapshot, 'provenance'>): number => {
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

  const s: Record<string, number> = {
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

export function rarityFor(merit: number): RarityTier {
  for (const cut of RARITY_CUTS) if (merit < cut.max) return cut.tier;
  return RARITY_CUTS[RARITY_CUTS.length - 1]!.tier;
}

export async function elementFor(seedHex: string, snap: TelemetrySnapshot): Promise<string> {
  const prov = snap.provenance || {};
  const votes: Record<string, number> = {};

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
  return tied.length === 1 ? tied[0]! : await pick(seedHex, 'element-tie', tied);
}

export function speciesFor(element: string): SpeciesEntry {
  const s = SPECIES.find(x => x.element === element);
  if (!s) throw new Error(`no canonical species for element: ${element}`);
  return s;
}

export const PINNABLE = Object.freeze(['element', 'rarity', 'build', 'silhouette', 'crest', 'markings', 'material', 'aura', 'temperament'] as const);
export type PinnableField = typeof PINNABLE[number];

export interface CompileIdentityOptions {
  githubUserId: string | number;
  telemetry: Partial<Omit<TelemetrySnapshot, 'provenance'>> & {
    provenance?: Partial<TelemetrySnapshot['provenance']>;
  };
  pin?: Partial<Record<PinnableField, string>>;
}

export async function compileIdentitySpec({ githubUserId, telemetry, pin = {} }: CompileIdentityOptions): Promise<IdentitySpec> {
  if (githubUserId === undefined || githubUserId === null || String(githubUserId).trim() === '') {
    throw new Error('compileIdentitySpec requires a githubUserId');
  }
  const snap = normalizeTelemetry(telemetry);
  const seedHex = await dnaSeed(githubUserId);

  for (const k of Object.keys(pin)) {
    if (!PINNABLE.includes(k as PinnableField)) {
      throw new Error(`unrecognized pinned field: ${k}`);
    }
  }

  const merit = meritScore(snap);
  const rawRarity = rarityFor(merit);

  let element = pin.element && ELEMENTS.includes(pin.element)
    ? pin.element
    : await elementFor(seedHex, snap);

  const rawSpecies = speciesFor(element);
  const rarity: RarityTier = pin.rarity && RARITIES.includes(pin.rarity as RarityTier)
    ? pin.rarity as RarityTier
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
  const telemetrySnapshotHash = await sha256Hex(canonicalJson(snap));

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

  const identityHash = await sha256Hex(canonicalJson(partialSpec));

  return {
    ...partialSpec,
    identityHash
  };
}

export function identityBlock(spec: IdentitySpec, { withReference = true } = {}): string {
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

export async function compileReferencePrompt(spec: IdentitySpec): Promise<{ poseId: string; text: string; promptHash: string }> {
  const text = [
    `Canonical reference portrait of a mythical cyber companion creature on solid green #00FF00 chroma background.`,
    `Single character centered in frame, facing camera. Full body visible.`,
    identityBlock(spec, { withReference: false }),
    `Art style: premium 16-bit arcade pixel art, crisp contours, vibrant neon palette, no antialiasing on background edge.`
  ].join(' ');
  const promptHash = await sha256Hex(text);
  return { poseId: 'reference', text, promptHash };
}

export async function compilePosePrompt(spec: IdentitySpec, poseId: string): Promise<{ poseId: string; text: string; promptHash: string }> {
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
  const promptHash = await sha256Hex(text);
  return { poseId, text, promptHash };
}

export async function compileAllPosePrompts(spec: IdentitySpec): Promise<Array<{ poseId: string; text: string; promptHash: string }>> {
  return await Promise.all(POSE_SET.map(p => compilePosePrompt(spec, p.id)));
}

export async function requestFingerprint({
  spec,
  referenceSha256,
  modelId
}: {
  spec: IdentitySpec;
  referenceSha256: string;
  modelId: string;
}): Promise<string> {
  const payload = {
    identityHash: spec.identityHash,
    referenceSha256,
    modelId,
    promptCompilerVersion: VERSIONS.promptCompiler,
    poseSetVersion: VERSIONS.poseSet
  };
  return await sha256Hex(canonicalJson(payload));
}

/**
 * Authoritative runtime validator for persisted IdentitySpec.
 * Validates types, enums, versions, element-species alignment, and recomputes canonical identityHash.
 */
export async function validateIdentitySpec(
  raw: unknown,
  expectedContext?: { githubUserId?: string | number }
): Promise<{ valid: true; spec: IdentitySpec } | { valid: false; reason: string }> {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'IdentitySpec is not an object or is null/undefined' };
  }
  const s = raw as Record<string, unknown>;
  const requiredStrings = [
    'identitySpecVersion', 'dnaVersion', 'telemetrySnapshotVersion',
    'githubUserId', 'dnaSeed', 'telemetrySnapshotHash', 'element',
    'rarity', 'species', 'speciesName', 'anatomy', 'build',
    'silhouette', 'crest', 'markings', 'material', 'aura',
    'temperament', 'identityHash'
  ];

  for (const field of requiredStrings) {
    if (typeof s[field] !== 'string' || (s[field] as string).trim() === '') {
      return { valid: false, reason: `Missing or invalid required string field: ${field}` };
    }
  }
  if (s.identitySpecVersion !== VERSIONS.identitySpec) {
    return { valid: false, reason: `Unsupported identitySpecVersion: ${s.identitySpecVersion}, expected ${VERSIONS.identitySpec}` };
  }
  if (s.dnaVersion !== VERSIONS.dna) {
    return { valid: false, reason: `Unsupported dnaVersion: ${s.dnaVersion}, expected ${VERSIONS.dna}` };
  }
  if (s.telemetrySnapshotVersion !== VERSIONS.telemetrySnapshot) {
    return { valid: false, reason: `Unsupported telemetrySnapshotVersion: ${s.telemetrySnapshotVersion}, expected ${VERSIONS.telemetrySnapshot}` };
  }
  if (expectedContext?.githubUserId !== undefined && String(s.githubUserId) !== String(expectedContext.githubUserId)) {
    return { valid: false, reason: `githubUserId mismatch: expected ${expectedContext.githubUserId}, got ${s.githubUserId}` };
  }

  const expectedDnaSeed = await dnaSeed(s.githubUserId as string);
  if (s.dnaSeed !== expectedDnaSeed) {
    return { valid: false, reason: `dnaSeed mismatch for user ${s.githubUserId}: expected ${expectedDnaSeed}, got ${s.dnaSeed}` };
  }

  if (!/^[0-9a-f]{64}$/i.test(s.dnaSeed as string)) {
    return { valid: false, reason: `Invalid dnaSeed format: expected 64-hex string, got ${s.dnaSeed}` };
  }
  if (!/^[0-9a-f]{64}$/i.test(s.telemetrySnapshotHash as string)) {
    return { valid: false, reason: `Invalid telemetrySnapshotHash format: expected 64-hex string` };
  }
  if (!/^[0-9a-f]{64}$/i.test(s.identityHash as string)) {
    return { valid: false, reason: `Invalid identityHash format: expected 64-hex string` };
  }
  if (typeof s.merit !== 'number' || s.merit < 0 || s.merit > 1 || !Number.isFinite(s.merit)) {
    return { valid: false, reason: `Invalid merit score: expected number between 0 and 1, got ${s.merit}` };
  }

  if (!RARITIES.includes(s.rarity as RarityTier)) {
    return { valid: false, reason: `Invalid rarity: ${s.rarity}` };
  }
  if (!ELEMENTS.includes(s.element as string)) {
    return { valid: false, reason: `Invalid element: ${s.element}` };
  }
  if (!BUILDS.includes(s.build as string)) {
    return { valid: false, reason: `Invalid build: ${s.build}` };
  }
  if (!SILHOUETTES.includes(s.silhouette as string)) {
    return { valid: false, reason: `Invalid silhouette: ${s.silhouette}` };
  }
  if (!CRESTS.includes(s.crest as string)) {
    return { valid: false, reason: `Invalid crest: ${s.crest}` };
  }
  if (!MARKINGS.includes(s.markings as string)) {
    return { valid: false, reason: `Invalid markings: ${s.markings}` };
  }
  if (!MATERIALS.includes(s.material as string)) {
    return { valid: false, reason: `Invalid material: ${s.material}` };
  }
  if (!AURAS.includes(s.aura as string)) {
    return { valid: false, reason: `Invalid aura: ${s.aura}` };
  }
  if (!TEMPERAMENTS.includes(s.temperament as string)) {
    return { valid: false, reason: `Invalid temperament: ${s.temperament}` };
  }
  const expectedSpecies = SPECIES.find(sp => sp.element === s.element);
  if (!expectedSpecies || expectedSpecies.id !== s.species) {
    return { valid: false, reason: `Element-species mismatch: element ${s.element} expects species ${expectedSpecies?.id || 'none'}, got ${s.species}` };
  }
  if (s.speciesName !== expectedSpecies.name) {
    return { valid: false, reason: `speciesName mismatch: expected ${expectedSpecies.name}, got ${s.speciesName}` };
  }
  if (s.anatomy !== expectedSpecies.anatomy) {
    return { valid: false, reason: `anatomy mismatch: expected ${expectedSpecies.anatomy}, got ${s.anatomy}` };
  }

  if (s.pinnedFields !== undefined) {
    if (!Array.isArray(s.pinnedFields)) {
      return { valid: false, reason: 'pinnedFields must be an array' };
    }
    const seenPins = new Set<string>();
    for (const p of s.pinnedFields) {
      if (typeof p !== 'string' || !PINNABLE.includes(p as PinnableField)) {
        return { valid: false, reason: `Invalid pinnedField: ${p}` };
      }
      if (seenPins.has(p)) {
        return { valid: false, reason: `Duplicate pinnedField: ${p}` };
      }
      seenPins.add(p);
    }
  }

  const ph = SPECIES_PHENOTYPE[s.species as string];
  if (ph && !ph.silhouettes.includes(s.silhouette as string)) {
    return { valid: false, reason: `Silhouette ${s.silhouette} is incompatible with species ${s.species}` };
  }
  if (ph && !ph.crests.includes(s.crest as string)) {
    return { valid: false, reason: `Crest ${s.crest} is incompatible with species ${s.species}` };
  }
  const validBuilds = SPECIES_BUILDS[s.species as string] || BUILDS;
  if (!validBuilds.includes(s.build as string)) {
    return { valid: false, reason: `Build ${s.build} is incompatible with species ${s.species}` };
  }
  const unsignedSpec = { ...s };
  delete unsignedSpec.identityHash;
  const recomputedHash = await sha256Hex(canonicalJson(unsignedSpec));

  if (recomputedHash !== s.identityHash) {
    return { valid: false, reason: `Cryptographic identityHash mismatch: expected ${recomputedHash}, got ${s.identityHash}` };
  }

  return { valid: true, spec: s as unknown as IdentitySpec };
}
