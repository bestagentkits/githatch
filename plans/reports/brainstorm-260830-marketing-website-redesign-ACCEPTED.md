---
date: 2026-08-30
skill: ak:brainstorm --advice --ultra
subject: GitHoot marketing website from-scratch redesign
status: ACCEPTED (ultra winner, materialized unchanged)
branch: mrgoonie/Update-marketing-website
candidates: 5 (Opus tier, one parallel wave, identical inline evidence packet)
verifier: kongming (gpt-5.6-sol high)
winner_score: 211/220
next: hand off to the installed plan skill, then /ak:cook --advice
---

# GitHoot Marketing Website Redesign — Accepted Brainstorm Contract

> Selected by the `--ultra` verifier from five independent Opus-tier candidates and
> materialized **unchanged**. Ranking appendix and residual risks are at the end.
> Verifier confidence: high (0.94); margin 211 vs 183 for the runner-up.

---

# 1. Outcome

GitHoot's marketing site is rebuilt from scratch as a single English-language landing page at `/` whose first viewport — at 375x812 and at 1440x900 — states the product in one line, shows the `github.com/octocat` → `githoot.com/octocat` domain swap as a live CSS text morph, shows one recognizable Guardian, and offers exactly one truthful anonymous action: type a GitHub username and preview that profile's egg. The signature spectacle is a single representative 16-pose `neonbyte` landing sequence played from the one measured WebP strip (`assets/sample-pets/neonbyte-landing16-strip.webp`, 286,362 B), loaded only when its section scrolls into view, labelled as pre-generated sample content, and held on a static hero-stance frame under `prefers-reduced-motion: reduce`. Trust is delivered honestly at zero usage: no counters are invented — every number on the page is either structurally true (8 archetypes, 16 poses, 4x2 emotion matrix, 5 rarity tiers, published 60/25/10/4/1 odds, 100 free Early Access slots), or rendered from a live endpoint whose degraded state is distinguishable from a real zero, or explicitly labelled as not-yet-measurable with the exact query that will produce it after launch. Zuey appears once as creator attribution with the verbatim byline, never as a testimonial. The footer carries only links with a backing served route or a packet-verified external URL, plus the verbatim credit line `Made with ❤️ by AgentKit.best`.

The delivery also removes 10,816,963 B of dead weight from every deploy by filtering `scripts/build.js` step 3, and adds a `degraded` flag to `GET /api/early-access/status` so the slot pill can never render a database failure as the number `0`.

# 2. Constraints

Binding, each with its evidence.

**Truth and data**

1. **Zero real usage at launch.** No fabricated testimonial, logo, user count, pet count, hatch count, or visit count anywhere on the page. (User-confirmed decision 2.)
2. **`GET /api/early-access/status` cannot currently express "unknown".** Its `catch` block returns synthetic `{total:100, claimed:0, remaining:100, is_free:true}` on any DB error (`src/server/index.ts:72-79`, verified: the fallback literal `remaining: 100` is at line 77, `is_free: true` at line 78). A rendered `0` is therefore indistinguishable from a database failure. Changing this contract is a deliverable of this work (§7).
3. **The quota number is not a usage number.** It is `SELECT count(*) as count FROM early_access_slots WHERE status = 'claimed'` (`src/server/index.ts:60`) — claimed Early Access slots only. It is never relabelled as users, visits, pets, or hatches.
4. **PRD figures are targets, not measurements.** `<150ms` P95, `<30ms` cache hit, `<4.5s` AI generation, `$0.00` infra are goals in `docs/prd.md`. No benchmark, uptime, latency, or telemetry data exists in this repo. They may appear only as stated design targets, never as live metrics, badges, or "operational" status.
5. **Every byte figure is packet-measured, explicit arithmetic over packet numbers, or marked `[ESTIMATE]` with a measurement method.** All estimates in §8 name the command that will replace them.

**Assets**

6. **Eggs cost 0 bytes and no AI.** `src/client/components/EggSpritesheetPlayer.tsx` is pure CSS — a radial-gradient ellipse with `border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%`, a CSS crack overlay, and per-archetype colors from the manifest. It declares `canvasRef` and never uses it, and loads no image. No egg image assets and no egg spritesheet frames are budgeted or claimed.
7. **`EGG_MANIFEST.spritesheetPath` is dead config.** Verified at `src/client/assets/eggs/manifest.ts:46` (`/eggs/ember-core/spritesheet.webp`) and `:64` (`/eggs/neon-byte/spritesheet.webp`). No such files exist and nothing reads the field. Nothing in this design references it.
8. **Only `neonbyte` has the 16-pose landing sequence.** Pose order: hover, dive_start, dive_steep, plunge, approach, pre_impact, three_point_landing, impact_crouch, shockwave, recoil, rise_knee, rise_aura, stand_up, aura_flare, settle, hero_stance. The demo is representative pre-generated content and is never presented as the visitor's own generated result. No other archetype is claimed to have one.
9. **`InteractiveCompanionShowcase` is not used on the new landing page.** It creates an `Image()` on mount at `/assets/sample-pets/${archetype.id}-spritesheet.png` (`src/client/components/InteractiveCompanionShowcase.tsx:45`); mounting all eight eagerly reaches for 6,539,997 B of emotion sheets. Additionally verified: the manifest ids are hyphenated (`'neon-byte'` at `manifest.ts:55`, `'ember-core'` at `:37`) while the shipped files are unhyphenated (`assets/sample-pets/neonbyte-spritesheet.png`), so that request 404s today and falls through the `img.onerror` handler at `:55-63` to `archetype.companionImageUrl` (`/assets/sample-pets/neonbyte.jpg`, `manifest.ts:60`) — i.e. the 8 `{id}.jpg` files totalling 3,826,199 B. Either resolution path is unacceptable on a landing page, so the component is excluded rather than repaired here.
10. **No 16-pose player exists in `src/`.** Searched: `landing16` appears only in `scripts/gen-landing16.mjs`, `scripts/build-hatch-mockup-html.js`, `scripts/verify-landing16.mjs`, and `docs/design-guidelines.md:99`. The client-side player is new code, not a reuse.

**Design system**

11. **Option 1 Cyber-Arcade Fantasy tokens only**, no new palette or typeface: `--bg-base #07090E`, `--bg-surface-1 #0D111A`, `--bg-surface-2 #141B27`, `--bg-surface-3 #1C2637`, `--text-primary #F0F6FC`, `--text-secondary #8B9BB4`, `--text-muted #53627A`, `--accent-cyan #00F0FF`, `--accent-magenta #FF2A85`, `--accent-amber #FFA800`, `--accent-green #00FF88`, 60/30/10 distribution. Glows and `--card-shadow` as specified. Type: H1 `Archivo` 900 `clamp(28px,4vw,42px)` LH 1.15; H2 `Archivo` 800 24–32px; H3 `Archivo` 700 18–20px; body `Schibsted Grotesk` 400 15–16px LH 1.6; numbers `JetBrains Mono` 700 tabular 14–18px; micro labels `JetBrains Mono` 700 uppercase 11–12px +0.08em. Spacing scale 4/8/12/16/24/32/48/64.
12. **Motion tokens are the only durations used**: hover 100–150ms, modal 200–300ms, hatch 800–1200ms, `--ease-out-expo cubic-bezier(0.16,1,0.3,1)`, `--ease-spring cubic-bezier(0.175,0.885,0.32,1.275)`. `prefers-reduced-motion: reduce` disables shake and holds static frames on every animation.
13. **Tokens move out of inline styles into CSS.** `src/client/styles/responsive.css` (3.7 KB) is the only stylesheet and already declares the token block at `:5-25` plus `@media (prefers-reduced-motion: reduce)` at `:176-182`; the landing extends this file. `HomePage.tsx` is 284 lines of 100% inline style objects and is replaced.
14. **No CSS framework, no animation library, no analytics package added.** Stack stays React 19 + Vite 6 + Hono 4 on Cloudflare Pages/Workers + D1/KV/R2 (`package.json` runtime dependencies are exactly `hono`, `zod`, `@hono/zod-validator`). Any heavyweight dependency requires justification plus a gzipped cost measured from a build diff before merge.

**Shared surfaces and routes**

