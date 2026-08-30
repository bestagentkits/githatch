# Marketing Website Redesign Implementation Plan

**Goal:** Implement the accepted GitHoot marketing website redesign from scratch across the edge server, client pages, navigation, and subpages according to the accepted contract (`plans/reports/brainstorm-260830-marketing-website-redesign-ACCEPTED.md`).

**Status:** IN_PROGRESS  
**Mode:** Official (Stable)  
**Route:** Feature via `/ak:cook`  
**Supervision:** `--advice` (Kongming)

---

## Phases

| Phase | File | Focus | Deliverables |
|---|---|---|---|
| **Phase 1** | `phase-01-edge-and-assets.md` | Server Endpoint & Asset Pipeline | Update `/api/early-access/status` with nullable `claimed/remaining` on degraded; add `/api/config`; filter `scripts/build.js` asset copy; copy optimized poster (37.8 KB) and avatar (2.35 KB) assets. |
| **Phase 2** | `phase-02-homepage-and-design-system.md` | Core Homepage & Stylesheet | Rewrite `HomePage.tsx` with all 8 sections (Hero 800ms URL morph, 16-pose landing player with scroll-to-top CTA, How It Works, 8 Archetypes & published odds, Launch Status trust table, Creator block, Early Access dot matrix, Roadmap) in Option 1 Cyber-Arcade Fantasy; update `responsive.css`. |
| **Phase 3** | `phase-03-subpages-and-navigation.md` | Global Navigation, Footer & Subpages | Update `Navbar.tsx` (mobile drawer, persistent quota, `Preview` CTA); create `Footer.tsx` with tagline, repo docs list, 44px touch targets, verified links and credit line; translate `DocsPage.tsx`, `ExplorePage.tsx`, `DesignSystemPage.tsx`, `HatchWaitPage.tsx` to English. |
| **Phase 4** | `phase-04-verification-and-ship.md` | Testing, Quality Gates & Kongming Signoff | Run `typecheck`, `vitest`, `build`, `autonomous-qa`; capture multi-viewport screenshots (1440, 768, 375, menu-open, degraded/healthy D1); Kongming advisory signoff; ship PR. |

---

## Full Contract Acceptance Criteria (39/39)

### Quality Gates & Build
1. `npm run typecheck` exits with 0 TypeScript errors.
2. `npx vitest run` passes 100% of unit tests.
3. `npm run build` succeeds (Vite client + esbuild worker). If Vite fails, build exits nonzero.
4. `dist/` excludes unreferenced dead weight (`*-gemini-raw.jpg`, `landing16-frames/`, `*-landing16-*.png`), reducing total build size by ~10.8 MB.
5. `npm test` (`scripts/run-autonomous-qa.ts`) passes all assertions.

### Viewports & Layout Proof
6. Zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) at 1440px, 768px, and 375px.
7. Mobile 375x812 first viewport displays what GitHoot is, URL morph, 50/50 visual pair, and `Preview` submit CTA above 812px height (`bottom <= 812px`).
8. Desktop 1440x900 first viewport displays all above-fold elements without vertical scroll.
9. Reduced-motion (`prefers-reduced-motion: reduce`) disables vibration, egg shake, and locks 16-pose player on frame 16 (`hero_stance`).
10. First viewport resource trace contains exactly 1 image download (`neonbyte-poster.webp`, 37.8 KB).

### Interactive Demos & Animations
11. 16-pose landing player runs `steps(15)` at 1.1s (normal) and 4.4s (slow-mo), holding on frame 16 (`hero_stance`).
12. 16-pose background strip (286 KB) is lazy-loaded via `IntersectionObserver` when Section 2 enters viewport.
13. Frame scrubber (1-16) updates background position and displays live pose name.
14. Section 2 contains working scroll-anchor CTA `Preview your own profile ↑` that focuses hero input.
15. Pure CSS egg wobbles on click without triggering image downloads or server AI calls.
16. Archetype grid tabs are semantic `<button type="button" role="tab">` with `aria-selected` and visible focus rings.

### Trust Architecture & Server Endpoints
17. `GET /api/config` returns public configuration (`quota_total`, `free_until`, `charge_after_usd`, `posthog_configured`, `analytics_enabled`, `environment`, `domain`, `cdn_domain`).
18. `GET /api/early-access/status` returns nullable `claimed: null, remaining: null, degraded: true` on DB failure/catch.
19. S5 Launch Status table renders exact contract copy for unmeasured metrics without numeric fake data.
20. S5 Early Access row shows live D1 count when healthy, and explicit degraded notice when DB unavailable.
21. S7 Early Access dot matrix renders 100 dots with claimed slots highlighted when healthy, or warning box when degraded.
22. Fixed Genesis drop odds published up front (Common 60%, Rare 25%, Epic 10%, Legendary 4%, Mythic 1%).
23. Early Access $0.99 pricing after slot 100 disclosed plainly.
24. Creator block displays Zuey attribution, verified byline, and lazy WebP avatar (2.35 KB).

### Navigation, Routes & Links
25. Exactly one global `<header className="githoot-header">` rendered across all pages.
26. Mobile navbar on ≤640px displays persistent quota line under brand, and 44x44px toggle button opening accessible drawer panel.
27. Navbar search CTA labeled `Preview` (not misleading `Hatch →`).
28. All interactive touch targets on mobile meet minimum 44x44px (`min-height: 44px`).
29. Client route `/octocat` navigates cleanly to `<PublicProfilePage username="octocat" />` via `resolveRoute` without falling back to homepage.
30. Browser `popstate` back/forward navigation keeps URL and rendered route synchronized.
31. Footer renders 4-column inventory with verified URLs and tagline.
32. Footer includes plain-text repository docs list (`docs/prd.md · docs/system-architecture.md · docs/design-guidelines.md · docs/roadmap.md`).
33. Footer renders conditional `Source on GitHub` link backed by recorded HTTP 200 check in `evidence-manifest.json`.
34. Footer renders exact verbatim credit: `Made with ❤️ by AgentKit.best`.
35. Subpages (`/docs`, `/explore`, `/design`, `/profile`, `HatchWaitPage`) render in English with Cyber-Arcade styling.
36. `DocsPage.tsx` contains anchor IDs (`#architecture`, `#api-reference`, `#determinism`) for clean navigation.

### Telemetry & Privacy
37. No `posthog-js` SDK in `package.json`; privacy-preserving `trackEvent` wrapper implemented in `src/client/utils/analytics.ts`.
38. Event taxonomy allow-list recorded in `plans/reports/screenshots/landing-events.json` with zero PII (no usernames or emails).
39. When `posthog_configured` is false, zero outbound analytics network requests occur.
