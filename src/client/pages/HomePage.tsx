// ============================================================================
// GitHoot Redesigned Marketing Homepage (src/client/pages/HomePage.tsx)
// Implements 8-section Cyber-Arcade layout per the accepted contract.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import type { EarlyAccessStatus, PublicConfig } from '../../server/types';
import { EGG_MANIFEST, type EggArchetype } from '../assets/eggs/manifest';
import { track } from '../lib/analytics';

export interface HomePageProps {
  quota?: EarlyAccessStatus | null;
  quotaLoading?: boolean;
  config?: PublicConfig | null;
  configLoading?: boolean;
  configError?: boolean;
  onRouteChange: (route: string) => void;
}

const POSES = [
  '01 · hover', '02 · dive_start', '03 · dive_steep', '04 · plunge',
  '05 · approach', '06 · pre_impact', '07 · three_point_landing', '08 · impact_crouch',
  '09 · shockwave', '10 · recoil', '11 · rise_knee', '12 · rise_aura',
  '13 · stand_up', '14 · aura_flare', '15 · settle', '16 · hero_stance'
];

export const HomePage: React.FC<HomePageProps> = ({
  quota,
  quotaLoading,
  config,
  configLoading,
  configError,
  onRouteChange
}) => {
  const [heroUsername, setHeroUsername] = useState('octocat');
  const [activeArchetype, setActiveArchetype] = useState<EggArchetype>(EGG_MANIFEST['neon-byte']!);
  const [activeFrame, setActiveFrame] = useState(16);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSlowmo, setIsSlowmo] = useState(false);
  const [isStripLoaded, setIsStripLoaded] = useState(false);
  const [wobbleState, setWobbleState] = useState<'idle' | 'wobble'>('idle');

  const demoSectionRef = useRef<HTMLElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const animTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      clearTimeout(animTimerRef.current as number);
    };
  }, []);
  // 1. Landing viewed analytics
  useEffect(() => {
    track('landing_viewed', {
      viewport_bucket: typeof window !== 'undefined' && window.innerWidth <= 640 ? 'mobile' : typeof window !== 'undefined' && window.innerWidth <= 900 ? 'tablet' : 'desktop',
      reduced_motion: typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
    });
  }, []);

  // 2. Lazy load 286 KB demo strip on intersection (first viewport gets exactly 1 image)
  useEffect(() => {
    if (!demoSectionRef.current) return;
    if (!('IntersectionObserver' in window)) {
      setIsStripLoaded(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isStripLoaded) {
          setIsStripLoaded(true);
          observer.disconnect();
        }
      });
    }, { rootMargin: '0px' });

    observer.observe(demoSectionRef.current);
    return () => observer.disconnect();
  }, [isStripLoaded]);

  const handleLookupSubmit = (e: React.FormEvent, rawUsername: string, source: 'hero' | 'early_access' = 'hero') => {
    e.preventDefault();
    const clean = rawUsername.trim().replace(/^@/, '');
    if (clean) {
      track('profile_lookup_submitted', {
        cta_source: source,
        input_length: clean.length
      });
      window.location.pathname = `/${encodeURIComponent(clean)}`;
    }
  };

  const selectDevChip = (username: string) => {
    setHeroUsername(username);
    track('profile_lookup_submitted', {
      cta_source: 'example_link',
      input_length: username.length
    });
    window.location.pathname = `/${encodeURIComponent(username)}`;
  };

  const isReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const playSequence = (speed: 'normal' | 'slow') => {
    if (!isStripLoaded) setIsStripLoaded(true);
    clearTimeout(animTimerRef.current as number);

    // If reduced motion is requested, lock cleanly onto Frame 16 (Hero Stance)
    if (isReducedMotion()) {
      setIsPlaying(false);
      setIsSlowmo(false);
      setActiveFrame(16);
      return;
    }

    // Reset animation state momentarily so same-speed replay triggers a clean restart
    setIsPlaying(false);
    void playerRef.current?.offsetWidth;

    setIsPlaying(true);
    setIsSlowmo(speed === 'slow');

    track('demo_interacted', {
      control: speed === 'slow' ? 'slowmo' : 'play',
      frame_index: 1
    });

    const duration = speed === 'slow' ? 4400 : 1100;
    animTimerRef.current = window.setTimeout(() => {
      setIsPlaying(false);
      setActiveFrame(16);
    }, duration);
  };
  const pauseSequence = () => {
    clearTimeout(animTimerRef.current as number);
    setIsPlaying(false);
    setIsSlowmo(false);
    setActiveFrame(16);
    track('demo_interacted', {
      control: 'replay',
      frame_index: 16
    });
  };

  const scrubFrame = (frame: number) => {
    clearTimeout(animTimerRef.current as number);
    setIsPlaying(false);
    setIsSlowmo(false);
    setActiveFrame(frame);
    track('demo_interacted', {
      control: 'scrub',
      frame_index: frame
    });
  };

   const triggerEggWobble = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
     setWobbleState('wobble');
     setTimeout(() => setWobbleState('idle'), 300);
   };

  const handleArchetypeClick = (arch: EggArchetype) => {
    setActiveArchetype(arch);
    track('archetype_selected', {
      archetype_id: arch.id,
      element: arch.element
    });
  };

  const scrollToHeroForm = () => {
    const el = document.getElementById('hero-username-input');
    if (el) {
      el.focus();
      const behavior = isReducedMotion() ? 'auto' : 'smooth';
      window.scrollTo({ top: 0, behavior });
    }
  };

  const archetypesList = Object.values(EGG_MANIFEST);

  return (
    <div className="homepage-root">

      {/* S1: HERO */}
      <section className="hero-section">
        <div className="githoot-container">
          
          <div className="eyebrow">
            <span>✦</span>
            <span>PRE-LAUNCH · 100 FREE EARLY ACCESS SLOTS</span>
            <span>✦</span>
          </div>

          <h1 className="hero-h1">
            Your GitHub profile hatches a <br />
            <span className="gradient-text">Living Fantasy Guardian</span>
          </h1>

          {/* URL Morph */}
          <div className="url-morph-container">
            <span className="url-from">github.com/{heroUsername || 'octocat'}</span>
            <span className="url-arrow">➔</span>
            <span className="url-to">githoot.com/{heroUsername || 'octocat'}</span>
          </div>

          <p className="hero-subhead">
            Change one word in any GitHub URL and that developer's identity becomes a persistent fantasy Guardian — hatched from an AI-crafted egg, derived from their account, theirs permanently. One GitHub account, one Guardian, no rerolls.
          </p>

          {/* Visual Pair: Pure CSS Egg ➔ Poster Still */}
          <div className="hero-visual-pair">
            <div className="hero-egg-box">
              <button
                type="button"
                className="pure-css-egg"
                aria-label="Interactive egg simulator, click to wobble"
                onClick={triggerEggWobble}
                style={{
                  '--egg-primary': activeArchetype.color.primary,
                  '--egg-glow': activeArchetype.color.glow,
                  transform: wobbleState === 'wobble' ? 'scale(1.1) rotate(10deg)' : 'scale(1) rotate(0deg)'
                } as React.CSSProperties}
              >
                <div className="crack" />
              </button>
              <span className="visual-label">{activeArchetype.name} (CSS)</span>
            </div>

            <div className="hero-visual-arrow">➔</div>

            <div className="hero-guardian-box">
              <img
                src="/assets/sample-pets/neonbyte-poster.webp"
                alt="Aether Neon Byte Hero Still"
                className="hero-poster-img"
                width="110"
                height="110"
                decoding="async"
              />
              <span className="visual-label">Aether Neon Byte</span>
            </div>
          </div>

          {/* Hero Form */}
          <form className="hero-form" onSubmit={(e) => handleLookupSubmit(e, heroUsername, 'hero')}>
            <label htmlFor="hero-username-input" className="sr-only">GitHub username</label>
            <div className="hero-prefix">githoot.com/</div>
            <input
              type="text"
              id="hero-username-input"
              className="hero-input"
              placeholder="octocat"
              value={heroUsername}
              onChange={(e) => setHeroUsername(e.target.value)}
              aria-label="GitHub username to preview"
              autoComplete="off"
              spellCheck="false"
            />
            <button type="submit" className="hero-btn">
              Preview
            </button>
          </form>

          <p className="hero-helper">
            Free, no sign-in, nothing generated yet — you'll see the egg this profile would hatch.
          </p>

          {/* Quick-try Chips */}
          <div className="hero-chips">
            <span>Try one:</span>
            <button type="button" className="chip-link" onClick={() => selectDevChip('octocat')}>@octocat</button>
            <button type="button" className="chip-link" onClick={() => selectDevChip('torvalds')}>@torvalds</button>
            <button type="button" className="chip-link" onClick={() => selectDevChip('yyx990803')}>@yyx990803</button>
            <button type="button" className="chip-link" onClick={() => selectDevChip('antirez')}>@antirez</button>
            <button type="button" className="chip-link" onClick={() => selectDevChip('rich-harris')}>@rich-harris</button>
          </div>

        </div>
      </section>

      {/* S2: SIGNATURE SEQUENCE DEMO */}
      <section className="demo-section" id="demo-section" ref={demoSectionRef}>
        <div className="githoot-container">
          <div className="section-head">
            <div className="eyebrow magenta">
              <span>✦</span>
              <span>SIGNATURE SEQUENCE</span>
              <span>✦</span>
            </div>
            <h2 className="section-title">Watch a Guardian make landfall.</h2>
            <p className="section-desc">
              Sixteen frames, hover to hero stance. Aether Neon Byte comes down through the atmosphere, plants a three-point landing, and rises. Scrub it, slow it down, and look at every pose.
            </p>
          </div>

          <div className="demo-stage">
            <div className="sprite-viewport">
              <div
                ref={playerRef}
                className={`landing16-player ${isPlaying ? (isSlowmo ? 'slowmo' : 'playing') : ''}`}
                style={{
                  backgroundImage: isStripLoaded ? 'url(/assets/sample-pets/neonbyte-landing16-strip.webp)' : 'none',
                  backgroundPosition: isPlaying ? undefined : `${-((activeFrame - 1) * 256)}px 0px`
                }}
              />
            </div>

            <div className="scrubber-container">
              <label htmlFor="frame-scrubber" className="sr-only">Superhero landing animation frame scrubber</label>
              <input
                type="range"
                min="1"
                max="16"
                id="frame-scrubber"
                className="scrubber-slider"
                value={activeFrame}
                onChange={(e) => scrubFrame(parseInt(e.target.value, 10))}
                aria-label="Superhero landing animation frame scrubber"
              />
              <div className="pose-name-tag">
                {POSES[activeFrame - 1]}
              </div>
            </div>

            <div className="demo-controls">
              <button
                type="button"
                id="btn-play"
                className={`control-btn ${isPlaying && !isSlowmo ? 'active' : ''}`}
                onClick={() => playSequence('normal')}
              >
                Play (1.1s)
              </button>
              <button
                type="button"
                id="btn-slow"
                className={`control-btn ${isPlaying && isSlowmo ? 'active' : ''}`}
                onClick={() => playSequence('slow')}
              >
                Slow-mo (4.4s)
              </button>
              <button
                type="button"
                id="btn-pause"
                className="control-btn"
                onClick={pauseSequence}
              >
                Reset (Hero Stance)
              </button>
            </div>

            <button
              type="button"
              className="chip-link"
              style={{ marginTop: '14px', border: '1px solid var(--accent-cyan)' }}
              onClick={scrollToHeroForm}
            >
              Preview your own profile ↑
            </button>

            <p className="demo-caption" style={{ marginTop: '10px' }}>Pre-generated sample — not your Guardian.</p>
          </div>
        </div>
      </section>

      {/* S3: HOW IT WORKS */}
      <section>
        <div className="githoot-container">
          <div className="section-head">
            <div className="eyebrow">
              <span>✦</span>
              <span>HOW IT WORKS</span>
              <span>✦</span>
            </div>
            <h2 className="section-title">How the hatch works.</h2>
            <p className="section-desc">
              Four transparent steps from public GitHub username to living companion.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">01</div>
              <h3 className="step-title">We look up the profile.</h3>
              <p className="step-desc">Your public GitHub profile resolves from an edge cache with a rotating token pool behind it, so lookups keep working when the GitHub API is throttled.</p>
            </div>

            <div className="step-card">
              <div className="step-num">02</div>
              <h3 className="step-title">You claim it with GitHub.</h3>
              <p className="step-desc">Sign in once to prove the account is yours. That reserves one Early Access slot and locks your Guardian to your GitHub numeric account id.</p>
            </div>

            <div className="step-card">
              <div className="step-num">03</div>
              <h3 className="step-title">Gemini crafts the sprite matrix.</h3>
              <p className="step-desc">One hero portrait plus a 4x2 pose matrix — idle, happy, sleepy, proud, angry, work, celebrate — contour-sliced, green background removed, stored on object storage.</p>
            </div>

            <div className="step-card">
              <div className="step-num">04</div>
              <h3 className="step-title">The egg cracks open.</h3>
              <p className="step-desc">A Gacha reveal, an animated Open Graph card, and an SVG badge you can drop into your README — one click to share on X or LinkedIn.</p>
            </div>
          </div>

          <div className="determinism-box">
            <div className="determinism-icon">🔒</div>
            <div>
              <h3 className="determinism-title">Your Guardian is derived, not rolled.</h3>
              <p className="determinism-desc">
                Archetype, rarity, markings, silhouette and temperament all come from a SHA-256 hash of your GitHub account id. Same account, same Guardian, every time. There is no reroll button, and there never will be.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* S4: EIGHT ELEMENTS & ODDS */}
      <section>
        <div className="githoot-container">
          <div className="section-head">
            <div className="eyebrow amber">
              <span>✦</span>
              <span>EIGHT ELEMENTS</span>
              <span>✦</span>
            </div>
            <h2 className="section-title">An element for every stack.</h2>
            <p className="section-desc">
              Fire for Rust and Go, cyber for TypeScript and the web, water for Python and AI, and five more. Eight archetypes, drawn entirely in pure CSS.
            </p>
          </div>

          <div className="archetype-layout">
            {/* Active Archetype Showcase */}
            <div className="archetype-preview-card">
              <div
                className="pure-css-egg"
                style={{
                  '--egg-primary': activeArchetype.color.primary,
                  '--egg-glow': activeArchetype.color.glow,
                  width: '110px',
                  height: '145px'
                } as React.CSSProperties}
              >
                <div className="crack" />
              </div>
              <div style={{ marginTop: '20px' }}>
                <div className="mono" style={{ fontSize: '11px', fontWeight: 800, color: activeArchetype.color.primary }}>
                  {activeArchetype.element.toUpperCase()}
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 8px' }}>
                  {activeArchetype.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {activeArchetype.description}
                </p>
              </div>
            </div>

            {/* Archetypes Selector Grid */}
            <div className="archetypes-grid" role="tablist" aria-label="Guardian archetype selection">
              {archetypesList.map((arch) => (
                <button
                  key={arch.id}
                  type="button"
                  role="tab"
                  aria-selected={activeArchetype.id === arch.id}
                  aria-label={`${arch.name} — ${arch.element}`}
                  className={`arch-card ${activeArchetype.id === arch.id ? 'active' : ''}`}
                  style={{
                    '--card-color': arch.color.primary,
                    '--card-glow': arch.color.glow
                  } as React.CSSProperties}
                  onClick={() => handleArchetypeClick(arch)}
                >
                  <span className="arch-element">{arch.element}</span>
                  <span className="arch-name">{arch.name}</span>
                  <span className="arch-desc">{arch.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Published Odds */}
          <div className="odds-block">
            <div className="odds-title">
              <span>Published odds, stated up front.</span>
              <span className="eyebrow" style={{ marginBottom: 0 }}>Fixed Genesis Distribution</span>
            </div>
            <div className="odds-grid">
              <div className="odds-card">
                <div className="odds-pct" style={{ color: 'var(--accent-green)' }}>60%</div>
                <div className="odds-name">Common</div>
              </div>
              <div className="odds-card">
                <div className="odds-pct" style={{ color: 'var(--accent-cyan)' }}>25%</div>
                <div className="odds-name">Rare</div>
              </div>
              <div className="odds-card">
                <div className="odds-pct" style={{ color: '#7928CA' }}>10%</div>
                <div className="odds-name">Epic</div>
              </div>
              <div className="odds-card">
                <div className="odds-pct" style={{ color: 'var(--accent-magenta)' }}>4%</div>
                <div className="odds-name">Legendary</div>
              </div>
              <div className="odds-card">
                <div className="odds-pct" style={{ color: '#E2B340' }}>1%</div>
                <div className="odds-name">Mythic</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* S5: LAUNCH STATUS (TRUST) */}
      <section>
        <div className="githoot-container">
          <div className="section-head">
            <div className="eyebrow green">
              <span>✦</span>
              <span>LAUNCH STATUS</span>
              <span>✦</span>
            </div>
            <h2 className="section-title">Where GitHoot actually stands today.</h2>
            <p className="section-desc">
              GitHoot has not launched. Nobody has hatched a Guardian yet, and we are not going to print invented numbers to make this page look busier than the product is. Here is every number we can honestly show.
            </p>
          </div>

          <div className="table-wrapper">
            <table className="trust-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Status at Launch</th>
                  <th>Data Source & Semantics</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Early Access Slots</td>
                  <td>
                    {quotaLoading ? (
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Checking D1...</span>
                    ) : quota && !quota.degraded && quota.remaining !== null && quota.claimed !== null ? (
                      <>
                        <span className="trust-val">{quota.remaining} / {quota.total} Free</span>{' '}
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({quota.claimed} slots claimed · live early_access_slots)</span>
                      </>
                    ) : (
                      <span className="trust-badge" style={{ color: 'var(--accent-amber)' }}>Early Access status unavailable (Database degraded)</span>
                    )}
                  </td>
                  <td>D1 Database query (<code>early_access_slots</code>). Claimed slots only.</td>
                </tr>
                <tr>
                  <td>Guardians Hatched</td>
                  <td><span className="trust-badge">Guardians hatched — none yet. This page will show a live count the day the first one is claimed.</span></td>
                  <td>Will reflect live completed Gacha reveals once claimed.</td>
                </tr>
                <tr>
                  <td>Developers with Guardian</td>
                  <td><span className="trust-badge">Developers claimed — none yet.</span></td>
                  <td>Unique GitHub accounts with claimed guardians in D1.</td>
                </tr>
                <tr>
                  <td>Page Visits</td>
                  <td>
                    {configLoading ? (
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Checking telemetry...</span>
                    ) : configError ? (
                      <span className="trust-badge" style={{ color: 'var(--accent-amber)' }}>Telemetry status unavailable</span>
                    ) : config?.posthog_configured ? (
                      <span className="trust-val" style={{ color: 'var(--accent-green)' }}>PostHog telemetry active (Zero-cookie proxy)</span>
                    ) : (
                      <span className="trust-badge">Visits — not measured yet. We have no analytics key configured, so we are not counting.</span>
                    )}
                  </td>
                  <td>No analytics tracking key configured. Zero tracking cookies.</td>
                </tr>
                <tr>
                  <td>Edge Profile Latency</td>
                  <td><span className="trust-val">Design target: &lt; 150ms P95 profile resolve</span> <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(docs/prd.md)</span></td>
                  <td>Cloudflare Workers + KV Cache SWR architecture goal.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* S6: CREATOR */}
      <section>
        <div className="githoot-container">
          <div className="creator-card">
            <img
              src="/assets/sample-pets/zuey-avatar-96.webp"
              alt="Zuey Avatar"
              className="creator-avatar"
              width="96"
              height="96"
              loading="lazy"
              decoding="async"
            />
            <div>
              <div className="eyebrow" style={{ marginBottom: '8px' }}>CREATOR</div>
              <h3 className="creator-name">Zuey</h3>
              <div className="creator-handle">@goon_nguyen</div>
              <blockquote className="creator-quote">
                "I wanted the thing developers already share — their GitHub profile — to be worth looking at twice. A Guardian you didn't choose, that came out of your own account and stays yours, is a better souvenir than a follower count."
              </blockquote>
              <p className="creator-byline">
                From the creator of <a href="https://agentkit.best" target="_blank" rel="noopener noreferrer" onClick={() => track('creator_link_clicked', { destination: 'agentkit' })} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700 }}>AgentKit.best</a>, <a href="https://nextlevelbuilder.io" target="_blank" rel="noopener noreferrer" onClick={() => track('creator_link_clicked', { destination: 'nextlevelbuilder' })} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700 }}>NextLevelBuilder.io</a>, <a href="https://goclaw.sh" target="_blank" rel="noopener noreferrer" onClick={() => track('creator_link_clicked', { destination: 'goclaw' })} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700 }}>GoClaw.sh</a> & <a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill" target="_blank" rel="noopener noreferrer" onClick={() => track('creator_link_clicked', { destination: 'ui_ux_pro_max' })} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 700 }}>UI UX Pro Max Skill</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* S7: EARLY ACCESS (100-SLOT DOT MATRIX) */}
      <section>
        <div className="githoot-container">
          <div className="early-access-card">
            <div className="eyebrow amber">
              <span>✦</span>
              <span>EARLY ACCESS</span>
              <span>✦</span>
            </div>
            <p className="section-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              One hundred free slots, one per GitHub account. After slot 100, a hatch costs ${config?.charge_after_usd ?? '0.99'} — that covers the Gemini model call, nothing more. We would rather tell you the price now than surprise you at the reveal.
            </p>

            {/* 10x10 Dot Matrix, Loading, or Degraded State */}
            {quotaLoading ? (
              <div style={{
                padding: '24px 16px',
                background: 'rgba(0, 240, 255, 0.04)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                borderRadius: '12px',
                color: 'var(--text-secondary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                margin: '28px auto',
                maxWidth: '420px'
              }}>
                ✦ Synchronizing Genesis cohort ledger with D1...
              </div>
            ) : !quota || quota.degraded || quota.claimed === null ? (
              <div style={{
                padding: '24px 16px',
                background: 'rgba(255, 168, 0, 0.08)',
                border: '1px solid rgba(255, 168, 0, 0.3)',
                borderRadius: '12px',
                color: '#ffa800',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                margin: '28px auto',
                maxWidth: '420px'
              }}>
                ⚠️ Slot count unavailable — the database did not answer
              </div>
            ) : (
              <div className="dot-matrix">
                {Array.from({ length: 100 }, (_, i) => {
                  const isClaimed = i < quota.claimed!;
                  return (
                    <div
                      key={i}
                      className={`slot-dot ${isClaimed ? 'claimed' : ''}`}
                      title={`Genesis Slot #${i + 1} (${isClaimed ? 'Claimed' : 'Available'})`}
                    />
                  );
                })}
              </div>
            )}

            <form className="hero-form" onSubmit={(e) => handleLookupSubmit(e, heroUsername, 'early_access')}>
              <label htmlFor="ea-username-input" className="sr-only">GitHub username for Early Access</label>
              <div className="hero-prefix">githoot.com/</div>
              <input
                type="text"
                id="ea-username-input"
                className="hero-input"
                placeholder="octocat"
                value={heroUsername}
                onChange={(e) => setHeroUsername(e.target.value)}
                aria-label="GitHub username for Early Access"
              />
              <button type="submit" className="hero-btn">
                Preview
              </button>
            </form>

            <p className="hero-helper" style={{ marginBottom: 0 }}>
              Previewing is always free and never signs you in.
            </p>
          </div>
        </div>
      </section>

      {/* S8: ROADMAP */}
      <section>
        <div className="githoot-container">
          <div className="section-head">
            <div className="eyebrow">
              <span>✦</span>
              <span>ROADMAP</span>
              <span>✦</span>
            </div>
            <h2 className="section-title">After the hatch.</h2>
            <p className="section-desc">
              Not in the first release — but this is the long-term direction of the companion network.
            </p>
          </div>

          <div className="roadmap-grid">
            <div className="roadmap-card">
              <div className="roadmap-tag">Phase 9 · Narrative Vision</div>
              <h3 className="roadmap-title">Evolution & Legacy Forms</h3>
              <p className="roadmap-desc">Guardians that evolve alongside commit milestones and project longevity, leaving behind immutable legacy badges.</p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-tag">Phase 10 · Narrative Vision</div>
              <h3 className="roadmap-title">Discovery Arena</h3>
              <p className="roadmap-desc">A deterministic auto-battler and social spotlighting surface where developers discover each other through companion encounters.</p>
            </div>

            <div className="roadmap-card">
              <div className="roadmap-tag">Phase 11 · Narrative Vision</div>
              <h3 className="roadmap-title">Creator Ecosystem</h3>
              <p className="roadmap-desc">Community organizations and artists designing seasonal companion archetypes and verified repository raids.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
