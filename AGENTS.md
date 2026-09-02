# GitHoot Developer & Agent Instructions (`AGENTS.md`)

## 1. Essential Commands & Tooling
```bash
# Build & Dev (wrangler serves dist/ — run build before dev on clean clone)
npm run build              # React Client (Vite) + Edge Worker + Consumer to dist/ & dist-worker/
npm run dev                # Local Edge Worker + D1 + KV + R2 on port 8788
npx vite                   # Frontend dev server on 5173 (proxies /api, /badge, /og, /auth to :8788)

# Quality Gates & Verification (Definition of Done: typecheck + vitest + npm test)
npm run typecheck          # tsc --noEmit (0 type errors required)
npx vitest run tests/unit  # Unit tests (resolver, frame gate, budget, auth, outbox)
npx vitest run --config vitest.workers.config.ts # Real workerd runtime integration tests
node --test .agents/skills/githoot-hatch/scripts/tests/determinism.test.mjs # Determinism tests
npm test                   # Autonomous Edge API & QA runner

# Provenance & Secrets Verification
node scripts/bundle-provenance.mjs verify  # Verify on-disk artifact against recorded SHA-256
node scripts/secret-preflight.mjs all      # Fail-closed check for all required secrets

# Database & Deploy
npm run d1:migrate:local   # Apply migrations to local githoot_db
npx wrangler d1 migrations apply githoot_db --remote # Apply migrations to remote production D1
npx wrangler deploy dist-worker/index.js --no-bundle --config wrangler.worker.toml --env production # Deploy Consumer Worker
npx wrangler pages deploy dist --project-name=githoot # Deploy Client & Pages Functions
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

4. **Sprite Grid Slicing & Alpha Masking (Image models drift pixels):**
   - Gemini Nano Banana 2 produces multi-pose grid images on `#00FF00` chroma background.
   - **Never slice with fixed pixel offsets** (e.g. `col * 256`). Use **Smart Bounding-Box / contour detection** to locate actual character contours and center them onto `256 x 256 px` frames.
   - **Never trust the model to emit an exact grid.** Empirically it returns wrong geometry (asked 4x4, returned 5x4 with dividers) and repeats poses. For multi-pose sets, generate **one pose per API call** and composite the grid locally — that makes geometry deterministic and removes grid-slicing risk entirely.
   - Always apply the **Green De-Spill filter** ($g = \min(g, (r+b)/2)$) before saving transparent WebP assets to R2 (`chroma-removal.ts:34`).
   - Every generated frame MUST pass an acceptance gate before use — reject collage echoes (>4 large components), multi-subject frames (2nd component > 30% of main), too-small subjects (<6% frame fill), and over-wide bboxes (aspect > 3.2). Re-validate cached frames on every run; a cache is never implicitly accepted.
   - Reference-condition every character render on the committed Guardian art (`assets/sample-pets/{id}-gemini-raw.jpg`) so `1 GitHub ID = 1 Guardian DNA` holds. State in the prompt that the reference is style/identity ONLY (do not copy its layout, panels, labels, or poses). Verify identity visually on the composited sheet before wiring it into UI.

