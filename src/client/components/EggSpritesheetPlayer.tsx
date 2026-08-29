// ============================================================================
// GitHoot Canvas Egg Spritesheet Player (src/client/components/EggSpritesheetPlayer.tsx)
// ============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getEggArchetype } from '../assets/eggs/manifest';
import { useEggAudio } from '../hooks/useEggAudio';

export interface EggPlayerProps {
  archetypeId: string;
  state?: 'idle' | 'wobble' | 'crack' | 'hatch';
  interactive?: boolean;
  onStateChange?: (state: 'idle' | 'wobble' | 'crack' | 'hatch') => void;
  onHatchComplete?: () => void;
}

export const EggSpritesheetPlayer: React.FC<EggPlayerProps> = ({
  archetypeId,
  state = 'idle',
  interactive = true,
  onStateChange,
  onHatchComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalState, setInternalState] = useState<'idle' | 'wobble' | 'crack' | 'hatch'>(state);
  const [clickCount, setClickCount] = useState(0);
  const { playWobbleSound, playCrackSound, playHatchFanfare } = useEggAudio();

  const archetype = getEggArchetype(archetypeId);

  useEffect(() => {
    setInternalState(state);
  }, [state]);

  const updateState = useCallback((newState: 'idle' | 'wobble' | 'crack' | 'hatch') => {
    setInternalState(newState);
    if (onStateChange) onStateChange(newState);
  }, [onStateChange]);

  const handleClick = useCallback(() => {
    if (!interactive || internalState === 'hatch') return;

    const nextCount = clickCount + 1;
    setClickCount(nextCount);

    if (nextCount < 3) {
      playWobbleSound();
      updateState('wobble');
    } else if (nextCount < 6) {
      playCrackSound();
      updateState('crack');
    } else {
      playHatchFanfare();
      updateState('hatch');
      if (onHatchComplete) {
        setTimeout(onHatchComplete, 1200);
      }
    }
  }, [interactive, internalState, clickCount, playWobbleSound, playCrackSound, playHatchFanfare, updateState, onHatchComplete]);

  // Canvas / CSS Animation rendering
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: interactive ? 'pointer' : 'default',
        padding: '24px'
      }}
      onClick={handleClick}
    >
      <div
        className={`egg-container ${internalState}`}
        style={{
          width: '160px',
          height: '210px',
          background: `radial-gradient(circle at 35% 35%, ${archetype.color.primary}, #050b14 75%)`,
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          boxShadow: `0 0 35px ${archetype.color.glow}, inset 0 0 20px rgba(255,255,255,0.4)`,
          position: 'relative',
          transition: 'transform 0.15s ease-out',
          userSelect: 'none'
        }}
      >
        {/* Glow & Sparkle accents */}
        <div
          style={{
            position: 'absolute',
            inset: '0',
            borderRadius: 'inherit',
            background: `radial-gradient(circle at 70% 70%, ${archetype.color.particle}22 0%, transparent 60%)`
          }}
        />

        {/* Dynamic Cracks Overlay */}
        {(internalState === 'crack' || internalState === 'hatch') && (
          <div
            style={{
              position: 'absolute',
              top: '30%',
              left: '25%',
              width: '50%',
              height: '40%',
              borderTop: `2px solid ${archetype.color.particle}`,
              borderRight: `2px solid ${archetype.color.primary}`,
              filter: 'drop-shadow(0 0 6px #fff)',
              transform: 'rotate(-15deg)',
              animation: 'pulse 0.4s infinite'
            }}
          />
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          fontWeight: 700,
          color: archetype.color.primary,
          textAlign: 'center'
        }}
      >
        ✦ {archetype.name} ✦
      </div>
      {interactive && internalState !== 'hatch' && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '11px',
            color: '#8b9bb4',
            textAlign: 'center'
          }}
        >
          {clickCount === 0 ? 'Click to wobble' : `Tap energy: ${clickCount}/6`}
        </div>
      )}
    </div>
  );
};
