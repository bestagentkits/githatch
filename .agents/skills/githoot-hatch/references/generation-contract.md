# Generation Contract

## Model selection

Allowlist: `MODEL_ALLOWLIST` in `contracts.mjs` — Nano Banana 2/Pro ids confirmed
against live `ListModels`:

```
nano-banana-pro-preview
gemini-3-pro-image
gemini-3-pro-image-preview
```

Rules:
- pick **one** id per job and use it for every call in that job
- reject a non-allowlisted override (exit `4`)
- **never** fall back to Nano Banana 1 (`gemini-2.5-flash-image`)
- **never** auto-rotate across allowlisted ids: even an allowed substitution
  changes provenance and breaks reproducibility. A deliberate change is a new
  `render_version`, not a fallback.
- call the Google endpoint directly (`GEMINI_ENDPOINT`). Generic
  "image provider" routers have silently fallen back to an unrelated model
  (observed: `xai/grok-imagine`), which is a provenance failure.

Verify availability with `ListModels` rather than guessing ids.

## Request shape

```
POST {GEMINI_ENDPOINT}/{modelId}:generateContent?key=…
{
  "contents": [{ "parts": [
    { "text": "<compiled pose prompt>" },
    { "inlineData": { "mimeType": "image/jpeg", "data": "<base64 reference>" } }
  ]}],
  "generationConfig": { "responseModalities": ["TEXT", "IMAGE"] }
}
```

`responseModalities` must include `IMAGE`, or the model returns text only.
Read the image from the first part carrying `inlineData`.

## One pose per call

**Never request a pose grid.** Empirically the model returned a 5×4 layout with
black divider lines when asked for a strict 4×4, and repeated near-identical idle
poses. Consequences: any grid-slicing math is wrong, and slicing by assumed cell
size silently mis-cuts every frame.

Instead: N independent calls (one per `POSE_SET` entry), then compose the grid
locally. Geometry becomes code-owned and deterministic.

## Prompt grammar

`compilePosePrompt()` emits, in fixed order:

1. `Draw ONE brand-new single-character sprite frame. The character is <pose>.`
2. identity block from enums (`identityBlock()`), including the build constraint
3. reference-scope clause: style/identity ONLY, do not copy layout, grid, panels,
   poses, text, or labels
4. single-subject + framing: exactly one character, side-profile 3/4, full body
   head to feet, centered and large
5. negative structure: no grid, no panels, no borders, no text, no extra characters
6. background: flat `#00FF00` chroma, no shadows, hard edges, no green spill
7. bounded creative allowance: subordinate texture/lighting/particles only; never
   anatomy, build, silhouette, palette, crest, or subject count

The reference-scope clause (3) is load-bearing: without it the model echoes the
entire reference sheet back as a single "frame".

Build wording is load-bearing too. `BUILD_PROMPT` carries explicit negatives
(e.g. stocky → "NOT slim, NOT thin, NOT elongated") because body type drifted to
a different silhouette without them. Keep these as enum expansions per build —
never hardcode one Guardian's prose in the compiler.

## Pose set

`POSE_SET` (`landing16.v1`) is 16 ordered beats: airborne (1–6) → impact (7–9) →
recover (10–13) → finish (14–16). `three_point_landing` (7) is the signature beat
and must be explicitly requested; generic "landing" wording does not produce it.

Changing ids, order, or count = new `poseSet` version, not an ad-hoc branch.


## Emotion & mood pose set (`emotions.v1`)

`EMOTION_POSE_SET` defines the companion expressions and idle motion suite:

| ID | Label | Pose Description / Intent |
|---|---|---|
| `idle` | Idle Motion | Natural standing breathing/hovering posture, alert and calm |
| `happy` | Happy | Joyful bounce with smiling eyes and sparkle particles |
| `sad` | Sad / Dejected | Drooping posture, lowered head, gloomy moody motes |
| `excited` | Excited | Electric high-energy leap, eyes wide with sparkling aura flare |
| `angry` | Combat / Angry | Fierce combat-ready stance, glowing eyes, aggressive posture |
| `surprised` | Surprised | Startled leap, wide open eyes, exclamatory motes |
| `sleep` | Sleep / Cozy | Curled or relaxed rest pose, closed eyes, floating soft zZz motes |
| `work` | Coding / Work | Focused hacking pose with floating holographic runes or keyboard |
| `celebrate` | Celebrate | Triumphant victory cheering pose with confetti burst |

Prompts for the emotion suite use the exact same single-subject, chroma-key,
reference-conditioned grammar as `compilePosePrompt()`, ensuring 100% identity
lock across all emotion frames.
## Retries

Up to `GATES.maxAttemptsPerPose` (3) attempts per pose. Prompt bytes stay
identical across attempts — attempt number must never enter the prompt.
Exhausted attempts → fail closed (exit `6`); never substitute a placeholder frame
into a published set.

Total model attempts for a job are capped at `poseCount × maxAttemptsPerPose`.
Accepted frames must not be re-billed on idempotent retry.

## Credentials

`process.env.GEMINI_API_KEY` first (the only path that works on CI or another
machine), then an untracked dotenv at `GITHOOT_ENV_PATH` for local dev. Same
precedence applies to the model override (`GEMINI_MODEL` / `AI_MODEL_TIER`).
Missing key → exit `2`. Log the source *name* only; never the value. Redact
credentials from error text before logging.