15. **Exactly one global navbar.** `<Navbar />` is mounted globally at `src/client/main.tsx:101` and `App` performs one mount-time `fetch('/api/early-access/status')` (`src/client/main.tsx:28-31`) — it is not polling. The existing `<header className="githoot-header">` is redesigned in place; no second `<header>` is introduced and the quota fetch is not duplicated.
16. **The navbar's `Hatch →` submit label is misleading and changes.** `Navbar.tsx:112` reads `Hatch →` but `handleSearchSubmit` merely sets `window.location.pathname = '/' + username` (`Navbar.tsx:21-26`). Label becomes `Preview`.
17. **0 AI cost and no auth on any anonymous path.** The anonymous primary CTA is username entry → `/{username}` preview. No landing control opens OAuth, the checkout modal, or a generation request.
18. **Link integrity.** No `/docs#fragment` links — `src/client/pages/DocsPage.tsx` contains zero `id=` attributes. No `LICENSE` link — no `LICENSE` file exists. No invented repository URL; the configured origin is `https://github.com/bestagentkits/githatch` and there is no `mrgoonie/githoot`.
19. **Mobile-first.** No hardcoded fixed-width grid track may recur. `HomePage.tsx:129` currently hardcodes `gridTemplateColumns: '320px 1fr'`; the replacement uses `minmax(0, 1fr)` tracks and `clamp()` spacing only.
20. **Landing telemetry must not touch the profile funnel.** A landing or demo view never fires `egg_viewed`; that would corrupt the PRD's `>20%` claim-conversion denominator, whose denominators are `egg_viewed`, `claim_completed`, `share_clicked`.
21. **Early Access economics stated, not hidden**: first 100 free, slot 101+ $0.99 cost recovery. 1 GitHub ID = 1 immutable Guardian DNA, no rerolls (DNA seed is `githoot:dna:v1:` + GitHub numeric user id, else fallback username, else literal `anon`, then SHA-256, `src/server/services/dna/seed.ts:56`).
22. **Rarity tiers are exactly `Common`, `Rare`, `Epic`, `Legendary`, `Mythic`.** There is no `Uncommon`.
23. **No autoplay audio.** `src/client/hooks/useEggAudio.ts` synthesizes sound via `AudioContext` on explicit call only (`playWobbleSound` is invoked from a click handler, `InteractiveCompanionShowcase.tsx:66-69`). The landing wires sound to explicit user activation or not at all.
24. **UI claims require browser screenshots under `plans/reports/screenshots/`** (directory already exists and holds prior evidence plus `evidence-manifest.json`).

# 3. Non-goals

1. No Arena or combat surface, no store or inventory, no Guilds, no webhook ingestion. Roadmap Phases 9–11 (evolution/legacy forms, competitive discovery arena, creator ecosystem/guilds) appear only as narrative "what's next" copy.
2. No i18n layer, no locale switcher, no translation infrastructure. English is primary.
3. No PostHog SDK install, no key, no outbound analytics request in this delivery. Taxonomy and call sites only.
4. No translation of the `/explore`, `/design`, `/docs`, or `/:username` page bodies (all currently Vietnamese). This delivery rewrites `/` plus the two shared surfaces (`Navbar`, new `Footer`) and marks the untranslated pages honestly with `lang="vi"` (§4, §9).
5. No repair of `EGG_MANIFEST.spritesheetPath`, no generation of `/eggs/**/spritesheet.webp`, no fix to the `InteractiveCompanionShowcase` id/filename mismatch. Pre-existing conditions, out of scope; the landing simply does not depend on them.
6. No generation of 16-pose sequences for the other seven archetypes. No new Gemini calls.
7. No aggregate stats endpoint implemented in this delivery. §7 specifies it as designed-and-deferred work with exact queries.
8. No `/design.html` rework. The 8,870,252 B static file and the `/design` SPA route (`DesignSystemPage`) both stay as they are.
9. No customer testimonial section. There are no customers and no consented quotes.
10. No CDN, image service, or third-party font host change beyond narrowing the existing Google Fonts request.

# 4. Acceptance criteria

Each line is checkable by a named command, a named screenshot, or inspection of a named file or endpoint.

**A. Build and gates**

1. `npm run typecheck` exits 0.
2. `npx vitest run` exits 0.
3. `npm run build` exits 0 and prints all four step lines from `scripts/build.js`.
4. **Dead-weight exclusion measured, not asserted:** with step 3 of `scripts/build.js` filtered, the byte total of `dist/` is exactly **10,816,963 B** lower than an unfiltered build of the same source tree. Derivation: `-gemini-raw.jpg` 6,648,896 + `landing16-frames/` 1,365,519 + `neonbyte-landing16-{sheet,strip}.png` 2,802,548 = 10,816,963. Check: 6,648,896 + 1,365,519 = 8,014,415; 8,014,415 + 2,802,548 = **10,816,963** ✓. Applied to the measured baseline `dist/` total of 34,835,846 B, the same-source expectation is 34,835,846 − 10,816,963 = **24,018,883 B** plus the delta of the rewritten client entry, which criterion 5 measures separately.
5. **Client entry re-measured after the rewrite.** `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js` raw and gzip bytes are recorded in `plans/reports/screenshots/evidence-manifest.json` against the measured baseline (847/501, 2,741/1,054, 260,803/76,342; raw total 264,391, gzip total 77,897). Any gzip increase over 77,897 B is itemized with a reason.
6. `dist/assets/sample-pets/*-gemini-raw.jpg` count is 0; `dist/assets/sample-pets/landing16-frames/` does not exist; `dist/assets/sample-pets/neonbyte-landing16-strip.webp` exists at 286,362 B.

**B. First-viewport conversion gate**

7. Screenshot `plans/reports/screenshots/landing-375x812-first-viewport.png` at exactly 375x812, above the fold, unscrolled, shows all four of: (a) what GitHoot is in one sentence, (b) the `github.com/…` → `githoot.com/…` swap, (c) one recognizable Guardian, (d) one enabled username input plus a submit button labelled `Preview`. No navbar element overlaps any of them.
8. The same four items are present in `landing-1440x900-first-viewport.png` at 1440x900.
9. `landing-375x812-reduced-motion.png` captured with `prefers-reduced-motion: reduce` emulated shows the same four items, with the Guardian on a static hero-stance frame and no animation in flight.
10. **First-viewport network trace.** On `/` at 375x812, before any scroll, `performance.getEntriesByType('resource').filter(e => e.initiatorType === 'img')` has length **1** (the Guardian poster still). No entry name matches `-spritesheet.png`, `-gemini-raw.jpg`, `-hero.png`, `landing16-frames`, `landing16-sheet`, or `landing16-strip`. Trace saved to `plans/reports/screenshots/landing-first-viewport-resources.json` with each `encodedBodySize`.
11. **Demo asset is deferred.** A resource entry whose name contains `neonbyte-landing16-strip.webp` appears only after the demo section intersects the viewport, and its `encodedBodySize` is 286,362 B (± HTTP framing). Recorded in the same trace file post-scroll.

**C. Responsive and accessible**

12. Screenshots at 375x812, 768x1024, and 1440x900 exist under `plans/reports/screenshots/` for the full page.
13. At 375 px, 768 px, and 1440 px: `document.documentElement.scrollWidth <= window.innerWidth` — no horizontal overflow.
14. No fixed-width grid track survives: a repository search for `320px 1fr` in `src/client/` returns 0 matches.
15. Keyboard path proven: `Tab` from document start reaches, in order, brand → nav items → navbar `Preview` form → hero username input → hero `Preview` button → demo play/scrub controls; every focused element shows a visible focus ring (screenshot `landing-375-focus-hero-input.png` and `landing-1440-focus-demo-play.png`). `Enter` on the hero input navigates to `/{username}`.
16. Every interactive control is a native `button`, `a`, or `input` — no `onClick` on a bare `div` in the new landing files. (`HomePage.tsx:139-141` currently puts `onClick` on a `div`; the replacement does not.)
17. Every interactive target measures ≥ 44x44 CSS px at 375 px width, verified from `getBoundingClientRect()` and recorded in the evidence manifest.
18. No audio plays without an explicit user gesture: on load and on scroll-through at 375x812, no `AudioContext` is constructed (assert `window.AudioContext` call count is 0 until a control is clicked).

**D. Route and shared-surface integrity**

19. Exactly one `<header>` element in the rendered DOM of `/`: `document.querySelectorAll('header').length === 1`.
20. Exactly one request to `/api/early-access/status` per page load: the resource trace contains one matching entry.
21. All five client routes (`/`, `/explore`, `/design`, `/docs`, `/{username}`) render with zero uncaught console errors; screenshots `route-smoke-{home,explore,design,docs,profile}.png`.
22. `GET /health` returns 200.
23. `index.html` root element is `<html lang="en">`. Each still-Vietnamese page root container carries `lang="vi"`: `ExplorePage`, `DesignSystemPage`, `DocsPage`, `PublicProfilePage`, `HatchWaitPage`. Verified by 5 matches for `lang="vi"` in `src/client/pages/`.

