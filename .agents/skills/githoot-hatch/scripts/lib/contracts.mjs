// Authoritative contracts for the GitHoot hatch pipeline.
// EVERY threshold, version, enum, and allowlist lives here. Other modules and
// docs reference these values; they are never re-declared elsewhere.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowlistPath = path.resolve(__dirname, '../../../../../src/server/services/dna/model-allowlist.json');

export const VERSIONS = Object.freeze({
  dna: 'v1',                  // seed namespace: githoot:dna:v1:<github_user_id>
  telemetrySnapshot: 'v1',
  identitySpec: 'v1',
  promptCompiler: 'v1',
  poseSet: 'landing16.v1',
  processingPolicy: 'v1'
});

// Nano Banana 2 / Pro only. Single source loaded from src/server/services/dna/model-allowlist.json.
export const MODEL_ALLOWLIST = Object.freeze(JSON.parse(fs.readFileSync(allowlistPath, 'utf8')));

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Frame + sheet geometry. The compositor owns geometry; the model never does.
export const FRAME = Object.freeze({ size: 256, cols: 4, rows: 4 });

// Structural gate thresholds (empirically derived; see references/quality-gates.md).
export const GATES = Object.freeze({
  maxLargeComponents: 4,        // >4 => collage/reference echo
  dominanceRatio: 0.30,         // 2nd largest > 30% of largest => multi-subject
  minBboxFill: 0.06,            // <6% of frame => subject too small / far away
  maxBboxAspect: 3.2,           // >3.2 => strip/banner, not one figure
  componentMinAreaRatio: 0.003, // component smaller than this is a speckle
  alphaThreshold: 24,           // opaque cutoff for component/bbox scans
  maxAttemptsPerPose: 3
});

// Chroma key + de-spill policy. Fixed-offset slicing of model output is FORBIDDEN.
export const CHROMA = Object.freeze({
  keyHex: '#00FF00',
  hardCutDistance: 60,   // euclidean distance to sampled bg => alpha 0
  featherDistance: 100,  // between hardCut and this => feathered alpha
  greenBias: 1.25        // g > r*bias && g > b*bias => treat as chroma
});

// 16-pose landing set. IDs and order are frozen; changing them means a new poseSet version.
export const POSE_SET = Object.freeze([
  { id: 'hover', label: 'Bay lơ lửng', beat: 'airborne' },
  { id: 'dive_start', label: 'Lao xuống', beat: 'airborne' },
  { id: 'dive_steep', label: 'Dive dốc', beat: 'airborne' },
  { id: 'plunge', label: 'Bổ nhào', beat: 'airborne' },
  { id: 'approach', label: 'Tiếp cận', beat: 'airborne' },
  { id: 'pre_impact', label: 'Trước va chạm', beat: 'airborne' },
  { id: 'three_point_landing', label: 'Tiếp đất 3 điểm', beat: 'impact' },
  { id: 'impact_crouch', label: 'Khựng nứt sàn', beat: 'impact' },
  { id: 'shockwave', label: 'Sóng xung kích', beat: 'impact' },
  { id: 'recoil', label: 'Bật lại', beat: 'recover' },
  { id: 'rise_knee', label: 'Nhấc gối', beat: 'recover' },
  { id: 'rise_aura', label: 'Vươn lên', beat: 'recover' },
  { id: 'stand_up', label: 'Đứng dậy', beat: 'recover' },
  { id: 'aura_flare', label: 'Bừng hào quang', beat: 'finish' },
  { id: 'settle', label: 'Ưỡn ngực', beat: 'finish' },
  { id: 'hero_stance', label: 'Thế anh hùng', beat: 'finish' }
]);

// Deterministic pose wording. One byte-identical block per pose id.
export const POSE_PROMPT = Object.freeze({
  hover: 'hovering airborne with arms spread, feet off the ground',
  dive_start: 'starting to dive forward, body tilting head-down',
  dive_steep: 'in a steep head-first dive with speed motion streaks',
  plunge: 'in a fast downward plunge, legs trailing upward',
  approach: 'in an angled descent approaching the ground, arms reaching down',
  pre_impact: 'about to land, one fist reaching down toward the ground',
  three_point_landing: 'in a three-point superhero landing: one fist and one knee planted on the ground, head low, other arm back',
  impact_crouch: 'in a deep compressed landing crouch, both feet down, small ground crack beneath',
  shockwave: 'crouched at the moment of a shockwave burst, glowing energy rings exploding outward around the feet',
  recoil: 'pushing up out of the crouch with a slight upward recoil',
  rise_knee: 'rising to stand with one knee still lifted',
  rise_aura: 'rising higher as a glowing aura begins to kindle around the body',
  stand_up: 'standing up, legs straightening, arms lowering',
  aura_flare: 'standing as a bright energy aura flares outward around the body',
  settle: 'standing tall, chest out and shoulders back, settling into a confident stance',
  hero_stance: 'in a majestic full standing heroic victory stance, fists ready, aura steady'
});

