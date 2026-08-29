# GitHoot (`githoot.com`)

> **Turn your GitHub activity into an interactive fantasy companion — and your profile into a viral game people want to visit.**

**GitHoot** is an Edge-First gamified developer identity and discovery platform built on Cloudflare. Any public GitHub profile can be viewed as an interactive companion guardian profile:

```text
https://github.com/octocat
              ↓
https://githoot.com/octocat
```

---

## 🌟 Key Features

1. **Interactive AI Egg Spritesheets:** 8–10 pre-generated AI egg archetypes with real-time 60fps Canvas/CSS animations (idle, wobble, crack, hatch) and procedural Web Audio sound synthesis, requiring $0.00 AI API spend for anonymous visitors.
2. **Gacha Hatching Ritual:** A dramatic, suspenseful hatching ceremony with particle explosions, fanfare music, and shimmering hologram rarity tier badges (Common to Mythic).
3. **Gemini Nano Banana 2 Sprite Pipeline:** High-resolution hero portrait + 4x2 multi-pose sprite matrix (idle, happy, sleepy, proud, angry, work/coding, celebrate) with automated WASM contour detection and green de-spill alpha masking.
4. **Early Access 100-Slot Quota:** First 100 claimed guardians are 100% free; slot 101+ switches to a transparent cost-recovery gate ($0.99 / voucher) to prevent net-negative compute costs.
5. **Anti-Throttling GitHub Resolver:** Multi-token rotation pool (PATs/GitHub App) combined with Stale-While-Revalidate KV caching (< 20ms cache hit) and graceful degraded seed fallback.
6. **Dynamic Animated Social Share:** Live animated OpenGraph cards (`/og/:username.gif`, `/og/:username.png`) with 1-click sharing to X (Twitter) and LinkedIn, plus dynamic SVG README badges (`/badge/:username.svg`).

---

## 🎨 Design System: Cyber-Arcade Fantasy

- **Primary Colors:** Deep Space Black (`#07090E`), Neon Cyan (`#00F0FF`), Hot Magenta (`#FF2A85`), Electric Amber (`#FFA800`), Matrix Green (`#00FF88`).
- **Typography:** `Archivo` (Display headers) + `Schibsted Grotesk` (Body) + `JetBrains Mono` (Data & stats).
- **Interactive Showcase:** Open [`githoot-design-overview.html`](./githoot-design-overview.html) in your browser for a live Canvas simulator, 5 screen mockups with component annotations, and base64-embedded sample pets.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime & Package Manager** | `Node.js` (v20+ / v24+) or `Bun` (npm / bun) |
| **Edge Framework** | `Hono` on Cloudflare Pages / Workers |
| **Database** | Cloudflare `D1` (Serverless SQLite) |
| **Asset Storage & CDN** | Cloudflare `R2` (Bucket: `githoot`, Domain: `cdn.githoot.com`) |
| **KV Cache** | Cloudflare `KV` (Namespace: `GITHOOT_CACHE`) |
| **AI Generation** | Google Gemini `nano-banana-pro-preview` / `nano-banana-2` (Dev: `nano-banana-2-lite`) |
| **WASM Image Processing** | `@silvia-odwyer/photon` (Contour Slicer + Green De-spill) |
| **CI/CD Deployment** | GitHub Actions on `push: branches: [main]` via `cloudflare/wrangler-action` |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install  # or bun install

# 2. Configure environment
cp .env.example .env

# 3. Local development with Cloudflare emulation
npm run dev  # or npx wrangler pages dev

# 4. Typecheck & Tests
npm run typecheck
npm test

# 4. Check active implementation plan status
ak plan status ./plans/260829-2354-githoot-mvp-implementation
ak plan validate ./plans/260829-2354-githoot-mvp-implementation

# 5. Start autonomous implementation
/ak:cook plans/260829-2354-githoot-mvp-implementation
```

---

## 📂 Documentation & Plans

- [`AGENTS.md`](./AGENTS.md) — Imperative rules, critical invariants & gotchas for AI agents.
- [`docs/prd.md`](./docs/prd.md) — Product requirements & viral loop specifications.
- [`docs/system-architecture.md`](./docs/system-architecture.md) — Cloudflare Edge architecture & D1 schema.
- [`docs/design-guidelines.md`](./docs/design-guidelines.md) — Cyber-Arcade tokens, typography, and motion rules.
- [`docs/roadmap.md`](./docs/roadmap.md) — 8-phase execution roadmap.
- [`plans/260829-2354-githoot-mvp-implementation/`](./plans/260829-2354-githoot-mvp-implementation/) — Active 8-phase implementation plan.
