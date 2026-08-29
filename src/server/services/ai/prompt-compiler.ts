// ============================================================================
// GitHoot Multi-Pose Prompt Matrix Compiler (src/server/services/ai/prompt-compiler.ts)
// ============================================================================

import type { GuardianDNA } from '../../types';

export function compileNanoBananaPrompt(dna: GuardianDNA): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

  const species = sanitize(dna.species);
  const element = sanitize(dna.element);
  const archetype = sanitize(dna.archetype);
  const markings = sanitize(dna.markings);
  const silhouette = sanitize(dna.silhouette);
  const temperament = sanitize(dna.temperament);

  return `
Professional pixel-perfect fantasy companion sprite sheet, exact 4x2 grid layout (4 columns, 2 rows).
Character: ${species} (${element} elemental ${archetype}), ${silhouette} shape with ${markings}.
Temperament: ${temperament}.
Color scheme: Primary ${dna.palette.primary}, Secondary ${dna.palette.secondary}, Accent ${dna.palette.accent}.
Background: Pure solid chroma green #00FF00 background, crisp sharp borders, high contrast, zero shadows on the green background.

Cell Grid Specifications (Exact 4x2 layout):
- Cell [1,1] (Top Left): Full Hero Portrait, highly detailed 3/4 dynamic hero pose, expressive eyes, majestic lighting.
- Cell [1,2]: Idle pose, relaxed standing posture, neutral friendly expression.
- Cell [1,3]: Happy emotion, joyful smile, sparkling eyes, energetic bounce.
- Cell [1,4]: Sleepy emotion, curling down with floating Zzz particles, serene.
- Cell [2,1]: Proud emotion, chest puffed out, golden aura glow, heroic grin.
- Cell [2,2]: Combat emotion, glowing elemental eyes, determined battle stance.
- Cell [2,3]: Work/Coding action, wearing mini tech glasses, typing on glowing holographic terminal screen.
- Cell [2,4]: Celebrate action, holding a golden star trophy, cheering with confetti.

Style: High quality stylized indie video game character spritesheet, bold clean contours, uniform character model size and proportions across all 8 cells.
`.trim();
}
