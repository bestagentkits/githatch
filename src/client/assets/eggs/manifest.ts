// ============================================================================
// GitHoot Egg Archetypes & Gemini Companion Manifest (src/client/assets/eggs/manifest.ts)
// ============================================================================

export interface EggAnimationConfig {
  start: number;
  count: number;
  fps: number;
  loop: boolean;
}

export interface EggArchetype {
  id: string;
  name: string;
  element: string;
  species: string;
  description: string;
  companionImageUrl: string;
  color: {
    primary: string;
    glow: string;
    particle: string;
  };
  frameWidth: number;
  frameHeight: number;
  spritesheetPath: string;
  animations: {
    idle: EggAnimationConfig;
    wobble: EggAnimationConfig;
    crack: EggAnimationConfig;
    hatch: EggAnimationConfig;
  };
}

export const EGG_MANIFEST: Record<string, EggArchetype> = {
  'ember-core': {
    id: 'ember-core',
    name: 'Ember Core Egg',
    species: 'Ignis Emberfox',
    element: 'Fire / Rust & Go',
    description: 'Forged in high-performance Rust and Go compiler flames.',
    companionImageUrl: '/assets/sample-pets/emberfox.jpg',
    color: { primary: '#FF4500', glow: 'rgba(255, 69, 0, 0.45)', particle: '#FFA500' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/ember-core/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'neon-byte': {
    id: 'neon-byte',
    name: 'Neon Byte Egg',
    species: 'Aether Neon Byte',
    element: 'Cyber / TypeScript & Web',
    description: 'Pulsing with holographic TypeScript and React frontend energy.',
    companionImageUrl: '/assets/sample-pets/neonbyte.jpg',
    color: { primary: '#00F0FF', glow: 'rgba(0, 240, 255, 0.45)', particle: '#FF2A85' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/neon-byte/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'abyssal-pearl': {
    id: 'abyssal-pearl',
    name: 'Abyssal Pearl Egg',
    species: 'Nox Abyssal Pearl',
    element: 'Water / Python & AI',
    description: 'Infused with deep learning neural networks and Python data pipelines.',
    companionImageUrl: '/assets/sample-pets/abyssal.jpg',
    color: { primary: '#0070F3', glow: 'rgba(0, 112, 243, 0.45)', particle: '#00DFD8' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/abyssal-pearl/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'verdant-spore': {
    id: 'verdant-spore',
    name: 'Verdant Spore Egg',
    species: 'Sylvan Verdant Golem',
    element: 'Nature / Open Source',
    description: 'Rooted in enduring open-source maintenance and community care.',
    companionImageUrl: '/assets/sample-pets/verdant.jpg',
    color: { primary: '#00DF71', glow: 'rgba(0, 223, 113, 0.45)', particle: '#50E3C2' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/verdant-spore/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'solar-flare': {
    id: 'solar-flare',
    name: 'Solar Flare Egg',
    species: 'Helios Solar Griffin',
    element: 'Light / High-Velocity Shipper',
    description: 'Blazing with high-velocity product shipping and bold execution.',
    companionImageUrl: '/assets/sample-pets/solargriffin.jpg',
    color: { primary: '#F5A623', glow: 'rgba(245, 166, 35, 0.45)', particle: '#FFD700' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/solar-flare/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'void-shard': {
    id: 'void-shard',
    name: 'Void Shard Egg',
    species: 'Astral Void Stalker',
    element: 'Void / Security & DevOps',
    description: 'Shrouded in mysterious kernel architecture and security exploits.',
    companionImageUrl: '/assets/sample-pets/voidstalker.jpg',
    color: { primary: '#7928CA', glow: 'rgba(121, 40, 202, 0.45)', particle: '#FF0080' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/void-shard/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'rust-dynamo': {
    id: 'rust-dynamo',
    name: 'Rust Dynamo Egg',
    species: 'Ferrum Rust Golem',
    element: 'Mechanical / Low-level C/C++',
    description: 'Armored in zero-cost abstractions and memory-safe mechanisms.',
    companionImageUrl: '/assets/sample-pets/rustgolem.jpg',
    color: { primary: '#A0AEC0', glow: 'rgba(160, 174, 192, 0.45)', particle: '#E2E8F0' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/rust-dynamo/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  },
  'celestial-echo': {
    id: 'celestial-echo',
    name: 'Celestial Echo Egg',
    species: 'Zenith Celestial Drake',
    element: 'Mythic / Polyglot 10x Engineer',
    description: 'Radiating rare polyglot mastery across every domain layer.',
    companionImageUrl: '/assets/sample-pets/celestialdrake.jpg',
    color: { primary: '#E2B340', glow: 'rgba(226, 179, 64, 0.45)', particle: '#00E5FF' },
    frameWidth: 256,
    frameHeight: 256,
    spritesheetPath: '/eggs/celestial-echo/spritesheet.webp',
    animations: {
      idle: { start: 0, count: 6, fps: 8, loop: true },
      wobble: { start: 6, count: 8, fps: 16, loop: false },
      crack: { start: 14, count: 10, fps: 12, loop: false },
      hatch: { start: 24, count: 16, fps: 20, loop: false }
    }
  }
};

export function getEggArchetype(id: string): EggArchetype {
  return EGG_MANIFEST[id] || EGG_MANIFEST['neon-byte']!;
}
