# Phase 2: Core Homepage & Stylesheet

## Context
Implement the 8-section layout from the accepted contract into `src/client/pages/HomePage.tsx` and enhance `src/client/styles/responsive.css` with Option 1 Cyber-Arcade tokens, animations, and responsive utilities.

## Sections to Implement in `HomePage.tsx`
- **S1 — Hero (The Swap):**
  - Eyebrow: `PRE-LAUNCH · 100 FREE EARLY ACCESS SLOTS`
  - H1: `Your GitHub profile hatches a Living Fantasy Guardian` (Gradient text)
  - Live CSS URL Morph: `github.com/{target} ➔ githoot.com/{target}`
  - Visual 50/50 Pair: Pure CSS Egg (0 bytes) ➔ `neonbyte-poster.webp` (37.8 KB)
  - Accessible Hero Form: `githoot.com/` prefix, `<label for="...">`, `aria-label`, `Preview` submit button
  - Quick-try dev chips: `@octocat`, `@torvalds`, `@yyx990803`, `@antirez`, `@rich-harris`
- **S2 — Signature Sequence Demo (16 Pose):**
  - CSS `steps(15)` 1.1s player holding on frame 16 (`hero_stance`)
  - Controls: `Play (1.1s)`, `Slow-mo (4.4s)`, `Reset`
  - Frame scrubber slider (1-16) updating active pose name
  - Lazy `IntersectionObserver` background loading (`rootMargin: '200px'`)
- **S3 — How It Works:**
  - 4-step cyber grid (Look up profile, Claim with GitHub, Gemini sprite matrix, Egg cracks open)
  - Determinism callout card (SHA-256 seed guarantee)
- **S4 — Eight Elements & Published Odds:**
  - Semantic `<button role="tab">` archetype selector grid with live CSS egg preview
  - Published Odds block (Common 60%, Rare 25%, Epic 10%, Legendary 4%, Mythic 1%)
- **S5 — Launch Status (Trust):**
  - Transparent table: Early Access slots (live/degraded), Guardians hatched (0), Devs (0), Visits (Not measured yet), Latency target (<150ms)
- **S6 — Creator Attribution:**
  - Zuey card with 96x96 local WebP avatar (`loading="lazy"`), quote, byline, and AgentKit link
- **S7 — Early Access Genesis Cohort:**
  - 10x10 Genesis dot matrix (100 dots)
  - $0.99 pricing disclosure after slot 100
  - Lookup form
- **S8 — Roadmap:**
  - 3 future vision cards (Evolution, Arena, Creator Ecosystem) tagged `Not in the first release`

## Files to Modify
- `src/client/pages/HomePage.tsx`
- `src/client/styles/responsive.css`

## Validation
- `npm run typecheck` passes.
- `npm run build` succeeds.
- Browser test shows all 8 sections render properly in Cyber-Arcade styling.