**E. Truth, trust, links**

24. `GET /api/early-access/status` response body contains a `degraded` boolean. With the D1 binding present it is `false`; with the binding removed or the table dropped it is `true` and `claimed`/`remaining` are `null`.
25. With `degraded: true`, the navbar pill renders the string `Early Access status unavailable` and never the digit `0`. Screenshot `navbar-quota-degraded-375.png`.
26. With `degraded: false` and `claimed: 0`, the pill renders `Early Access: 100/100 slots left` and the launch-status panel renders `0 slots claimed` with the source label `live · early_access_slots`. Screenshot `launch-status-zero-375.png`.
27. The rendered page contains no numeric claim of users, visits, pets, or hatches. Search the built `dist/assets/index-*.js` and the DOM text for the strings `users hatched`, `visits`, `pets hatched`, `developers joined`: 0 matches.
28. The rendered page contains no occurrence of `150ms`, `99.9`, `uptime`, `benchmark`, or `operational` presented as a status. Any appearance of a PRD figure is inside a block whose visible label begins `Design target`.
29. Rarity labels rendered are exactly `Common`, `Rare`, `Epic`, `Legendary`, `Mythic`; the string `Uncommon` has 0 matches in `src/client/`. The odds row is captioned `Published odds` and not `observed`/`actual`.
30. `egg_viewed` is never fired from `/`: with the analytics wrapper in debug mode, the recorded event buffer after a full scroll-through plus every demo interaction at 375x812 contains `landing_viewed` and `demo_interacted` and zero `egg_viewed`. Buffer saved to `plans/reports/screenshots/landing-events.json`.
31. With no PostHog key configured, zero requests to any `posthog` or `i.posthog.com` host appear in the resource trace, and `posthog-js` is absent from `package.json`.
32. No analytics event payload contains a username, email, GitHub id, or avatar URL. Verified by inspecting the `landing-events.json` property keys against the allow-list in §7.
33. Footer link audit: every `href` in the footer resolves to a served route from the verified list, or to one of the five packet-verified external URLs. Zero `href` values contain `/docs#`; zero contain `LICENSE`; zero contain `mrgoonie`. A link to `https://github.com/bestagentkits/githatch` is rendered **only if** a controller records an HTTP 200 for it in the evidence manifest; otherwise that slot is omitted.
34. The footer contains the exact byte sequence `Made with ❤️ by AgentKit.best` and the exact byline `From the creator of AgentKit.best, NextLevelBuilder.io, GoClaw.sh & UI UX Pro Max Skill`.
35. The Zuey block's visible label is `Creator` and the section heading contains no form of the word `testimonial`, `review`, or `customer`.
36. The demo section renders the literal caption `Pre-generated sample — not your Guardian` adjacent to the player.

**F. Motion**

37. Every CSS transition/animation duration in the new landing styles falls in one of the token bands: 100–150ms (hover), 200–300ms (modal/reveal), 800–1200ms (hatch). The 16-pose player's 1.1s run is inside the hatch band. Verified by reading the declared durations in `responsive.css`.
38. Under `prefers-reduced-motion: reduce`, the 16-pose player renders `background-position` fixed to frame 16 (hero_stance) with no `animation` property active, the swap morph renders as final-state text, and no element has a `transform` animation running. Verified by `getComputedStyle` assertions recorded in the evidence manifest.
39. Under reduced motion the frame scrubber remains operable, so a reduced-motion visitor can still step through all 16 poses on explicit input.

# 5. Site structure

Ordered IA for `/`. Global shared surfaces bracket it.

**Global — Navbar (redesigned in place, single `<header>`)**
- Narrative job: orient and stay out of the way; carry the one honest live number.
- Contents: brand `🦉 GitHoot`; nav `Home / Explore / Design Studio / Docs`; quota pill; compact username form.
- Primary CTA: `Preview` (replaces the misleading `Hatch →`).
- Asset/animation: none. Pill dot pulse only, and it is suppressed under reduced motion.
- Mobile (≤540px): brand + a 44x44 menu button. Nav items collapse into a disclosure panel; the pill drops to a single line under the brand; the navbar form is hidden below 540px because the hero form is on screen — this avoids two competing inputs and eliminates navbar wrap over hero content.

**S1 — Hero: the swap**
- Narrative job: in one viewport, say what GitHoot is, show the domain swap, show one Guardian, and offer the one truthful next action.
- Primary CTA: username input + `Preview` → `/{username}`. Secondary: three example links (`octocat`, `torvalds`, `yyx990803`) that navigate to the same preview route.
- Asset/animation: CSS-only URL morph `github.com/octocat` → `githoot.com/octocat` (letter-slide, 800ms, `--ease-out-expo`); the CSS egg from `EggSpritesheetPlayer` (0 bytes) beside a single Guardian poster still (`[ESTIMATE]` ≤ 40,000 B, §8) with an arrow between them. Exactly one image request in this viewport.
- Mobile: single column. Order: eyebrow → H1 → swap line → egg+Guardian pair at 50/50 of a `minmax(0,1fr) minmax(0,1fr)` grid → input (full width, 48px tall) → `Preview` button (full width, 48px) → example links wrapping. `clamp(24px, 6vw, 64px)` block padding.

**S2 — Signature demo: the landing**
- Narrative job: the spectacle. Make a visitor want a Guardian, in under two seconds of attention.
- Primary CTA: `Preview your profile` scroll-anchor back to the hero form (same-page, no new route).
- Asset/animation: `assets/sample-pets/neonbyte-landing16-strip.webp` (286,362 B, measured), CSS `steps(15)` `background-position` player over a 16-frame strip, ~1.1s run, 4.4s slow-mo toggle. Loaded on `IntersectionObserver` entry, never before. Controls: play, slow-mo, and a 1–16 frame scrubber with the pose name shown (`three_point_landing`, `hero_stance`, …).
- Mobile: player fills width at `aspect-ratio: 1/1`, capped `max-width: 320px`, centered. Controls in a single 44px-tall row beneath. Caption `Pre-generated sample — not your Guardian` directly under the frame.

**S3 — How the hatch works**
- Narrative job: the mechanism becomes obvious here. Four steps, each one sentence, no jargon in the headline.
- Primary CTA: none (this section exists to remove friction, not create it).
- Asset/animation: numbered cards, 0 bytes. Each card's number counts in on scroll (200ms, `--ease-out-expo`), staggered 60ms. Includes a determinism callout: your Guardian is derived from your GitHub account id, not rolled — one account, one Guardian, no rerolls.
- Mobile: single-column stack of 4 cards, `gap: 16px`. Desktop `repeat(auto-fit, minmax(0, 1fr))`, four across at 1440.

**S4 — Archetypes and published odds**
- Narrative job: show breadth (8 elements) and disclose the gacha odds up front rather than hiding them.
- Primary CTA: selecting an archetype updates the hero egg color, reinforcing the preview action.
- Asset/animation: 8 CSS eggs (0 bytes) via `EggSpritesheetPlayer`; hover lift 120ms; a 5-tier odds row (`Common` 60 / `Rare` 25 / `Epic` 10 / `Legendary` 4 / `Mythic` 1) using `JetBrains Mono` tabular numbers, captioned `Published odds`.
- Mobile: 2-column archetype grid `repeat(2, minmax(0,1fr))` at 375; odds render as a 5-row list with the tier name left and the percentage right (not a squeezed 5-column grid).

**S5 — Launch status (trust)**
- Narrative job: replace absent counters with verifiable transparency. Every row states what the number is, where it comes from, and what it is today.
- Primary CTA: none.
- Asset/animation: a table/definition list, 0 bytes. Values fade in 200ms. Rows with no data source yet render the literal state `Not measured yet` with the mechanism named.
- Mobile: stacked definition rows — label on line 1 (micro label style), value on line 2 (mono), source on line 3 (muted). No horizontal table scroll.

**S6 — Creator**
- Narrative job: a real person is accountable for this. Attribution, not social proof.
- Primary CTA: `AgentKit.best` → `https://agentkit.best`.
- Asset/animation: locally downscaled 96x96 avatar derived from the verified `https://cdn.zuey.me/avatar.png` (`[ESTIMATE]` ≤ 12,000 B, §8), lazy, explicit `width`/`height` to prevent shift. No animation beyond a 120ms border glow on hover.
- Mobile: avatar centered above name/handle, byline beneath, quote block full width, `max-width: 60ch` on larger screens.

