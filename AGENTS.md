# GitHoot Developer & Agent Instructions (`AGENTS.md`)

## 1. Project Overview & Architecture

**GitHoot** (`githoot.com`) is a gamified developer identity and discovery layer built on top of GitHub. It converts public GitHub activity into an interactive fantasy companion (Guardian) with AI-crafted eggs, spritesheet animations (Gemini Nano Banana 2), Gacha reveal rituals, and dynamic social share cards.

- **Domain:** `githoot.com` (DNS & CDN on Cloudflare).
- **Core Strategy:** Edge-First Serverless architecture with zero server maintenance cost.
- **Active Implementation Plan:** `plans/260829-2354-githoot-mvp-implementation/` (8 phases).
- **Design System:** Option 1 (Cyber-Arcade Fantasy) with `Archivo` + `JetBrains Mono` fonts.

---

## 2. Technology Stack & Key Tools

- **Runtime & Package Manager:** `Bun` (v1.1+).
- **Backend / Edge Framework:** `Hono` on Cloudflare Pages / Workers.
- **Database:** Cloudflare `D1` (Serverless SQLite).
- **Asset Storage:** Cloudflare `R2` (Bucket: `githoot`, Custom Domain: `cdn.githoot.com`).
- **Caching:** Cloudflare `KV` (Namespace: `GITHOOT_CACHE`).
- **AI Image Generation:** Google Gemini `nano-banana-pro-preview` / `nano-banana-2` (Dev: `nano-banana-2-lite`).
- **Image Processing (Edge WASM):** `@silvia-odwyer/photon` / Connected Component analysis for contour slicing & green de-spill.
- **Client Framework:** React / Vite or TanStack on Cloudflare Pages.

---

## 3. Critical Invariants & Non-Derivable Gotchas

1. **GitHub API Anti-Throttling (Never assume 5,000 req/hr is enough):**
   - Unauthenticated `/:username` visits MUST be served from Cloudflare KV (Stale-While-Revalidate).
   - All outgoing requests to GitHub API must rotate tokens from `token-pool`.
   - If GitHub returns `429` or `403`, the system MUST gracefully fall back to **Degraded Seed Mode** (generate egg from `SHA-256(username)` without throwing 500 errors).

2. **AI Generation Cost Gate (Never call AI for anonymous visitors):**
   - Anonymous profile visitors ONLY see deterministic Canvas/SVG eggs (0 AI cost).
   - Only authenticated users via GitHub OAuth within the first 100 Early Access slots (or verified payment/credit) trigger Gemini Nano Banana 2 API calls.
   - 1 GitHub ID = 1 Guardian DNA. Never allow free rerolls.

3. **Sprite Grid Slicing & Alpha Masking (Image models drift pixels):**
   - Gemini Nano Banana 2 produces 4x2 grid images on `#00FF00` chroma background.
   - **Never slice with fixed pixel offsets** (e.g. `col * 256`). Always use **WASM Smart Bounding-Box Detection** to locate actual character contours and center them onto `256 x 256 px` frames.
   - Always run the **Green De-Spill filter** ($g = \min(g, (r+b)/2)$) to remove green halo fringes before saving transparent WebP assets to R2.

4. **Cloudflare Runtime Secrets (CI Shell `env:` is NOT runtime):**
   - Passing secrets in GitHub Actions `env:` only sets them in the CI runner.
   - Production secrets (`GEMINI_API_KEY`, `GITHUB_TOKENS`, `AUTH_SECRET`, `R2_*`) must be bound explicitly to Cloudflare Pages Functions using `wrangler pages secret put <KEY> --project-name=githoot`.

5. **Evidence-First Verification Loop (Zero Assumptions):**
   - Every verification claim in Phase 8 MUST include concrete screenshot evidence saved in `plans/reports/`.
   - The test & fix loop is overseen by the `kongming` subagent and only terminates on a formal **GO Verdict** with 0 defects.

---

## 4. DOs & DON'Ts

### DOs
- **DO** use Cloudflare KV Stale-While-Revalidate (SWR) cache and the Token Pool manager for all public `/:username` queries to achieve sub-30ms cache hits.
- **DO** fallback gracefully to deterministic SHA-256 seed rendering (Degraded Mode) whenever GitHub API returns a 429 rate limit or 403 forbidden status.
- **DO** gate Gemini Nano Banana 2 API calls strictly behind GitHub OAuth within the 100 free Early Access quota (or verified payment/voucher for slot 101+).
- **DO** use WASM Smart Bounding-Box Detection (connected components) to detect character contours, center them on 256x256 frames, and apply the Green De-Spill filter ($g = \min(g, (r+b)/2)$) before uploading WebP assets to R2.
- **DO** bind production runtime secrets directly to Cloudflare Pages Functions using `wrangler pages secret put` in the CI/CD workflow.
- **DO** strictly follow the Option 1 (Cyber-Arcade Fantasy) Design System: `Archivo` headers, `JetBrains Mono` numbers/stats, 4pt spacing scale, and neon cyan/magenta glowing accents.
- **DO** back all verification claims with fresh screenshots, network timing metrics, and console error logs, requiring formal **GO** signoff from `kongming` in Phase 8.

### DON'Ts
- **DON'T** call AI image generation models on anonymous unauthenticated page views — anonymous visitors must only receive 0-cost Canvas/SVG pre-generated eggs.
- **DON'T** slice AI multi-pose sprite grids with naive fixed-pixel offsets, which causes clipped limbs and drifting frames.
- **DON'T** rely on CI runner environment variables (`env:`) to pass runtime secrets to Cloudflare Edge Functions.
- **DON'T** build heavyweight features out of scope (e.g. Arena combat, in-game store/inventory, Guilds, or real-time webhook ingestion) during the MVP phase.
- **DON'T** allow free DNA rerolls for the same GitHub user ID — 1 GitHub ID equals 1 immutable Guardian.
- **DON'T** penalize users or kill pets during periods of GitHub inactivity — only adjust visual mood (Tamagotchi positive reinforcement).
- **DON'T** assume any feature or layout works without concrete browser-driven visual evidence (Zero Assumptions rule).
