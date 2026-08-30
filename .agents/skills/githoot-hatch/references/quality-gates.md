# Quality Gates

Thresholds are defined once in `contracts.mjs` (`GATES`, `CHROMA`). This file
explains what each catches, why the value exists, and what it cannot catch.

## Structural gate — `validateFrame()`

One function, used for **fresh renders and cached frames alike**. A lighter
"resume" check is forbidden: a partial recheck once shipped an unvalidated frame
into a composited sheet.

| Check | Threshold | Catches | Origin |
|---|---|---|---|
| large components | `> 4` → reject | reference-collage echo (model returns the whole reference sheet as one image) | observed repeatedly; auto-rejected 4 times in one 16-frame batch |
| dominance | 2nd largest `> 30%` of largest | multi-subject frames (e.g. a portrait bust plus a diving figure) | a real frame passed the component check with 2 comparable figures |
| bbox fill | `< 6%` of frame | subject rendered tiny/far away | a frame where the character was a small distant figure |
| bbox aspect | `> 3.2` | strip/banner output instead of one standing figure | guards against elongated multi-pose output |
| speckle floor | component `< 0.3%` of area | anti-aliasing noise counted as a subject | tuning |
| alpha cutoff | `> 24` | feathered edge pixels counted as opaque | tuning |

Returns `{ ok, reasons[], metrics }` and never throws on a defect, so callers can
record metrics and retry deterministically. Persist `metrics` per frame in the
manifest — they are the evidence that the gate actually ran.

## What the structural gate CANNOT catch

Species/body/identity drift. A thin, feminine silhouette of a different character
is a single dominant well-sized component: geometrically perfect, semantically
wrong. Two real drift cases passed every structural check.

Therefore publication additionally requires a **semantic identity verdict** per
frame covering: species, anatomy/build, silhouette, palette, crest/signature
feature, art style, subject count, and the required pose.

Until an independent multimodal verifier is validated against known-good and
known-drifted frames, that verdict is a human visual check on the composited
sheet. The generating model must never attest to its own output. Uncertain →
`QUARANTINED`.

Honest position: generation can run autonomously; **publication cannot** on the
structural gate alone.

## Chroma removal

`removeChroma()`: sample the four corners for the background estimate, then per
pixel:
- euclidean distance `< 60` to background, or green-dominant
  (`g > 90 && g > r*1.25 && g > b*1.25`) → alpha `0`
- distance `60..100` → feathered alpha
- retained pixels get de-spill `g = min(g, (r+b)/2)` (repo invariant)

Green-dominant detection is needed because the model shades the backdrop rather
than emitting one flat value, so a pure-colour equality test leaves fringes.

## Contour centering

`contourBBox()` scans the whole image for the alpha extent, then the frame is
`contain`-resized into `FRAME.size` (256). **Fixed-offset slicing of model output
is forbidden** — that is the repo invariant, and with per-pose rendering there is
no grid to slice anyway.

`framePlacement(i)` gives the 4×4 sheet and N-frame strip coordinates. Geometry is
code-owned.

## Artifact set gate

Emit **PNG and WebP together** in one staged step, hash both, and only then
advance the version pointer. A png-only rewrite left a stale WebP embedded in the
UI, so the browser showed old defective frames while the inspected PNG was
correct — a silent false-success.

## Browser verification gate

Required before publication. Must:
- load the actual surface and exercise every frame
- assert N distinct frame offsets (not just that the player renders)
- assert the UI binds the manifest's *current* artifact hashes
- capture screenshots + a report into `plans/reports/`
- exit nonzero on any console/network error or mismatch

No fresh verification report → no publication.