**S7 — Early Access**
- Narrative job: the ask, with the economics stated plainly.
- Primary CTA: username input (repeat of the hero form, same component) + `Preview`. No auth from here.
- Asset/animation: slot pill fed by the same single quota fetch; a 100-cell CSS dot grid where claimed cells light up (all 100 unlit at launch), 0 bytes. Degraded state replaces the grid with the unavailable message.
- Mobile: the dot grid is `repeat(10, minmax(0,1fr))` — 10x10 — sized by `aspect-ratio: 1`, so it never overflows 375px.

**S8 — After the hatch**
- Narrative job: forward-looking curiosity without promising ship dates. Evolution and legacy forms, a competitive discovery arena, a creator ecosystem — framed explicitly as `Not in the first release`.
- Primary CTA: none.
- Asset/animation: three muted cards, 0 bytes, no animation beyond 120ms hover.
- Mobile: single-column stack.

**Global — Footer** (full inventory in §9)
- Narrative job: orientation, credibility, credit.
- Mobile: four stacked link groups, each heading a micro label, links at 44px row height; credit line last, centered.

# 6. Storytelling and copy direction

**Narrative arc.** Curiosity → recognition → mechanism → identity → honesty → ask. The visitor arrives on a familiar surface (a GitHub URL), watches one word change, and gets an unfamiliar reward (a Guardian). Then the page explains itself fast enough that curiosity converts into a lookup instead of decaying into confusion. Credibility internals (KV/SWR resolver, token pool, WASM contour slicing, R2, the Gemini pose matrix) are held back until S3 and S5, where they function as proof that this was built by someone who knows what they are doing — never as the opening proposition.

**The curiosity hook** is the URL morph in the first viewport: `github.com/octocat` visibly becoming `githoot.com/octocat`, with the profile the visitor already understands turning into something they do not. It is a two-character change with an outsized payoff, and it is legible in under a second on a 375px screen.

**The moment the mechanism becomes obvious** is the junction of S2 and S3: the 16-pose landing shows *what you get*, then the four-step strip immediately beneath it shows *how* — look up, claim with GitHub, the sprite matrix is generated, the Gacha reveal happens. A visitor who reads only the H1, the swap line, and the four step headlines understands the entire product. That is the design intent: spectacle first for attention, mechanism within one scroll for comprehension.

**Real copy.**

Eyebrow (micro label): `PRE-LAUNCH · 100 FREE EARLY ACCESS SLOTS`

H1: `Your GitHub profile hatches a Guardian.`

Swap line (mono, animated): `github.com/octocat` → `githoot.com/octocat`

Subhead: `Change one word in any GitHub URL and that developer's identity becomes a persistent fantasy Guardian — hatched from an AI-crafted egg, derived from their account, theirs permanently. One GitHub account, one Guardian, no rerolls.`

Hero input label (visually hidden, announced): `GitHub username`
Hero input prefix: `githoot.com/`
Hero placeholder: `octocat`
Hero button: `Preview`
Hero helper: `Free, no sign-in, nothing generated yet — you'll see the egg this profile would hatch.`
Examples label: `Try one:`

**S2** micro label: `SIGNATURE SEQUENCE`
H2: `Watch a Guardian make landfall.`
Body: `Sixteen frames, hover to hero stance. Aether Neon Byte comes down through the atmosphere, plants a three-point landing, and rises. Scrub it, slow it down, and look at every pose.`
Caption: `Pre-generated sample — not your Guardian.`
Controls: `Play` · `Slow motion` · `Frame 07 · three_point_landing`
CTA: `Preview your own profile`

**S3** micro label: `HOW IT WORKS`
H2: `How the hatch works.`
- `01 · We look up the profile.` — `Your public GitHub profile resolves from an edge cache with a rotating token pool behind it, so lookups keep working when the GitHub API is throttled.`
- `02 · You claim it with GitHub.` — `Sign in once to prove the account is yours. That reserves one Early Access slot and locks your Guardian to your GitHub account id.`
- `03 · Gemini crafts the sprite matrix.` — `One hero portrait plus a 4x2 pose matrix — idle, happy, sleepy, proud, angry, work, celebrate — contour-sliced, background removed, stored on object storage.`
- `04 · The egg cracks open.` — `A Gacha reveal, an animated Open Graph card, and an SVG badge you can drop into your README — one click to X or LinkedIn.`
Determinism callout H3: `Your Guardian is derived, not rolled.`
Body: `Archetype, rarity, markings, silhouette and temperament all come from a SHA-256 of your GitHub account id. Same account, same Guardian, every time. There is no reroll button, and there never will be.`

**S4** micro label: `EIGHT ELEMENTS`
H2: `An element for every stack.`
Body: `Fire for Rust and Go, cyber for TypeScript and the web, water for Python and AI, and five more. Eight archetypes, drawn entirely in CSS — previewing an egg costs nothing to serve and calls no model.`
Odds block H3: `Published odds, stated up front.`
Odds caption: `Published odds · not observed drop data`

**S5** micro label: `LAUNCH STATUS`
H2: `Where GitHoot actually stands today.`
Body: `GitHoot has not launched. Nobody has hatched a Guardian yet, and we are not going to print invented numbers to make this page look busier than the product is. Here is every number we can honestly show, and where each one will come from once there is something to count.`

**S6** micro label: `CREATOR`
H2: `Built in the open by Zuey.`
Quote: `"I wanted the thing developers already share — their GitHub profile — to be worth looking at twice. A Guardian you didn't choose, that came out of your own account and stays yours, is a better souvenir than a follower count."`
Attribution: `Zuey · @goon_nguyen`
Byline: `From the creator of AgentKit.best, NextLevelBuilder.io, GoClaw.sh & UI UX Pro Max Skill`

**S7** micro label: `EARLY ACCESS`
H2: `The first 100 developers hatch free.`
Body: `One hundred free slots, one per GitHub account. After slot 100, a hatch costs $0.99 — that covers the model call, nothing more. We would rather tell you the price now than surprise you at the reveal.`
CTA: `Preview` (same form as hero)
Helper: `Previewing is always free and never signs you in.`

**S8** micro label: `ROADMAP`
H2: `After the hatch.`
Body: `Not in the first release — but this is the direction: Guardians that evolve as your work does and leave legacy forms behind; a discovery arena where developers find each other through their companions; a creator ecosystem for people who want to design the archetypes.`

**Footer tagline**: `A developer discovery network disguised as a fantasy companion game.`

# 7. Trust architecture

Zero users, zero pets, zero hatches, zero visits. Trust therefore comes from disclosure, not from counters. Every number that appears has a row in this map. Nothing that lacks a row appears on the page.

**Per-number source map**