5. **Cloudflare Runtime Secrets Pipeline:**
   - Passing secrets in GitHub Actions `env:` only sets them in the CI runner, not the edge runtime.
   - Secrets MUST be uploaded via direct stdin pipe with explicit environment targeting:
     `printf '%s' "$SECRET" | npx wrangler secret put <KEY> --config wrangler.worker.toml --env production`
     `printf '%s' "$SECRET" | npx wrangler pages secret put <KEY> --project-name=githoot`.
   - Never use `wrangler-action@v3` command input for secrets (prepends `wrangler` and corrupts shell pipes).
   - Production secrets (`GEMINI_API_KEY`, `GITHUB_TOKENS`, `AUTH_SECRET`, `ADMIN_REVIEW_SECRET`, `CF_ACCESS_*`, `R2_*`) must be bound explicitly to Cloudflare Pages Functions and Consumer Worker before deploying code.
   - **Secret separation:** `AUTH_SECRET` is strictly for OAuth state signing. Admin reviewer authorization strictly requires `ADMIN_REVIEW_SECRET` ($\ge 16$ bytes) compared via `constantTimeEqual`.
   - **Local dev on this PC only:** `GEMINI_API_KEY` may be sourced out-of-band from the untracked file `D:/www/oss/githatch/.env` — this absolute path is valid ONLY on this machine (Windows dev box where that file exists). Scripts MUST read it at runtime (override via `GITHOOT_ENV_PATH`), MUST fail closed when the file or key is missing, and MUST NEVER print the key or copy it into tracked files, reports, screenshots, logs, or chat output. On any other machine/CI, provide the key through the environment or the Cloudflare secret above instead.
   - **Model allowlist:** image generation MUST target a Nano Banana 2/Pro id (`nano-banana-pro-preview`, `gemini-3-pro-image`, `gemini-3-pro-image-preview`), confirmed against live `ListModels`. Reject non-allowlisted overrides and never silently fall back to Nano Banana 1 (`gemini-2.5-flash-image`).
6. **Tamagotchi Inactivity Policy:**
   - Never penalize users or kill pets during GitHub inactivity — only adjust visual mood states (`mood-engine.ts:calculateGuardianMood`).

7. **Evidence-First Verification (Zero Assumptions):**
   - UI and layout claims require fresh browser-driven screenshot evidence saved in `plans/reports/screenshots/`.

8. **Option 1 Design System (Cyber-Arcade Fantasy):**
   - Strictly follow Option 1 Design System: `Archivo` headers, `JetBrains Mono` numbers/stats, 4pt spacing scale, and neon cyan (`#00f0ff`) / magenta (`#ff2a85`) glowing accents.
   - **One-off approved exception (2026-08-30, user-authorized, does NOT generalize):** the single file `plans/reports/brainstorm-260830-marketing-website-redesign-ACCEPTED.html` renders in an industrial document register instead of Option 1, because it is a forensic audit dossier rather than a product surface. It still keeps the 4pt spacing scale and a project-tinted neutral ramp, and states the deviation in-page. This exception covers that one artifact only. Every other artifact, current or future, product surface or internal report, still requires Option 1 or a fresh explicit user approval.

9. **MVP Scope Boundary (Hard Guard):**
   - NEVER build heavyweight out-of-scope features during MVP: Arena combat, in-game store/inventory, Guilds, or real-time webhook ingestion.

10. **Kongming Supervisory Signoff:**

11. **Single-Source Bundle Provenance & CI/CD Deployment Invariants:**
    - The tested bundle is the deployed bundle: `npm run build` compiles `dist-worker/index.js` and records `dist-worker/provenance.json` with its exact SHA-256 hash.
    - Cloudflare Queue Consumer MUST be deployed with `deploy dist-worker/index.js --no-bundle --config wrangler.worker.toml --env production`. Re-bundling by Wrangler during deploy is strictly forbidden.
    - Post-deploy verification (`node scripts/bundle-provenance.mjs verify-deployed`) queries Cloudflare deployment records to assert live deployment of the recorded artifact.

12. **In-Repo Review Surface & Cryptographic Provenance:**
    - All companion pose publications MUST be reviewed and approved via the named route `GET/POST /auth/admin/review/:jobId`. Automated 16-pass stamp paths are strictly prohibited.
    - `GET /auth/admin/review/:jobId` returns the immutable review bundle with canonical `bundleSha`.
    - `POST /auth/admin/review/:jobId` validates the exact `bundleSha`, records an immutable audit entry in `guardian_review_records`, attaches 16 hash-bound semantic verdicts in D1, and executes the single-row pointer CAS in `guardian_publication`.
    - Major verification loops and fix cycles are supervised by subagent `kongming` and require a formal **GO Verdict** with 0 defects before final ship.
