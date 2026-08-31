// ============================================================================
// GitHoot Deterministic DNA & Egg Seeder (src/server/services/dna/seed.ts)
// ============================================================================

import type { GuardianDNA, RarityTier } from '../../types';
import { compileIdentitySpec } from './compiler';
import { sha256Hex } from '../crypto/web-crypto';
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
  Metal: { primary: '#A0AEC0', secondary: '#4A5568', accent: '#E2E8F0' },
  Cosmic: { primary: '#E2B340', secondary: '#E60067', accent: '#00E5FF' },
  Mythic: { primary: '#E2B340', secondary: '#E60067', accent: '#00E5FF' }
};

export const hashToSha256 = sha256Hex;

export function rollRarityTier(roll: number): RarityTier {
  if (roll >= 990) return 'Mythic';
  if (roll >= 950) return 'Legendary';
  if (roll >= 850) return 'Epic';
  if (roll >= 600) return 'Rare';
  return 'Common';
}

export async function deriveGuardianDNA(
  githubUserId: number,
  fallbackUsername?: string,
  topLanguages: string[] = []
): Promise<GuardianDNA> {
  const spec = await compileIdentitySpec({
    githubUserId: githubUserId || fallbackUsername || '0',
    telemetry: {
      topLanguages,
      provenance: {
        topLanguages: topLanguages.length > 0 ? 'measured' : 'unavailable'
      }
    }
  });
  const palette = PALETTES_BY_ELEMENT[spec.element] || PALETTES_BY_ELEMENT.Cyber;

  return {
    github_user_id: githubUserId,
    dna_seed: spec.dnaSeed,
    egg_archetype_id: `${spec.species}-core`,
    species: spec.species,
    species_name: spec.speciesName,
    anatomy: spec.anatomy,
    element: spec.element,
    rarity_tier: spec.rarity,
    palette,
    markings: spec.markings,
    silhouette: spec.silhouette,
    temperament: spec.temperament,
    archetype: spec.temperament,
    identity_spec: spec
  };
}
