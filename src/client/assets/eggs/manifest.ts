// ============================================================================
// GitHoot Egg Archetypes Manifest (src/client/assets/eggs/manifest.ts)
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
  description: string;
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
    element: 'Fire',
    description: 'Forged in high-performance Rust and Go compiler flames.',
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
    element: 'Cyber',
    description: 'Pulsing with holographic TypeScript and React frontend energy.',
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
    element: 'Water',
    description: 'Infused with deep learning neural networks and Python data pipelines.',
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
    element: 'Nature',
    description: 'Rooted in enduring open-source maintenance and community care.',
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
    element: 'Light',
    description: 'Blazing with high-velocity product shipping and bold execution.',
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
    element: 'Void',
    description: 'Shrouded in mysterious kernel architecture and security exploits.',
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
    element: 'Mechanical',
    description: 'Armored in zero-cost abstractions and memory-safe mechanisms.',
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
    element: 'Mythic',
    description: 'Radiating rare polyglot mastery across every domain layer.',
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
  return EGG_MANIFEST[id] || EGG_MANIFEST['neon-byte'];
}