// Companion emotion and mood state pose set.
export const EMOTION_POSE_SET = Object.freeze([
  { id: 'idle', label: 'Idle / Thong tha', icon: '✦', col: 1, row: 0 },
  { id: 'happy', label: 'Happy / Vui ve', icon: '😊', col: 2, row: 0 },
  { id: 'sad', label: 'Sad / Buon ba', icon: '🥺', col: 0, row: 0 },
  { id: 'excited', label: 'Excited / Hao hung', icon: '⚡', col: 1, row: 1 },
  { id: 'angry', label: 'Angry / Chien dau', icon: '⚔️', col: 1, row: 1 },
  { id: 'surprised', label: 'Surprised / Ngac nhien', icon: '😲', col: 0, row: 1 },
  { id: 'sleep', label: 'Sleep / Ngu say', icon: '😴', col: 3, row: 0 },
  { id: 'work', label: 'Work / Lap trinh', icon: '💻', col: 2, row: 1 },
  { id: 'celebrate', label: 'Celebrate / An mung', icon: '🎉', col: 3, row: 1 }
]);

export const EMOTION_POSE_PROMPT = Object.freeze({
  idle: 'in a natural, alert, and peaceful idle standing posture with eyes focused and subtle gentle breathing',
  happy: 'joyfully bouncing with cheerful smiling eyes, glowing sparkle particles and a delighted expression',
  sad: 'in a drooping dejected posture with lowered head, downcast sad eyes, and soft blue gloomy motes',
  excited: 'leaping with electric high energy, wide eager sparkling eyes, and vibrant energy sparks bursting outward',
  angry: 'in a fierce combat battle-ready stance with narrowed fiery eyes, flared aura, and clenched ready fists',
  surprised: 'startled in mid-air with wide shocked eyes, raised eyebrows, and little exclamation sparkle motes',
  sleep: 'peacefully curled up or relaxed in a cozy sleeping pose, gentle closed eyes, and floating soft zZz dream motes',
  work: 'intently focused on coding with holographic floating cyber runes and focused glowing eyes',
  celebrate: 'triumphantly cheering with hands raised in victory, wide smile, and colorful energy confetti bursting around'
});

// ---- Identity enum tables (deterministic personalization from GitHub data) ----
// Bounded tables keep the design space large while every choice stays reproducible.

export const ELEMENTS = Object.freeze(['Fire', 'Cyber', 'Water', 'Nature', 'Light', 'Void', 'Metal', 'Cosmic']);

// Language family -> element affinity. Lowercased language ids only.
export const LANGUAGE_ELEMENT = Object.freeze({
  rust: 'Fire', c: 'Fire', 'c++': 'Fire', zig: 'Fire',
  javascript: 'Cyber', typescript: 'Cyber', vue: 'Cyber', svelte: 'Cyber',
  python: 'Water', jupyter: 'Water', r: 'Water', julia: 'Water',
  go: 'Nature', elixir: 'Nature', erlang: 'Nature', haskell: 'Nature',
  java: 'Light', kotlin: 'Light', swift: 'Light',
  assembly: 'Void', solidity: 'Void', nix: 'Void',
  dockerfile: 'Metal', hcl: 'Metal', shell: 'Metal', makefile: 'Metal'
});

// Canonical species, one per element. Bounded on purpose: the art direction is
// already established for these eight, so the pipeline never asks a model to
// invent an unshippable ninth base creature. Species is derived, never rolled
// free-form, and never taken from model output.
export const SPECIES = Object.freeze([
  { id: 'emberfox', element: 'Fire', name: 'Ignis Emberfox', anatomy: 'agile vulpine quadruped with flame tails' },
  { id: 'neonbyte', element: 'Cyber', name: 'Aether Neonbyte', anatomy: 'humanoid cyber-elemental with a flame-like energy crest' },
  { id: 'abyssal', element: 'Water', name: 'Nox Abyssal Pearl', anatomy: 'deep-sea leviathan with translucent fins' },
  { id: 'verdant', element: 'Nature', name: 'Sylvan Verdant Golem', anatomy: 'botanical guardian with bark plating and branch antlers' },
  { id: 'solargriffin', element: 'Light', name: 'Helios Solar Griffin', anatomy: 'winged griffin with gold plating and feathered light wings' },
  { id: 'voidstalker', element: 'Void', name: 'Astral Void Stalker', anatomy: 'umbral predator with obsidian horns and tattered shadow wings' },
  { id: 'rustgolem', element: 'Metal', name: 'Ferrum Rust Golem', anatomy: 'ferrous golem with riveted plating and vent ports' },
  { id: 'celestialdrake', element: 'Cosmic', name: 'Zenith Celestial Drake', anatomy: 'astral dragon with a crystalline antler crown and aurora wings' }
]);