| # | Number as shown | Source | Exact semantics | Value at launch | Loading state | Unavailable state | Future cutover |
|---|---|---|---|---|---|---|---|
| 1 | `Early Access: {remaining}/{total} slots left` (navbar pill) | `GET /api/early-access/status`, one mount-time fetch in `App` (`src/client/main.tsx:28-31`) | `remaining = total − claimed`, where `claimed = SELECT count(*) FROM early_access_slots WHERE status='claimed'` (`src/server/index.ts:60`). Claimed Early Access slots only — not users, hatches, pets or visits | `100/100 slots left` (0 claimed) | Pill renders skeleton bar, no digits, `aria-busy="true"` | `degraded: true` → literal text `Early Access status unavailable`, never a digit | No cutover needed; already live. Requires the `degraded` change below to be honest |
| 2 | `0 slots claimed` (S5, S7 dot grid) | Same single fetch, passed down; no second request | Same as #1 | `0` claimed, 100 dots unlit | Dots render muted with no count | Grid hidden; row reads `Slot count unavailable — the database did not answer` | Same |
| 3 | `8 archetypes` | `Object.keys(EGG_MANIFEST).length` (`src/client/assets/eggs/manifest.ts:35-180`, 8 entries: `ember-core`, `neon-byte`, `abyssal-pearl`, `verdant-spore`, `solar-flare`, `void-shard`, `rust-dynamo`, `celestial-echo`) | Count of pre-generated archetype definitions shipped in the client bundle | `8` | Not async — no loading state | Cannot be unavailable (compile-time constant) | Update the constant if archetypes are added |
| 4 | `16 poses` | The `neonbyte` landing sequence: hover … hero_stance (16 named poses); strip is 16 frames | Frames in the one existing landing sequence, `neonbyte` only | `16` | Not async | n/a | n/a |
| 5 | `4x2 emotion matrix` / `7 emotions + 1 hero` | `docs/design-guidelines.md` pet emotion sheet spec; the 7 pose buttons in `InteractiveCompanionShowcase.tsx:25-33` (idle, happy, sleepy, proud, angry, work, celebrate) | Cells in the generated pose sheet per Guardian | `4x2` | Not async | n/a | n/a |
| 6 | `Common 60 / Rare 25 / Epic 10 / Legendary 4 / Mythic 1` | Published design odds; tier names verified in `src/server/services/dna/seed.ts` | **Published** drop odds — the intended distribution, not observed outcomes | As shown, captioned `Published odds · not observed drop data` | Not async | n/a | Once enough hatches exist, an observed-distribution row may be added **beside** the published row, never replacing it |
| 7 | `100 free · $0.99 after` | `docs/prd.md` Early Access ledger design; `EARLY_ACCESS_TOTAL_SLOTS` default `'100'` (`src/server/index.ts:59`) | Fixed launch economics | As shown | n/a | n/a | Read `total` from the endpoint if the slot count ever changes |
| 8 | Guardians hatched | **Does not exist.** No aggregate stats endpoint exists | Would be `SELECT count(*) FROM guardians` — one row inserted per completed claim at `src/server/services/claim/transaction.ts:110`; equivalently `SELECT count(*) FROM activity_ledger WHERE event_type='CLAIM_HATCH'` (`transaction.ts:130`) | **Not rendered as a number.** S5 row reads `Guardians hatched — none yet. This page will show a live count the day the first one is claimed.` | n/a | n/a | Build `GET /api/stats/public` returning `{guardians_hatched, degraded}`; source the count from `guardians`. Before labelling it "hatched", confirm no `guardians` row is written on any path other than a completed claim |
| 9 | Developers with a Guardian | **Does not exist.** No endpoint | Would be `SELECT count(*) FROM users` (table present in D1 alongside `github_accounts`, `guardians`, `early_access_slots`, `github_token_pool`, `activity_ledger`) | **Not rendered.** S5 row reads `Developers claimed — none yet.` | n/a | n/a | Same endpoint, second field. Semantics must be stated as "rows in `users`", which is only equal to "people with a Guardian" if a user row is never created before a claim — verify before publishing |
| 10 | Visits | **Impossible from D1.** No table records page views | Would require PostHog or a Workers KV counter | **Not rendered.** S5 row reads `Visits — not measured yet. We have no analytics key configured, so we are not counting.` | n/a | n/a | After a PostHog key exists, read from PostHog; or add an atomic KV counter. Either is new work |
| 11 | Latency / cost targets | `docs/prd.md` | **Design targets**, not measurements. No benchmark, uptime or telemetry data exists in this repo | Shown only inside a block labelled `Design target` (`<150ms P95 profile resolve`, `<4.5s generation`, `$0.00 infra`) | n/a | n/a | Replace with measured percentiles only when a real telemetry source exists, and label the measurement window |

**Zero-state rendering and the fallback ambiguity**

The hard problem: `GET /api/early-access/status` returns synthetic `{total:100, claimed:0, remaining:100, is_free:true}` from its `catch` block on *any* DB error (`src/server/index.ts:72-79`). At launch the true value is also `claimed: 0`. A rendered `0` is therefore literally indistinguishable from a database outage, and no client-side trick can separate them. **The endpoint contract must change**, and that is a deliverable:

```
// success path
{ total: 100, claimed: 0, remaining: 100, is_free: true, degraded: false }
// catch path
{ total: 100, claimed: null, remaining: null, is_free: true, degraded: true }
```

The response stays HTTP 200 (the page must render), `total` stays populated so the copy `first 100 free` remains truthful, and the two count fields become `null` so the UI physically cannot print a fake zero. Client rules:

- `degraded === false` → render the number. At launch: `Early Access: 100/100 slots left`, `0 slots claimed`, source label `live · early_access_slots`.
- `degraded === true` → render `Early Access status unavailable` and, in S5, `Slot count unavailable — the database did not answer. This is a status we can't confirm right now, not a zero.`
- fetch in flight → skeleton, `aria-busy="true"`, no digits.
- fetch rejected client-side (`.catch` at `main.tsx:31`) → treated identically to `degraded: true`.

The same three-state discipline applies to every future stats field: a real value, an explicit `Not measured yet` with the mechanism named, or an explicit unavailable — never a bare zero.

**Creator attribution block (S6)**

One block, labelled `Creator`, never `Testimonial`. Zuey is the author of the product; presenting the quote as social proof would be a fabricated endorsement. Contents: 96x96 avatar derived from the verified `https://cdn.zuey.me/avatar.png` (HTTP 200, `image/png`, 282,949 B measured — too heavy to ship as-is, so it is downscaled locally with the existing `sharp` devDependency); name `Zuey`; handle `@goon_nguyen` as **plain text**, not a link, because no social profile URL is verified; the first-person quote from §6; and the verbatim byline `From the creator of AgentKit.best, NextLevelBuilder.io, GoClaw.sh & UI UX Pro Max Skill`, with `AgentKit.best` → `https://agentkit.best`, `NextLevelBuilder.io` → `https://nextlevelbuilder.io`, `GoClaw.sh` → `https://goclaw.sh`, and `UI UX Pro Max Skill` → `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` (all four verified HTTP 200). No other quote card, no avatar row, no implied user count.

**PostHog taxonomy, integration point, privacy posture**

No key exists, so this delivery ships the taxonomy and the call sites, and **no SDK**. Integration point: a new `src/client/lib/analytics.ts` exporting a single `track(event, props)`. It reads `import.meta.env.VITE_POSTHOG_KEY`; when undefined it returns immediately — no import of any analytics package, no network request, no queue. `posthog-js` is not added to `package.json` in this delivery; when a key arrives, adding it requires a gzipped-cost figure measured from a before/after `dist/assets/index-*.js` diff, per the dependency constraint.

Minimal taxonomy, with trigger semantics:

| Event | Fires exactly when | Properties |
|---|---|---|
| `landing_viewed` | Once per page load of `/`, after first paint | `viewport_bucket` (`mobile`\|`tablet`\|`desktop`), `reduced_motion` (bool) |
| `profile_lookup_submitted` | The username form is submitted from any surface on `/` | `cta_source` (`hero`\|`navbar`\|`footer`\|`early_access`\|`example_link`), `input_length` (int) |
| `demo_interacted` | First interaction with the 16-pose player per page load, and on each control after | `control` (`play`\|`slowmo`\|`scrub`\|`replay`), `frame_index` (1–16) |
| `egg_viewed` | **Only on `/:username`**, when a real profile's egg becomes ≥50% visible. Never from `/`, never from the demo | `archetype_id`, `rarity_tier` |
| `claim_started` | The claim flow begins on a profile page (OAuth redirect initiated) | `archetype_id` |
| `claim_completed` | The claim transaction succeeds | `archetype_id`, `rarity_tier`, `slot_is_free` (bool) |
| `share_clicked` | A share control is activated | `network` (`x`\|`linkedin`\|`badge`\|`copy_link`) |

The landing/demo events (`landing_viewed`, `demo_interacted`) are deliberately disjoint from the funnel events. `egg_viewed` is the denominator for the PRD's `>20%` claim rate and `>25%` share rate; firing it on a marketing animation would silently inflate that denominator and make the funnel unreadable. This separation is enforced by criterion 30.

Privacy posture: no username, email, GitHub numeric id, display name, avatar URL, or free-text input value is ever a property — `input_length` is an integer, deliberately, so the taxonomy cannot leak the typed username. No PostHog session recording, no autocapture, no cross-site cookie. Unkeyed means no third-party host is contacted at all, so the page ships with zero analytics network surface and the privacy claim is trivially verifiable from a resource trace.

# 8. Motion and demo design

**Signature demo — the 16-pose landing**

One demo, one archetype, one asset. `assets/sample-pets/neonbyte-landing16-strip.webp` (**286,362 B, measured**) is a 16-frame horizontal strip. The player is a fixed-size element with the strip as `background-image` and a CSS `steps(15)` animation stepping `background-position` across the 16 frames, matching the `steps(15)` player documented at `docs/design-guidelines.md:99`. Run duration **1,100ms** — inside the 800–1200ms hatch band — with a slow-motion toggle at **4,400ms** (4x). Easing is `linear` because `steps()` timing must not be reshaped; the cinematic feel comes from the frame spacing baked into the sequence, not from the curve. Only `neonbyte` has this sequence; no other archetype is claimed to.

