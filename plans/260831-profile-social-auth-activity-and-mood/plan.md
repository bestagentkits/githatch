# Plan: Profile Social Share Cards, Auth Navigation, Live Activities, Pet Mood Animations & Repositories Dossier

## 1. Summary
Upgrade GitHoot's public profile experience, social sharing viral loop, global navigation authentication, and developer dossier:
- **Dynamic OpenGraph & Social Thumbshare**: Redesign `/og/:username` into a high-impact Cyber-Arcade social card (neon borders, guardian artwork, developer stats, rarity aura). In `SocialSharePanel.tsx`, add a 1-click **Share to Facebook** button alongside 𝕏 and LinkedIn. In server entrypoint, inject dynamic OpenGraph/Twitter meta tags into SPA HTML for crawlers (`facebookexternalhit`, `Twitterbot`, `LinkedInBot`, etc.).
- **Global Navbar Auth & Profile State**: Add a Cyber-Arcade Login / Profile button to the global `<Navbar />`. Implement `/api/auth/me` to read the signed session cookie and return the authenticated user `{ authenticated: boolean, user: { login, name, avatar_url } | null }`. When logged in, render the user's avatar and `@username` linking to their personal guardian profile, with a dropdown / logout action.
- **Profile Activities Feed Card**: Add a live "Recent Realm Activities" card on `PublicProfilePage.tsx` displaying real GitHub events (PushEvents, PullRequests, Issues, Releases) with relative time, repo links, and commit summaries.
- **Pet Mood State & Dynamic Animations**: Connect `calculateGuardianMood(lastActiveTimestamp)` to the living guardian stage. Render mood-specific CSS animations (`float-energetic` with sparking aura, `float-idle` with gentle breathing, `float-sleepy` with amber glow, `float-hungry` with hunger alert) and interactive mood descriptions.
- **Highlighted & Most Active Repositories Card**: Display top starred repositories, active projects with stars, forks, primary language badges, and private repo indicators when authenticated.
- **Honest XP Progression Contract**: Remove the arbitrary `Math.max(5, ...)` XP bar filler and invent no fake thresholds. Render a mathematically sound progression meter.

## 2. Affected Files
- `src/server/routes/og.ts`: High-res Cyber-Arcade SVG card generator.
- `src/server/routes/auth.ts`: Set signed HttpOnly session cookie on OAuth success; add `/api/auth/me` and `/auth/logout`.
- `src/server/services/github/resolver.ts`: Ingest user repositories, recent public events (`activities`), and last active timestamp.
- `src/server/index.ts`: Dynamic meta tags injection for SPA route requests.
- `src/server/types/index.ts`: Expand `ResolvedProfile` and `GuardianSummary` contracts for activities, repos, and mood details.
- `src/client/components/Navbar.tsx`: Login button vs. User Profile status and menu.
- `src/client/components/SocialSharePanel.tsx`: Facebook, 𝕏, LinkedIn, and README Markdown copy buttons.
- `src/client/pages/PublicProfilePage.tsx`: Activities card, Highlighted/Active Repos card, dynamic Pet Mood animations, honest XP meter.
- `src/client/styles/responsive.css`: Animations (`@keyframes float-energetic`, `float-idle`, `float-sleepy`, `float-hungry`), share grid, repo cards, activity timeline CSS.
- `tests/unit/resolver-and-quota.test.ts`: Unit tests for OG generator, session verification, and activity ingestion.

## 3. Implementation Steps
1. **Types & Server Contracts**:
   - Define `GitHubRepo`, `UserActivity`, `UserSession` in `src/server/types/index.ts`.
2. **Resolver Enhancements**:
   - In `src/server/services/github/resolver.ts`, fetch recent events and repositories, sorting highlighted and active repos, and calculating mood details.
3. **Session & Auth Endpoints**:
   - In `src/server/services/auth/oauth.ts` & `src/server/routes/auth.ts`, create `createSessionCookie`, `verifySessionCookie`, `/api/auth/me`, `/auth/logout`, and set cookie in `/auth/callback`.
4. **OpenGraph & Crawler HTML Meta Tags**:
   - Upgrade `src/server/routes/og.ts` with Cyber-Arcade SVG styling.
   - Update `src/server/index.ts` to inject `<meta property="og:..." />` and `<meta name="twitter:..." />` when serving SPA pages for profile routes.
5. **Client Components & Profile Enhancements**:
   - Update `Navbar.tsx` to query `/api/auth/me` and render Login or Profile button with avatar.
   - Update `SocialSharePanel.tsx` with Facebook share button and 3-column share grid.
   - Update `PublicProfilePage.tsx` with Activities timeline, Highlighted/Active Repos, dynamic pet mood animations, and honest XP meter.
   - Add styling in `responsive.css`.
6. **Tests & Quality Verification**:
   - Update unit test suite in `tests/unit/resolver-and-quota.test.ts`.
   - Run `npm run build && npm run typecheck && npx vitest run && npm test`.
   - Take browser screenshots of all updated states.

## 4. Verification & Validation
- Run unit tests (`npx vitest run`) -> 100% pass.
- Run autonomous QA (`npm test`) -> 100% pass.
- Browser test `/mrgoonie` and `/octocat` to verify Activities, Repos, Pet Mood animations, and Facebook share link.
- Consult Kongming for formal verification signoff.