// Phenotype loci must be COMPATIBLE with the species, or the prompt contradicts
// itself (a vulpine quadruped cannot also be a humanoid biped — the model then
// invents a hybrid). Each species declares the silhouettes and crests it admits;
// unconstrained loci (markings, material, aura, temperament) stay global.
export const SPECIES_PHENOTYPE = Object.freeze({
  emberfox:       { silhouettes: ['quadruped beast', 'agile biped'],      crests: ['flame crest', 'horned crown'] },
  neonbyte:       { silhouettes: ['humanoid biped'],                      crests: ['flame crest', 'antenna fins', 'halo ring'] },
  abyssal:        { silhouettes: ['serpentine', 'quadruped beast'],       crests: ['smooth carapace', 'antenna fins'] },
  verdant:        { silhouettes: ['humanoid biped', 'quadruped beast'],   crests: ['antler branches', 'horned crown'] },
  solargriffin:   { silhouettes: ['winged biped', 'quadruped beast'],     crests: ['horned crown', 'halo ring'] },
  voidstalker:    { silhouettes: ['quadruped beast', 'floating wisp'],    crests: ['horned crown', 'smooth carapace'] },
  rustgolem:      { silhouettes: ['humanoid biped', 'towering hulk'],     crests: ['horned crown', 'smooth carapace'] },
  celestialdrake: { silhouettes: ['serpentine', 'winged biped'],          crests: ['antler branches', 'halo ring'] }
});

// Builds a species admits. Keeps "towering" off a compact sprite and vice versa.
export const SPECIES_BUILDS = Object.freeze({
  emberfox: ['lithe', 'compact'],
  neonbyte: ['stocky', 'compact'],
  abyssal: ['lithe', 'towering'],
  verdant: ['stocky', 'towering'],
  solargriffin: ['lithe', 'stocky'],
  voidstalker: ['lithe', 'compact'],
  rustgolem: ['stocky', 'towering'],
  celestialdrake: ['towering', 'lithe']
});

export const BUILDS = Object.freeze(['stocky', 'lithe', 'towering', 'compact']);

// Empirically necessary: body type drifts without explicit negative wording.
export const BUILD_PROMPT = Object.freeze({
  stocky: 'Build: STOCKY and CHUNKY chibi-heroic proportions, broad shoulders, thick sturdy limbs, large head relative to body. NOT slim, NOT thin, NOT elongated.',
  lithe: 'Build: LITHE and agile proportions, narrow waist, long clean limbs, light frame. NOT bulky, NOT armored-heavy.',
  towering: 'Build: TOWERING and broad, heavy armored mass, wide chest, massive shoulders. NOT small, NOT chibi.',
  compact: 'Build: COMPACT and rounded, short sturdy limbs, oversized head, mascot-like. NOT tall, NOT lanky.'
});

export const SILHOUETTES = Object.freeze(['humanoid biped', 'winged biped', 'quadruped beast', 'serpentine', 'floating wisp', 'agile biped', 'towering hulk']);
export const CRESTS = Object.freeze(['flame crest', 'horned crown', 'antenna fins', 'halo ring', 'antler branches', 'smooth carapace']);
export const MARKINGS = Object.freeze(['circuit traces', 'runic glyphs', 'constellation freckles', 'tribal stripes', 'crystal scales', 'void fissures']);
export const MATERIALS = Object.freeze(['plated armor', 'living crystal', 'woven energy', 'molten stone', 'polished chitin']);
export const AURAS = Object.freeze(['ember drift', 'scanline shimmer', 'bioluminescent motes', 'pollen bloom', 'radiant corona', 'umbral wisps', 'spark discharge', 'nebula dust']);
export const TEMPERAMENTS = Object.freeze(['stoic', 'fierce', 'playful', 'serene', 'cryptic', 'regal']);
export const RARITIES = Object.freeze(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']);

// Rarity cut-points on the merit score (0..1). Earned, not rolled.
export const RARITY_CUTS = Object.freeze([
  { tier: 'Common', max: 0.45 },
  { tier: 'Rare', max: 0.68 },
  { tier: 'Epic', max: 0.84 },
  { tier: 'Legendary', max: 0.94 },
  { tier: 'Mythic', max: 1.01 }
]);

// Merit weights for rarity. Must sum to 1.
export const MERIT_WEIGHTS = Object.freeze({
  stars: 0.30, impact: 0.20, collaboration: 0.15,
  consistency: 0.12, review: 0.08, breadth: 0.08, tenure: 0.07
});

// Telemetry fields frozen at hatch. Anything not listed here MUST NOT affect identity.
export const IDENTITY_TELEMETRY_FIELDS = Object.freeze([
  'topLanguages', 'stars', 'forks', 'publicRepos', 'followers',
  'accountAgeYears', 'mergedExternalPRs', 'releases', 'reviewRatio',
  'collaborators', 'activeWeeks', 'nightCommitRatio'
]);

// Job lifecycle. Only the publisher may write ASSET_READY.
export const JOB_STATES = Object.freeze(['PENDING', 'GENERATING', 'VERIFYING', 'QUARANTINED', 'ASSET_READY', 'FAILED']);

export const EXIT = Object.freeze({
  ok: 0,
  usage: 1,
  noCredential: 2,
  generationFailed: 3,
  modelNotAllowed: 4,
  referenceMissing: 5,
  gateFailed: 6,
  verificationFailed: 7
});