Why the strip and not the sheet: `neonbyte-landing16-sheet.webp` is 286,658 B and `neonbyte-landing16-strip.webp` is 286,362 B, so the strip is smaller by 296 B (286,658 − 286,362 = 296) and, more importantly, a single-axis `background-position` step is simpler and cheaper to animate than a two-axis 4x4 walk. The PNG variants (1,412,742 B and 1,389,806 B, 2,802,548 B together) and the 16 loose frames in `landing16-frames/` (1,365,519 B) are never requested and are excluded from the build entirely.

**Every animation**

| Animation | Duration / easing token | Asset | Reduced-motion fallback |
|---|---|---|---|
| Hero URL swap `github.com/` → `githoot.com/` | 800ms, `--ease-out-expo` | none (CSS text + `clip-path`) | Renders the final state `githoot.com/octocat` immediately, with the `github.com/` origin shown as static struck-through text so the swap idea survives without motion |
| Hero egg idle float + inner glow pulse | 1,200ms alternate, `--ease-out-expo` | none (CSS radial gradient, `EggSpritesheetPlayer`) | No transform, no pulse; static egg with its base glow |
| Hero egg → Guardian arrow shimmer | 150ms on hover, `--ease-out-expo` | none | Static arrow |
| Guardian poster still fade-in on decode | 200ms opacity | poster still, `[ESTIMATE]` ≤ 40,000 B | Appears at full opacity, no fade |
| 16-pose landing player | 1,100ms `steps(15)` linear; slow-mo 4,400ms | `neonbyte-landing16-strip.webp` 286,362 B | `animation: none`; `background-position` pinned to frame 16 (`hero_stance`) so the Guardian is intelligible in a deliberate static pose. The 1–16 scrubber stays operable, so all 16 poses remain reachable on explicit input |
| Shockwave ring at frame 09 | 300ms, `--ease-spring` | none (CSS `box-shadow` ring) | Not rendered |
| S3 step-number count-in, 60ms stagger | 200ms, `--ease-out-expo` | none | Final numbers rendered immediately |
| Archetype card hover lift | 120ms, `--ease-out-expo` | none | Border color change only, no transform |
| Odds bar fill | 300ms, `--ease-out-expo` | none | Bars rendered at final width |
| Launch-status value fade-in | 200ms | none | Rendered immediately |
| Early Access 100-dot grid stagger | 250ms total, 2.5ms per dot | none | All dots rendered at once |
| Navbar quota pill dot pulse | 1,500ms loop (existing `@keyframes pulse`, `responsive.css:171-174`) | none | Pulse disabled (extend the existing `@media (prefers-reduced-motion: reduce)` block at `responsive.css:176-182`) |
| Focus ring | 100ms | none | Instant, always visible — never suppressed |

No autoplay audio anywhere. The `useEggAudio` synthesizer is wired only to explicit clicks on the demo controls, and no `AudioContext` is constructed until such a click (criterion 18).

**Asset-weight budget**

Three measured lines from the packet, three `[ESTIMATE]` lines each with a measurement method. Text lines are gzip transfer bytes; image lines are raw file bytes (WebP/PNG are already compressed and are served without further encoding).

*Budget A — first viewport at 375x812, uncached, before any scroll:*

| Line | Bytes | Provenance |
|---|---:|---|
| `dist/index.html` | 501 | measured (gzip) |
| `dist/assets/index-*.css` | 1,054 | measured (gzip) |
| `dist/assets/index-*.js` | 76,342 | measured (gzip) |
| Guardian poster still `assets/landing/neonbyte-hero-stance-320.webp` | ≤ 40,000 | `[ESTIMATE]` |
| **Budget A total** | **≤ 117,897** | |

Arithmetic check: 501 + 1,054 = 1,555; 1,555 + 76,342 = **77,897** — which equals the packet's measured critical-entry gzip total of 77,897 B exactly ✓. Then 77,897 + 40,000 = **117,897** ✓.

*Budget A′ — first viewport including webfonts:*

| Line | Bytes | Provenance |
|---|---:|---|
| Budget A | 117,897 | derived above |
| 3 webfont `woff2` files from `fonts.gstatic.com` (Archivo 900, Schibsted Grotesk 400, JetBrains Mono 700) | ≤ 90,000 | `[ESTIMATE]` |
| **Budget A′ total** | **≤ 207,897** | |

Check: 117,897 + 90,000 = **207,897** ✓. Note the fonts are already requested today — `index.html:7-9` preconnects to Google Fonts and pulls `Archivo:wght@700;900`, `JetBrains+Mono:wght@500;700`, `Schibsted+Grotesk:wght@400;600;700` (3 families, 8 weights). They are third-party and therefore outside the measured 264,391 B `dist/` entry. This delivery narrows the request from 8 weights to the 5 the token system actually uses (Archivo 900 + 800/700 for H2/H3, Schibsted Grotesk 400, JetBrains Mono 700), which reduces this line; the estimate is deliberately not reduced in advance.

*Budget B — full landing page, scrolled to the footer, everything lazy-loaded:*

| Line | Bytes | Provenance |
|---|---:|---|
| Budget A′ | 207,897 | derived above |
| `neonbyte-landing16-strip.webp` (demo, on intersection) | 286,362 | measured |
| Zuey avatar, local 96x96 WebP (lazy) | ≤ 12,000 | `[ESTIMATE]` |
| **Budget B total** | **≤ 506,259** | |

Check: 207,897 + 286,362 = 494,259; 494,259 + 12,000 = **506,259** ✓.

*Measured-only subtotal (zero estimates):* 77,897 + 286,362 = **364,259 B** ✓.
*Estimate-only subtotal:* 40,000 + 90,000 + 12,000 = **142,000 B**. Cross-check: 364,259 + 142,000 = **506,259** ✓ — matches Budget B.

**Estimate measurement methods** (each replaces its `[ESTIMATE]` with a measured number in `plans/reports/screenshots/evidence-manifest.json` before merge):

- *Poster still ≤ 40,000 B* — produced with the existing `sharp` devDependency by extracting the last 256x256 frame from `neonbyte-landing16-strip.webp` (frame 16, `hero_stance`; the strip is 4096x256 per `scripts/gen-landing16.mjs:242` and `scripts/build-hatch-mockup-html.js:20`, so the crop is `left: 3840, top: 0, width: 256, height: 256`), resizing to 320px, encoding WebP with alpha, then `stat -c %s` on the output. If the measured size exceeds 40,000 B, quality is stepped down until it fits, and the final measured value is recorded.
- *Webfonts ≤ 90,000 B* — load the built `/` in the `browser` tool, then sum `performance.getEntriesByType('resource').filter(e => e.name.includes('fonts.gstatic.com')).reduce((a,e) => a + e.encodedBodySize, 0)`. Recorded per file and as a total.
- *Zuey avatar ≤ 12,000 B* — `sharp` resize of the verified 282,949 B `https://cdn.zuey.me/avatar.png` to 96x96 WebP, then `stat` the output. 282,949 → ≤ 12,000 B is a reduction of at least 270,949 B (282,949 − 12,000 = 270,949) versus hotlinking the original.

**Explicitly not loaded by the landing page** (measured bytes, all zero requests, verified by criterion 10):

| Excluded asset group | Bytes | Why not loaded |
|---|---:|---|
| 8 `-spritesheet.png` emotion sheets | 6,539,997 | `InteractiveCompanionShowcase` is not used |
| 8 `-hero.png` | 3,826,199 | poster still is derived from the strip instead |
| 8 `{id}.jpg` | 3,826,199 | these are the `onerror` fallback targets of the unused component |
| `-gemini-raw.jpg` | 6,648,896 | internal generation artifacts |
| `neonbyte-landing16-{sheet,strip}.png` | 2,802,548 | WebP strip used instead |
| `neonbyte-landing16-sheet.webp` | 286,658 | strip used instead (smaller by 296 B, single-axis stepping) |
| `landing16-frames/f01..f16.png` | 1,365,519 | superseded by the composited strip |
| `design.html` | 8,870,252 | served at `/design.html`; not linked from the landing |

**Loading strategy**

1. HTML, CSS, JS — the single critical entry, unchanged in shape from the measured baseline.
2. Fonts — `display=swap` (already set at `index.html:9`), narrowed to 5 weights, `preconnect` retained.
3. Poster still — `fetchpriority="high"`, explicit `width`/`height`, no lazy attribute: it is the only first-viewport image and must not shift layout.
4. `neonbyte-landing16-strip.webp` — `IntersectionObserver` with `rootMargin: '200px'` on the demo section; the element is created only after the observer fires, so a visitor who never scrolls never pays the 286,362 B. Skeleton frame occupies the final aspect ratio meanwhile, so no shift.
5. Zuey avatar — `loading="lazy"`, `decoding="async"`, explicit dimensions.
6. Build-time: `scripts/build.js` step 3 currently runs an unfiltered `fs.cpSync('assets', 'dist/assets', {recursive:true})` (`scripts/build.js:33`), which is why 10,816,963 B of unreferenced files ship. A filter predicate excluding `*-gemini-raw.jpg`, `landing16-frames/`, and `*-landing16-*.png` removes exactly that 10,816,963 B (derivation and check in §4 criterion 4).

