# GitHoot Developer & Agent Instructions (`AGENTS.md`)

## 1. Essential Commands & Tooling
```bash
# Build & Dev (wrangler serves dist/ — run build before dev on clean clone)
npm run build              # React Client (Vite) + Edge Worker (esbuild) to dist/
npm run dev                # Local Edge Worker + D1 + KV + R2 on port 8788
npx vite                   # Frontend dev server on 5173 (proxies /api, /badge, /og, /auth to :8788)

# Quality Gates & Verification (Definition of Done: typecheck + vitest + npm test)
npm run typecheck          # tsc --noEmit (0 type errors required)
npx vitest run             # Unit tests (resolver, token pool, chroma de-spill, DNA)
npm test                   # Autonomous Edge API & QA runner (scripts/run-autonomous-qa.ts)

# Database & Deploy (Warning: npm run deploy ships straight to live production)
npm run d1:migrate:local   # Apply migrations to local githoot_db
npm run d1:migrate:prod    # Apply migrations to remote githoot_db_prod
npm run deploy             # Deploy dist to production on Cloudflare Pages
```

---

## 2. Critical Invariants & Non-Derivable Gotchas

1. **GitHub Multi-Tier Resolution & Anti-Throttling:**
   - **Tier 1 (Token Pool)**: All outgoing requests to GitHub API rotate tokens via `getHealthyGitHubToken(env)` (`token-pool.ts`). Robustly parsed with `parseTokenPool` (JSON array, CSV, escaped quotes, Bearer prefix).
   - **Tier 2 (Public Scraper Fallback)**: If GitHub API returns 403 or 429, server falls back to `scrapeGitHubPublicProfile` (`resolver.ts:261`), deriving DNA only when `scraped.userId > 0`.
   - **404 Propagation**: Non-existent users MUST return HTTP 404 (`UserNotFoundError`), negatively cached in KV for 300s to prevent token-burning on enumeration.
   - **Total Stars**: `total_stars` is summed dynamically from user repositories (`resolver.ts:107`).
   - **KV SWR**: Cache hits (< 1 hour fresh, 1-24 hours stale) serve sub-30ms responses. Degraded profiles are never cached to KV.

2. **Single Global Navigation Bar & Dev Proxy:**
   - `<Navbar />` is mounted globally in `src/client/main.tsx:101`. Sub-pages (including `PublicProfilePage.tsx`) MUST NOT render an inner `<header>` or duplicate early access quota fetches.
   - `vite.config.ts` includes `server.proxy` for `/api`, `/badge`, `/og`, `/auth` pointing to worker port 8788.

3. **AI Generation Cost Gate (0 cost for anonymous visitors):**
   - Anonymous profile visitors ONLY see deterministic Canvas/SVG eggs (0 AI cost).
   - Only authenticated users via GitHub OAuth within the first 100 Early Access slots (or verified credit) trigger Gemini Nano Banana 2 API calls.
   - 1 GitHub ID = 1 immutable Guardian DNA. Never allow free rerolls.

4. **Sprite Grid Slicing & Alpha Masking:**
   - Gemini Nano Banana 2 produces 4x2 grid images on `#00FF00` chroma background.
   - **Never slice with fixed pixel offsets**. Use **WASM Smart Bounding-Box Detection** to locate character contours and center them onto `256 x 256 px` frames.
   - Always apply the **Green De-Spill filter** ($g = \min(g, (r+b)/2)$) before saving transparent WebP assets to R2 (`chroma-removal.ts:34`).

5. **Cloudflare Runtime Secrets Pipeline:**
   - Secrets MUST be uploaded via direct stdin pipe:
     `printf '%s' "$SECRET" | npx wrangler pages secret put <KEY> --project-name=githoot`.
   - Never use `wrangler-action@v3` command input for secrets (prepends `wrangler` and corrupts shell pipes).

6. **Tamagotchi Inactivity Policy:**
   - Never penalize users or kill pets during GitHub inactivity — only adjust visual mood states (`mood-engine.ts:calculateGuardianMood`).

7. **Evidence-First Verification (Zero Assumptions):**
   - UI and layout claims require fresh browser-driven screenshot evidence saved in `plans/reports/screenshots/`.

8. **Option 1 Design System (Cyber-Arcade Fantasy):**
   - Strictly follow Option 1 Design System: `Archivo` headers, `JetBrains Mono` numbers/stats, 4pt spacing scale, and neon cyan (`#00f0ff`) / magenta (`#ff2a85`) glowing accents.

9. **MVP Scope Boundary (Hard Guard):**
   - NEVER build heavyweight out-of-scope features during MVP: Arena combat, in-game store/inventory, Guilds, or real-time webhook ingestion.

10. **Kongming Supervisory Signoff:**
    - Major verification loops and fix cycles are supervised by subagent `kongming` and require a formal **GO Verdict** with 0 defects before final ship.
