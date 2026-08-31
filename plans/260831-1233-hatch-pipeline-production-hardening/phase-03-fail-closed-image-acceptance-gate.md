---
phase: 3
title: "Fail-Closed Image Acceptance Gate"
status: completed
priority: P1
effort: "1.5d"
dependencies: [2]
---

# Phase 3: Fail-Closed Image Acceptance Gate

## Overview

Replace scattered, permissive image handling with **one authoritative fail-closed gate** for single-subject frames. Today a fully transparent frame passes, oversized model output is blind-cropped, the AGENTS-mandated component/dominance/fill/aspect gates are absent, MIME is ignored (everything decoded as PNG), and a dead fake 1024×512 transparent fallback plus fixed-grid slicing still exist. Per binding `AGENTS.md` invariant #4, generation is **one pose per API call** composited locally, so every model output is a single-subject frame — there is no grid to slice.

## Requirements

One gate, one mode (single-subject), exactly the thresholds `AGENTS.md:46` prescribes:
- `validateAndNormalizeFrame(bytes)` must: (a) verify PNG magic + structural decode and reject JPEG/interlaced/truncated/oversized per the P1 Dimension Contract; (b) apply the Green De-Spill chroma-removal ($g=\min(g,(r+b)/2)$, `chroma-removal.ts:34`); (c) run **bounding-box / contour detection** (never fixed pixel offsets) and reject **collage echoes (>4 large components)**, **multi-subject (2nd component > 30% of the main)**, **too-small subjects (<6% frame fill)**, and **over-wide bboxes (aspect > 3.2)**; (d) **scale-to-fit preserving aspect** then center on 256×256 (never blind crop).
- Generation requires the canonical reference bytes; a missing `references/<sha>.png` quarantines/retries — `referenceImage: null` is forbidden for identity-bound poses.
- **Re-validate cached frames** against their R2 bytes before compositing — a cache is never implicitly accepted (`AGENTS.md:46`).
- **Gate-input retention (for P5 recompute):** persist the exact pre-normalization bytes as a content-addressed `raw/<raw_sha>.png` alongside the accepted normalized frame so P5 can re-run the gate and reproduce the accepted frame hash; lifecycle cleanup for orphans.
- Clean cutover: delete the `processAndUploadGuardianAssets` fake fallback + fixed-grid slicing; remove the transparent-buffer decode fallback.

## Architecture
- New `src/server/services/image/frame-gate.ts` exporting `validateAndNormalizeFrame` → `{ ok:true, rgba256, metrics } | { ok:false, reasons }`. It composes the existing pure-TS `png-codec` decode, `chroma-removal`, and `findCharacterBoundingBox`, plus new connected-component labeling and an aspect-preserving scale-to-fit resampler. `AGENTS.md:43` requires bounding-box/contour detection, not a specific WASM module; the existing TS detector satisfies it (only the WebP codec is WASM, unchanged).
- `generation-worker.ts` calls the gate for the reference candidate and each of the 16 poses; a failure increments the pose attempt and, on exhaustion, marks the pose `QUARANTINED` and the job resumable (Phase 4) — never ack-success with a blank frame.
- Thresholds + dimension caps sourced only from `dna/contracts.ts` `GATES` (single source with P1's Dimension Contract): `maxLargeComponents=4`, `dominanceRatio=0.30`, `minFillRatio=0.06`, `maxAspect=3.2`, `maxSidePx=1024`, `maxBytes=4MB`. `1024×1024` is within cap (scales); `>1024`/`>4MB` rejects. There is **one** cap for all accepted decoded provider inputs — no separate grid cap.
- Remove `slicer.ts:138-214` dead path; keep only the pure helpers (`findCharacterBoundingBox`, `centerCharacterPose`, `cropRgbaRegion`) actually used.

## Related Code Files
- Create: `src/server/services/image/frame-gate.ts`, `src/server/services/image/connected-components.ts`, `src/server/services/image/scale-to-fit.ts`
- Modify: `src/server/queue/generation-worker.ts` (call gate for reference + each pose; require reference bytes), `src/server/services/dna/contracts.ts` (`GATES` thresholds + caps)
- Delete: dead fallback + fixed-grid block in `src/server/services/image/slicer.ts:138-214`

## Implementation Steps
1. Implement connected-component labeling (4/8-neighbour) over the alpha mask; return component count, largest-area ratio, and second-component dominance.
2. Implement the aspect-preserving scale-to-fit resampler to fit a bbox into the 256 box, then center.
3. Compose `validateAndNormalizeFrame`: structural PNG/MIME/dimension → chroma de-spill → bbox/component → collage(>4)/multi-subject(>30%)/fill(<6%)/aspect(>3.2) gates → scale-to-fit → center.
4. Wire the gate into reference-candidate creation and each pose; forbid `null` reference (fetch canonical bytes; missing ⇒ retry/quarantine).
5. Re-validate cached frames from R2 before compositing; retain `raw/<sha>` gate inputs.
6. Delete the dead slicer fallback/fixed-grid path; migrate any remaining caller.
7. **Update Internal Documentation (`/ak:docs update`):** refresh `docs/system-architecture.md` and `docs/code-standards.md` to document the authoritative single-subject image acceptance gate, AGENTS.md:46 quality thresholds, and scale-to-fit pipeline.

## TDD Gate (tests-first)
- [x] **RED:** blank/transparent frame ⇒ reject (fails today: passes).
- [x] **RED:** collage echo (>4 large components) ⇒ reject; single centered subject ⇒ accept.
- [x] **RED:** second component > 30% of main (multi-subject) ⇒ reject.
- [x] **RED:** `1024×1024` subject (within cap) ⇒ scaled to fit, no clipping (fails today: cropped).
- [x] **RED:** JPEG-magic buffer, truncated PNG, and `>1024`px / `>4MB` ⇒ reject.
- [x] **RED:** too-small (<6% fill) and over-wide (aspect > 3.2) ⇒ reject.
- [x] **RED:** pose generation with missing canonical reference ⇒ quarantine/retry, not `null`-anchored.
- [x] **RED:** cached frame re-validation rejects a corrupted cached frame; re-running the gate on retained `raw/<sha>` reproduces the accepted normalized frame hash (enables P5 recompute).
- [x] **GREEN:** all pass; valid fixture accepted and centered at the expected offset.

## Success Criteria
- [x] `frame-gate.ts` is the only path a frame takes to acceptance (single-subject; no grid mode).
- [x] Collage/multi-subject/too-small/over-wide/transparent/oversized/malformed all fail closed with reasons, at the exact `AGENTS.md:46` thresholds.
- [x] Oversized output scaled, never clipped; detection is contour/bounding-box, never fixed offset.
- [x] Poses never generated without canonical reference bytes; cached frames re-validated every run.
- [x] Dead fake fallback + fixed-grid slicing removed (grep clean).
- [x] Internal documentation in `docs/system-architecture.md` and `docs/code-standards.md` updated via `/ak:docs update`.