# 9. Footer

Four link groups plus a credit bar. Every `href` below is either a route verified to exist in this repo or a URL verified HTTP 200 in the evidence packet. There are no `/docs#fragment` links (`DocsPage.tsx` has zero `id=` attributes), no `LICENSE` link (no such file), and no invented repository URL.

**Group 1 — GitHoot**
| Label | `href` | Backing |
|---|---|---|
| `Home` | `/` | client route (`main.tsx:37-38`) |
| `Explore Guardians` | `/explore` | client route (`main.tsx:39-40`) |
| `Design Studio` | `/design` | client route (`main.tsx:41-42`) |
| `Docs & Architecture` | `/docs` | client route (`main.tsx:43-44`) |

**Group 2 — For developers**
| Label | `href` | Backing |
|---|---|---|
| `Design system overview` | `/design.html` | static file copied by `scripts/build.js:22-27` (8,870,252 B — link carries the visible caption `large static page`) |
| `Service health` | `/health` | server route `GET /health` |
| `Example profile` | `/octocat` | `/:username` client route |
| `README badge (example)` | `/badge/octocat.svg` | server route `GET /badge/:username.svg` |
| `Share card (example)` | `/og/octocat.png` | server route `GET /og/:username.png` |

Beneath this group, as **plain non-link monospace text** (not hyperlinks, because no public repository URL is verified): `Reference docs in the repository: docs/prd.md · docs/system-architecture.md · docs/design-guidelines.md · docs/roadmap.md`. These are real repository file paths; they are printed rather than linked precisely so the footer never contains an `href` that cannot be resolved.

**Group 3 — From the creator**
| Label | `href` | Backing |
|---|---|---|
| `AgentKit.best` | `https://agentkit.best` | verified HTTP 200 |
| `NextLevelBuilder.io` | `https://nextlevelbuilder.io` | verified HTTP 200 |
| `GoClaw.sh` | `https://goclaw.sh` | verified HTTP 200 |
| `UI UX Pro Max Skill` | `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` | verified HTTP 200 |

**Group 4 — Status (text, not links)**
- `Pre-launch. No Guardians hatched yet.`
- `Early Access: {remaining}/{total} slots left` — same single quota fetch, same degraded rule as §7 (renders `Early Access status unavailable` when `degraded: true`, never a bare `0`).
- `No analytics key configured — this page sets no analytics cookie and contacts no analytics host.`

**Conditional slot — source code.** A `Source on GitHub` link to `https://github.com/bestagentkits/githatch` (the configured git origin) is rendered **only if** a controller records an HTTP 200 for that URL in `plans/reports/screenshots/evidence-manifest.json`. It is not verified in the evidence packet, and a private or renamed repository would make it a broken footer link — the exact class of defect that must not ship. Absent that recorded 200, the slot is omitted entirely. `https://github.com/mrgoonie/githoot` does not exist and is never used.

**Credit bar** (last row, centered, `JetBrains Mono` 11–12px, `--text-muted`):

`Made with ❤️ by AgentKit.best`

Rendered verbatim, with `AgentKit.best` as the anchor text linking to `https://agentkit.best`. Directly above it, the tagline `A developer discovery network disguised as a fantasy companion game.` and `Zuey · @goon_nguyen` as plain text (no social URL is verified).

**Footer mobile layout.** Four groups stacked in a single column at 375px, each group heading a micro label and each link row 44px tall with a 12px vertical gap; the status group renders as a stacked definition list; the credit bar sits alone at the bottom with 32px of block padding. At 768px the groups become a 2x2 grid; at 1440px a single 4-column `repeat(4, minmax(0, 1fr))` row with the status group spanning the full width beneath.

# 10. Approach comparison

**Approach A — Static-first narrative page: CSS-driven hero, one deferred WebP demo.**
The hero is entirely CSS (URL morph, CSS egg) plus one small poster still; the 286,362 B strip loads only on intersection; everything else is CSS and type.
- *Most-dependent assumption:* a 16-frame `steps()` sprite player plus a well-written first viewport is enough spectacle to satisfy "impressive animations, first impression is critical."
- *Fails first when:* a reviewer opens the 375px first viewport and finds it visually flat before the demo scrolls into view — the hero's only motion is text and a CSS glow.
- *Worst plausible case:* the page is honest, fast, fully accessible, and reads as a competent developer-tool landing page rather than a game trailer. The spectacle ask is met one scroll late instead of immediately. No truth, budget, or accessibility criterion is at risk.

**Approach B — Cinematic hero: the 16-pose sequence plays in the first viewport, scroll-scrubbed.**
The strip becomes the hero image; scroll position drives the frame index; the URL swap overlays it.
- *Most-dependent assumption:* 286,362 B is acceptable inside the first viewport on mobile, and a scroll-scrubbed sprite reads as intentional rather than janky on a mid-range phone.
- *Fails first when:* the first-viewport network gate runs — Budget A jumps from ≤ 117,897 B to 77,897 + 286,362 = 364,259 B (a 3.09x increase over Budget A′s font-free total, computed as 364,259 ÷ 117,897) and the largest contentful paint becomes a 286 KB image on a mobile connection. Second failure: under `prefers-reduced-motion` the hero collapses to one static frame and the entire first impression evaporates, so a reduced-motion visitor gets a strictly worse page than in Approach A, where the reduced-motion hero is the *same* hero.
- *Worst plausible case:* a slow, image-blocked first viewport where the Guardian arrives after the fold has already been judged, plus a scroll handler competing with native scrolling on low-end Android. Highest ceiling, highest chance of failing the gate that matters most.

**Approach C — Generative hero: canvas/WebGL particle field with the CSS egg composited in.**
Uses the existing `utils/particles.ts` and a canvas layer for depth and light.
- *Most-dependent assumption:* a canvas layer can be added without a library, without measurable main-thread cost on mobile, and without breaking the reduced-motion contract.
- *Fails first when:* a particle loop runs a `requestAnimationFrame` on a 375px device behind React's first render — either the JS bundle grows past the measured 76,342 B gzip baseline with no offsetting narrative gain, or the canvas must be disabled under reduced motion, leaving an empty rectangle where the hero art was.
- *Worst plausible case:* battery drain and jank on the exact devices the mobile-first constraint prioritizes, plus a bundle-size regression that must be itemized against criterion 5, in exchange for atmosphere that a static gradient already supplies within the token system.

**Smallest sufficient recommendation: Approach A.** It is the only one of the three that satisfies the first-viewport network gate, the reduced-motion contract, and the mobile-first constraint without trade-off, and it still delivers the vivid demo the user asked for — one scroll down, at full 16-frame fidelity, with slow-motion and a frame scrubber that a cinematic autoplay hero cannot offer. The spectacle is not reduced; it is relocated to where it can be afforded and controlled. Adopt A, and if the demo section measurably fails to hold attention, promote the player into the hero as a *second* iteration with the 286,362 B cost accepted explicitly and re-measured — never as an unstated default.

**Cheapest to abandon: Approach C.** It is a self-contained canvas layer behind the hero; deleting it removes one component and one CSS layer and changes no copy, no route, no link, no event, and no measured byte in the critical entry. Approach B is the most expensive to abandon, because promoting the strip into the hero rewrites the hero's layout, its loading strategy, its reduced-motion fallback, and its first-viewport budget line simultaneously — which is precisely why it should not be the starting point.

**Also considered and rejected as scope inflation:** repairing the `InteractiveCompanionShowcase` id/filename mismatch (it would make the landing eligible to pull 6,539,997 B and is unnecessary once the component is unused), generating 16-pose sequences for the other seven archetypes (new Gemini cost for a marketing page), and excluding `design.html` from the build for a further 8,870,252 B saving (24,018,883 − 8,870,252 = 15,148,631 B) — worthwhile but it removes a URL that may be linked externally, so it is proposed separately rather than bundled here.

# 11. Unresolved questions

