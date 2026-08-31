// ============================================================================
// 16-Pose Compositor Unit Tests (tests/unit/edge-compositor.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateFramePlacement,
  validateCompositorInputs
} from '../../src/server/services/image/landing-compositor';

describe('16-Pose Landing Compositor', () => {
  it('calculates exact 4x4 sheet and horizontal strip coordinates', () => {
    // Frame 0 (first)
    const p0 = calculateFramePlacement(0, 256, 4);
    expect(p0.sheet).toEqual({ left: 0, top: 0 });
    expect(p0.strip).toEqual({ left: 0, top: 0 });

    // Frame 3 (end of row 1)
    const p3 = calculateFramePlacement(3, 256, 4);
    expect(p3.sheet).toEqual({ left: 768, top: 0 });
    expect(p3.strip).toEqual({ left: 768, top: 0 });

    // Frame 4 (start of row 2)
    const p4 = calculateFramePlacement(4, 256, 4);
    expect(p4.sheet).toEqual({ left: 0, top: 256 });
    expect(p4.strip).toEqual({ left: 1024, top: 0 });

    // Frame 15 (last frame)
    const p15 = calculateFramePlacement(15, 256, 4);
    expect(p15.sheet).toEqual({ left: 768, top: 768 });
    expect(p15.strip).toEqual({ left: 3840, top: 0 });
  });

  it('validateCompositorInputs rejects incomplete frame sets', () => {
    const incomplete = new Array(15).fill(new Uint8Array(256 * 256 * 4));
    expect(() => {
      validateCompositorInputs(incomplete, 16);
    }).toThrow(/expected exactly 16 frames/i);
  });

  it('validateCompositorInputs accepts full 16-frame buffers', () => {
    const complete = new Array(16).fill(new Uint8Array(256 * 256 * 4));
    expect(validateCompositorInputs(complete, 16)).toBe(true);
  });
});
