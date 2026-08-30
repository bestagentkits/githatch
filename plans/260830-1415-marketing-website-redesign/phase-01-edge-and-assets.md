# Phase 1: Server Endpoint & Asset Pipeline

## Context
The accepted contract requires:
1. `GET /api/early-access/status` to return a boolean `degraded` flag (false on success, true on DB catch) so client can distinguish a genuine 0 claimed slots from a database outage.
2. `scripts/build.js` to filter asset copying, excluding unreferenced artifacts (`*-gemini-raw.jpg`, `landing16-frames/`, `*-landing16-*.png`), removing ~10.8 MB dead weight from production builds.
3. Placing `neonbyte-poster.webp` (37.8 KB) and `zuey-avatar-96.webp` (2.35 KB) into `assets/sample-pets/` for client bundling.

## Files to Modify / Create
- `src/server/index.ts`: update `/api/early-access/status` handler
- `src/server/types/index.ts`: update `EarlyAccessStatus` interface to include `degraded: boolean`
- `scripts/build.js`: update `cpSync` filter logic
- `assets/sample-pets/neonbyte-poster.webp`: copy from preview assets
- `assets/sample-pets/zuey-avatar-96.webp`: copy from preview assets

## Implementation Steps
1. Add `degraded?: boolean` to `EarlyAccessStatus` in `src/server/types/index.ts`.
2. Update `src/server/index.ts`:
   - Success path: `{ total, claimed, remaining, is_free, degraded: false }`
   - Catch path: `{ total: 100, claimed: 0, remaining: 100, is_free: true, degraded: true }`
3. Copy `plans/reports/landing-preview-assets/neonbyte-poster.webp` and `zuey-avatar-96.webp` to `assets/sample-pets/`.
4. Update `scripts/build.js` asset copying to filter out `*-gemini-raw.jpg`, `landing16-frames/`, `*-landing16-*.png`.
5. Run build and check `dist/` file count and total size.

## Validation
- `npm run typecheck` passes.
- `npm run build` succeeds and `dist/assets/sample-pets/` contains only needed assets.