1. **Is `https://github.com/bestagentkits/githatch` publicly reachable?** It is the configured git origin, but the evidence packet verifies only five external URLs and this is not among them. A private or renamed repository makes any `Source on GitHub` footer link broken on arrival. Until a controller records an HTTP 200, the footer slot stays omitted (§9). Answering this requires one HTTP check that is outside read-only scope here.
2. **PostHog project key, host region, and data-residency choice.** No key exists, so the taxonomy ships as a no-op wrapper. The key, the region host, and whether EU residency is required cannot be derived from the repository.
3. **Do the four Vietnamese page bodies (`/explore`, `/design`, `/docs`, `/:username`, plus `HatchWaitPage`) get translated in this delivery, or does it stop at `/`?** This contract stops at `/` plus the shared navbar and footer, and marks the untranslated pages with `lang="vi"` so the language boundary is honest rather than hidden. Whether the user wants the full sweep is a scope decision only they can make.
4. **At what point in the claim lifecycle is a `users` row created?** A `guardians` row is written inside the claim transaction (`src/server/services/claim/transaction.ts:110`), so `count(*) FROM guardians` is a defensible "Guardians hatched". Whether `count(*) FROM users` equals "developers with a Guardian" depends on whether a user row can exist without a completed claim — this must be confirmed against the OAuth handler before that number is ever published, and it affects only the future `/api/stats/public` labels, not this delivery.
5. **Is `EGG_MANIFEST.spritesheetPath` (`/eggs/**/spritesheet.webp`) intended to be generated later, or is it stale config to delete?** Nothing reads it and no backing file exists. This landing page depends on neither answer, but the field will keep attracting false byte budgets until it is resolved one way or the other.

---

# Ranking Appendix (ultra verifier)

| Rubric criterion | **Winner** | B | C | D | E |
|---|---:|---:|---:|---:|---:|
| 1. Faithfulness | **19** | 18 | 12 | 15 | 13 |
| 2. Evidence grounding | **19** | 15 | 12 | 15 | 14 |
| 3. Acceptance sharpness | **18** | 16 | 13 | 13 | 14 |
| 4. Honesty about unknowns | **20** | 17 | 9 | 16 | 16 |
| 5. Conversion clarity / CTA truth | **19** | 16 | 16 | 14 | 19 |
| 6. Trust / data-state integrity | **20** | 17 | 11 | 15 | 14 |
| 7. Demo fidelity / payload discipline | **18** | 16 | 14 | 12 | 17 |
| 8. Responsive / accessible proof | **20** | 18 | 17 | 15 | 17 |
| 9. Shared-surface / route integrity | **19** | 13 | 18 | 14 | 13 |
| 10. Measurement usefulness | **20** | 19 | 18 | 18 | 18 |
| 11. Narrative discrimination | **19** | 18 | 13 | 16 | 19 |
| **Total /220** | **211** | 183 | 153 | 163 | 174 |

**Why this candidate won.** It was the only contract combining a feasible poster-first
375px hero, a deferred single-asset `neonbyte` demo, explicit degraded-quota semantics, a
complete per-number source map, route-language boundary checks, and a **conditional**
rather than assumed repository link. It alone treated the filtered `dist/` figure of
24,018,883 B as a same-source expectation plus the rewritten-entry delta, rather than as
an invariant ceiling.

**Why the others lost.** B (183) and E (174) each committed a hard truth-rule-7 failure by
shipping an unverified `bestagentkits/githatch` footer link; E additionally omitted the
requested author quote. D (163) tried to fit navbar, full proposition, input, permanence
line and a square 286 KB demo into one 375x812 viewport, swapped the packet-backed
`steps(15)` player for `steps(16)`, and used a manipulative CTA. C (153) asserted "We
launched yesterday", contradicting the binding pre-launch state.

**Verifier repo spot-checks that corroborated the packet:** single quota fetch at
`src/client/main.tsx:26-31`; sole global header and misleading `Hatch →` at
`src/client/components/Navbar.tsx:29,70-112`; ambiguous fallback at
`src/server/index.ts:57-81`; eager sheet load at `InteractiveCompanionShowcase.tsx:36-64`;
eight mounts and fixed grid at `HomePage.tsx:129,184-187`; unfiltered asset copy at
`scripts/build.js:21-34`. Independent measurement matched: strip 286,362 B, `dist/`
34,835,846 B, entry 847/2,741/260,803 B, worker 118,128 B, `design.html` 8,870,252 B.

# Residual weaknesses to watch during implementation

1. **Motion-token inconsistency.** The contract claims only 100–150 / 200–300 / 800–1200ms
   bands while also specifying 4,400ms slow-motion and an existing 1,500ms quota pulse.
   Treat these as explicit ambient/user-controlled exceptions or the duration acceptance
   gate contradicts the design.
2. **Estimated transfer lines are gates, not facts.** Poster ≤40,000 B, fonts ≤90,000 B,
   avatar ≤12,000 B must be measured post-build. The network manifest should include the
   Google Fonts stylesheet and the quota response, not only itemized image/font bodies.
3. **Nullable quota cutover.** Setting `claimed`/`remaining` to `null` on degradation
   requires updating `EarlyAccessStatus` and every consumer. Today the client catch leaves
   `quota === null` silently (`main.tsx:31`); the degraded state needs an explicit
   transition.
4. **375x812 feasibility is prose, not proof.** Sticky navbar plus four above-fold
   comprehension elements plus poster must pass the contract's own screenshot/rect checks
   before acceptance.
5. **Creator quote needs owner approval.** Zuey is correctly framed as creator attribution,
   but the first-person quote is proposed copy — confirm before publishing.
6. **Intentional language seam.** `/explore`, `/design`, `/docs` and profile content stay
   Vietnamese and are marked `lang="vi"`. Preserve that boundary; do not imply they were
   translated.

# Run provenance

Four waves were required. Waves 1–3 were discarded, for two mechanical defects now fixed:

- **Waves 1–2** ran on the `task` tier (`gemini-3.7-flash`), not the Opus tier the ultra
  protocol requires when per-agent routing exists.
- **All of waves 1–3** never received the evidence packet: the `task` tool's `context`
  field is not delivered to subagents in this runtime, so candidates invented facts they
  had no way to know. Verified at `OpusCandThree.jsonl:6`, whose only user message was the
  bare Target/Change/Acceptance block.

Wave 4 fixed both: `task.agentModelOverrides` pinned candidates to
`anthropic/claude-opus-5:high` (verified per-transcript), and the full 19,880-byte packet
was embedded inline and byte-identical in all five task prompts (verified present in every
transcript). Candidate staging was ephemeral, outside the repo, with a crypto-random
anonymization mapping, and was deleted after selection.

# Known limitation of this run's evidence packet

**The measured fact surface covered local build output only, not remote bytes, and never
declared a single budget basis.** Two consequences, only the first of which is
critical-path:

1. `index.html:7-9` loads three Google Font families across seven weights
   (`Archivo` 700/900, `JetBrains Mono` 500/700, `Schibsted Grotesk` 400/600/700) from
   `fonts.googleapis.com`. Those bytes are **not** in the `dist/` figures the packet
   supplied, so no candidate could measure them.
2. The Zuey avatar source is remote and measures 282,949 B, and the packet never framed it
   as a transfer-basis question. The accepted contract resolves it correctly on its own:
   the image is downscaled locally to a 96x96 WebP (`[ESTIMATE]` <=12,000 B) via the
   existing `sharp` devDependency and carries `loading="lazy"` plus `decoding="async"` in
   the Creator block (sections 7 and 8), so it never sits on the critical path. The gap was
   in the packet's framing, not in the winner's handling.

The packet also mixed raw, gzip, and on-disk figures without naming one authoritative
basis (raw vs gzip vs browser transfer). The winning contract handled this correctly by
labelling fonts <=90,000 B, avatar <=12,000 B and poster <=40,000 B as `[ESTIMATE]` caps
with stated measurement methods rather than inventing values, and the verifier flagged the
same gap as residual weakness 2. The outcome is therefore sound, but a future packet MUST
declare one budget basis and either supply measured remote bytes or require candidates to
self-host, subset, lazy-load, or exclude unmeasured remotes behind labelled target caps.

# Correction on candidate eligibility

An earlier summary of this run described the winner as the only candidate passing every
hard truth rule. That is wrong. The verifier marked **three** candidates PASS on all eight
hard truth rules - the winner, C, and D. Only **B** and **E** failed, both on rule 7
(an unverified `bestagentkits/githatch` footer link). The winner was selected on rubric
quality (211/220 against a 183 runner-up), not on being uniquely eligible; C (153) and
D (163) lost on binding-state and quality defects, not on hard-rule eligibility.
