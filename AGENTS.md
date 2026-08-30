# GitHoot Developer & Agent Instructions (`AGENTS.md`)

## 1. Project Overview & Architecture

**GitHoot** (`githoot.com`) is a gamified developer identity and discovery layer built on top of GitHub. It converts public GitHub activity into an interactive fantasy companion (Guardian) with AI-crafted eggs, spritesheet animations (Gemini Nano Banana 2), Gacha reveal rituals, and dynamic social share cards.

- **Domain:** `githoot.com` (DNS & CDN on Cloudflare).
- **Core Strategy:** Edge-First Serverless architecture with zero server maintenance cost.
- **Active Implementation Plan:** `plans/260829-2354-githoot-mvp-implementation/` (8 phases).
- **Design System:** Option 1 (Cyber-Arcade Fantasy) with `Archivo` + `JetBrains Mono` fonts.

---

## 2. Essential Commands & Tooling
```bash
# Development (Edge worker with D1/KV/R2 on port 8788; Vite dev on 5173 with /api proxy)
npm run dev          # wrangler pages dev dist --d1=githoot_db --kv=GITHOOT_CACHE --r2=githoot --port=8788

# Quality Gates & Verification
npm run typecheck    # tsc --noEmit (0 type errors required)
npx vitest run       # Unit test suite (15/15 tests)
npm test             # Autonomous QA runner (scripts/run-autonomous-qa.ts)

# Build & Deployment
npm run build        # React Client (Vite) + Edge Worker (esbuild) to dist/
npm run deploy       # Direct deploy to production master branch on Cloudflare Pages
```

---

## 3. Critical Invariants & Non-Derivable Gotchas

1. **GitHub Multi-Tier Resolution & Anti-Throttling:**
   - **Tier 1 (Token Pool)**: All outgoing requests to GitHub API must rotate tokens from `token-pool` via `getHealthyGitHubToken(env)`. Parse tokens robustly with `parseTokenPool` (JSON array, CSV, escaped quotes, Bearer prefix).
   - **Tier 2 (Public Scraper Fallback)**: If GitHub API returns 403 or 429 (unauthenticated Cloudflare egress IP rate limit), server falls back to `scrapeGitHubPublicProfile` extracting real user stats, user ID, and top languages.
   - **Guard**: Only derive live DNA if `scraped.userId > 0`. If `userId` cannot be extracted, fall back to `generateDegradedProfile` (never cache degraded profiles as live).
   - **404 Propagation**: Non-existent users MUST return HTTP 404 (`UserNotFoundError`) and be cached negatively in KV (300s TTL) to prevent fake profiles and token-burning on enumeration.
   - **KV SWR**: Cache hits (< 1 hour fresh, 1-24 hours stale) serve sub-30ms responses.

2. **Single Global Navigation Bar & Dev Proxy:**
   - `<Navbar />` is mounted globally in `src/client/main.tsx`. Sub-pages (including `PublicProfilePage.tsx`) MUST NOT render an inner `<header>` or duplicate early access quota fetches.
   - `vite.config.ts` includes `server.proxy` for `/api`, `/badge`, `/og`, `/auth` pointing to worker port 8788.

3. **AI Generation Cost Gate (Never call AI for anonymous visitors):**
   - Anonymous profile visitors ONLY see deterministic Canvas/SVG eggs (0 AI cost).
   - Only authenticated users via GitHub OAuth within the first 100 Early Access slots (or verified payment/credit) trigger Gemini Nano Banana 2 API calls.
   - 1 GitHub ID = 1 immutable Guardian DNA. Never allow free rerolls.

4. **Sprite Grid Slicing & Alpha Masking:**
   - Gemini Nano Banana 2 produces 4x2 grid images on `#00FF00` chroma background.
   - **Never slice with fixed pixel offsets**. Use **WASM Smart Bounding-Box Detection** to locate character contours and center them onto `256 x 256 px` frames.
   - Always apply the **Green De-Spill filter** ($g = \min(g, (r+b)/2)$) before saving transparent WebP assets to R2.

5. **Cloudflare Runtime Secrets Pipeline:**
   - Passing secrets in GitHub Actions `env:` only sets them in the CI runner.
   - Production secrets (`GEMINI_API_KEY`, `GITHUB_TOKENS`, `AUTH_SECRET`, `R2_*`) MUST be bound using direct shell stdin pipe:
     `printf '%s' "$SECRET" | npx wrangler pages secret put <KEY> --project-name=githoot`.
   - Never use `wrangler-action@v3` with multi-line echo commands (prepends `wrangler` and corrupts shell pipes).

6. **Evidence-First Verification Loop (Zero Assumptions):**
   - Every verification claim in Phase 8 MUST include concrete screenshot evidence saved in `plans/reports/screenshots/`.
   - Test & fix loop is overseen by `kongming` and only terminates on a formal **GO Verdict** with 0 defects.

---

## 4. DOs & DON'Ts

### DOs
- **DO** use Cloudflare KV Stale-While-Revalidate (SWR) cache and the Token Pool manager for all public `/:username` queries to achieve sub-30ms cache hits.
- **DO** calculate `total_stars` dynamically from user repositories.
- **DO** propagate HTTP 404 with 300s negative KV caching for non-existent GitHub usernames.
- **DO** gate Gemini Nano Banana 2 API calls strictly behind GitHub OAuth within the 100 free Early Access quota.
- **DO** use WASM Smart Bounding-Box Detection to center sprites on 256x256 frames, applying Green De-Spill ($g = \min(g, (r+b)/2)$).
- **DO** bind production runtime secrets directly using `printf '%s' "$SECRET" | npx wrangler pages secret put <KEY>`.
- **DO** maintain a single global `<Navbar />` in `src/client/main.tsx` and proxy API calls in `vite.config.ts`.

### DON'Ts
- **DON'T** call AI image generation models on anonymous unauthenticated page views.
- **DON'T** duplicate `<header>` or quota fetches inside sub-pages.
- **DON'T** slice AI multi-pose sprite grids with naive fixed-pixel offsets.
- **DON'T** rely on CI runner environment variables (`env:`) to pass runtime secrets to Cloudflare Edge Functions.
- **DON'T** allow free DNA rerolls for the same GitHub user ID — 1 GitHub ID equals 1 immutable Guardian.
- **DON'T** penalize users or kill pets during periods of GitHub inactivity — only adjust visual mood (Tamagotchi positive reinforcement).
- **DON'T** assume any feature or layout works without concrete browser-driven visual evidence (Zero Assumptions rule).
