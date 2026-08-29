// ============================================================================
// GitHoot Deterministic DNA & Egg Seeder (src/server/services/dna/seed.ts)
// ============================================================================

import type { GuardianDNA, RarityTier } from '../../types';

export const EGG_ARCHETYPES = [
  { id: 'ember-core', name: 'Ember Core', element: 'Fire', species: 'Ignis Emberfox' },
  { id: 'neon-byte', name: 'Neon Byte', element: 'Cyber', species: 'Aether Neon Byte' },
  { id: 'abyssal-pearl', name: 'Abyssal Pearl', element: 'Water', species: 'Nox Abyssal Pearl' },
  { id: 'verdant-spore', name: 'Verdant Spore', element: 'Nature', species: 'Sylvan Verdant Golem' },
  { id: 'solar-flare', name: 'Solar Flare', element: 'Light', species: 'Helios Solar Griffin' },
  { id: 'void-shard', name: 'Void Shard', element: 'Void', species: 'Astral Void Stalker' },
  { id: 'rust-dynamo', name: 'Rust Dynamo', element: 'Mechanical', species: 'Ferrum Rust Golem' },
  { id: 'celestial-echo', name: 'Celestial Echo', element: 'Mythic', species: 'Zenith Celestial Drake' }
] as const;

const PALETTES_BY_ELEMENT: Record<string, { primary: string; secondary: string; accent: string }> = {
  Fire: { primary: '#FF4500', secondary: '#FFA500', accent: '#FFD700' },
  Cyber: { primary: '#00F0FF', secondary: '#FF2A85', accent: '#7928CA' },
  Water: { primary: '#0070F3', secondary: '#00DFD8', accent: '#79FFE1' },
  Nature: { primary: '#00DF71', secondary: '#50E3C2', accent: '#F5A623' },
  Light: { primary: '#F5A623', secondary: '#FFD700', accent: '#FFFFFF' },
  Void: { primary: '#7928CA', secondary: '#FF0080', accent: '#000000' },
  Mechanical: { primary: '#A0AEC0', secondary: '#4A5568', accent: '#E2E8F0' },
  Mythic: { primary: '#E2B340', secondary: '#E60067', accent: '#00E5FF' }
};

const MARKINGS = ['circuit glyphs', 'runic flames', 'constellation stars', 'tribal stripes', 'crystalline scales', 'void fissures'];
const SILHOUETTES = ['compact quad', 'sleek avian', 'mystical serpentine', 'sturdy bipedal', 'floating wisp'];
const TEMPERAMENTS = ['Ferocious Shipper', 'Curious Architect', 'Stoic Maintainer', 'Playful Innovator', 'Vigilant Guardian'];
const ARCHETYPES = ['Code Weaver', 'Systems Sentinel', 'Frontend Artisan', 'Infrastructure Sage', 'Algorithmic Sorcerer'];

export async function hashToSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function rollRarityTier(roll: number): RarityTier {
  // roll is 0 to 999
  if (roll >= 990) return 'Mythic';     // 1%
  if (roll >= 950) return 'Legendary';  // 4%
  if (roll >= 850) return 'Epic';       // 10%
  if (roll >= 600) return 'Rare';       // 25%
  return 'Common';                      // 60%
}

export async function deriveGuardianDNA(
  githubUserId: number,
  fallbackUsername?: string,
  topLanguages: string[] = []
): Promise<GuardianDNA> {
  const seedString = `githoot:dna:v1:${githubUserId || fallbackUsername || 'anon'}`;
  const sha256 = await hashToSha256(seedString);

  // Extract numbers from hex hash
  const archetypeSeed = parseInt(sha256.slice(0, 4), 16);
  const raritySeed = parseInt(sha256.slice(4, 8), 16) % 1000;
  const markingSeed = parseInt(sha256.slice(8, 12), 16);
  const silhouetteSeed = parseInt(sha256.slice(12, 16), 16);
  const temperamentSeed = parseInt(sha256.slice(16, 20), 16);
  const archetypeIdxSeed = parseInt(sha256.slice(20, 24), 16);

  // Map top languages to element if prominent, otherwise use archetypeSeed
  let archetype = EGG_ARCHETYPES[archetypeSeed % EGG_ARCHETYPES.length];
  if (topLanguages.length > 0) {
    const lang = topLanguages[0].toLowerCase();
    if (lang === 'rust' || lang === 'go' || lang === 'c++') archetype = EGG_ARCHETYPES[0]; // Fire
    else if (lang === 'typescript' || lang === 'javascript') archetype = EGG_ARCHETYPES[1]; // Cyber
    else if (lang === 'python' || lang === 'r' || lang === 'julia') archetype = EGG_ARCHETYPES[2]; // Water
    else if (lang === 'html' || lang === 'css' || lang === 'vue' || lang === 'svelte') archetype = EGG_ARCHETYPES[4]; // Light
  }

  const rarity_tier = rollRarityTier(raritySeed);
  const palette = PALETTES_BY_ELEMENT[archetype.element] || PALETTES_BY_ELEMENT.Cyber;

  return {
    github_user_id: githubUserId,
    dna_seed: sha256,
    egg_archetype_id: archetype.id,
    species: archetype.species,
    element: archetype.element,
    rarity_tier,
    palette,
    markings: MARKINGS[markingSeed % MARKINGS.length],
    silhouette: SILHOUETTES[silhouetteSeed % SILHOUETTES.length],
    temperament: TEMPERAMENTS[temperamentSeed % TEMPERAMENTS.length],
    archetype: ARCHETYPES[archetypeIdxSeed % ARCHETYPES.length]
  };
}
