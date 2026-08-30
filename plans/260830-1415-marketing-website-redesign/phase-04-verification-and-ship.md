# Phase 4: Verification, Quality Gates & Kongming Signoff

## Context
Execute the complete quality verification loop and Kongming advisory checkpoint before shipping the PR.

## Quality Gates
1. `npm run typecheck` (0 TypeScript errors)
2. `npx vitest run` (100% unit tests pass)
3. `npm run build` (Client Vite + Edge Worker esbuild bundle to `dist/`)
4. `npm test` (`scripts/run-autonomous-qa.ts` passes all assertions)
5. Multi-viewport screenshot verification (Desktop 1440, Tablet 768, Mobile 375) with zero overflow.

## Advisory Supervision (Kongming) Checkpoint
- Spawn `kongming` subagent to review the implementation evidence and deliver a formal Go/No-Go signoff.

## Shipping & Merging (`--ship`)
- Stage changes, commit with conventional commit messages.
- Create PR against `master`.
- Verify CI passes.
- Merge PR.
