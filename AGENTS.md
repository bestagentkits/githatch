# GitHoot Developer & Agent Instructions (`AGENTS.md`)

## 1. Project Overview & Architecture

**GitHoot** (`githoot.com`) is a gamified developer identity and discovery layer built on top of GitHub. It converts public GitHub activity into an interactive fantasy companion (Guardian) with AI-crafted eggs, spritesheet animations (Gemini Nano Banana 2), Gacha reveal rituals, and dynamic social share cards.

- **Domain:** `githoot.com` (DNS & CDN on Cloudflare).
- **Core Strategy:** Edge-First Serverless architecture with zero server maintenance cost.
- **Active Implementation Plan:** `plans/260829-2354-githoot-mvp-implementation/` (8 phases).

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
- **Design System:** Option 1 (Cyber-Arcade Fantasy) with `Archivo` + `JetBrains Mono` fonts.

---

## 3. Essential Commands

```bash
# Dependencies & Setup
bun install

# Local Development (Cloudflare Pages/Worker + D1/KV local emulation)
bun run dev
# or
npx wrangler pages dev dist --d1=githoot_db --kv=GITHOOT_CACHE

# Quality & Type Checking
bun run typecheck
bun run lint
bun test

# D1 Database Migrations
npx wrangler d1 migrations apply githoot_db --local       # Local dev
npx wrangler d1 migrations apply githoot_db_prod --remote # Production

# Autonomous Plan & Implementation
ak plan status ./plans/260829-2354-githoot-mvp-implementation
ak plan validate ./plans/260829-2354-githoot-mvp-implementation
/ak:cook plans/260829-2354-githoot-mvp-implementation
```

---

## 4. Critical Invariants & Non-Derivable Gotchas

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

## 5. Directory Structure & Conventions

```text
├── .github/workflows/          # CI/CD (deploy.yml on push main)
├── assets/sample-pets/         # Pre-generated sample pet references
├── docs/                       # Evergreen specifications & guidelines
│   ├── prd.md                  # Product requirements & viral loop
│   ├── system-architecture.md  # Cloudflare Edge architecture & D1 schema
│   ├── roadmap.md              # 8-phase execution roadmap
│   └── design-guidelines.md    # Cyber-Arcade design tokens & typography
├── plans/                      # Actionable implementation plans
│   └── 260829-2354-githoot-mvp-implementation/ # Active 8-phase plan
├── src/
│   ├── client/                 # Frontend components, Canvas players, Web Audio
│   └── server/                 # Hono API routes, GitHub resolver, AI pipeline
├── githoot-design-overview.html # Interactive HTML design & simulator showcase
└── wrangler.toml               # Cloudflare Pages/Worker bindings (D1, R2, KV, Queues)
```
