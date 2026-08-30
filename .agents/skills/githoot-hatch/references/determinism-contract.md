# Determinism Contract

Authoritative constants live in `scripts/lib/contracts.mjs`. This file explains
the contract and rationale; it never redefines a value.

## Two contracts

- **Identity contract** — what must stay the same for a GitHub user forever.
- **Artifact contract** — which exact accepted bytes are canonical and publishable.

Both are needed because four independent things change: GitHub telemetry, our
compiler code, model stochasticity/revisions, and retry/cache/format paths.

## Versions

`VERSIONS` in contracts: `dna`, `telemetrySnapshot`, `identitySpec`,
`promptCompiler`, `poseSet`, `processingPolicy`. Bump the narrowest version that
changed. Any bump that alters identity output requires an explicit migration
decision — it will change existing Guardians.

**Seed namespace is `githoot:dna:v1:<github_user_id>`.** It matches the existing
production seed in `src/server/services/dna/seed.ts`. Switching to a bare
`SHA-256(github_user_id)` would flip every live identity.

## Frozen telemetry snapshot

Fields that may influence identity: `IDENTITY_TELEMETRY_FIELDS`. Anything else
(bio, login, repo names/descriptions, README text, timestamps) is dropped by
`normalizeTelemetry()` before hashing — this is both a determinism rule and the
prompt-injection boundary.

Normalization rules:
- languages lowercased, trimmed, top-3, **sorted** (API order must not matter)
- counts truncated to integers (no locale formatting, no floats)
- ratios rounded to 2 decimals (float noise must not change a hash)
- missing fields default explicitly to `0`

Freeze this snapshot at first hatch and persist `telemetrySnapshotHash`. Later
activity drives mood/level/evolution only.

### Immutable vs mutable phenotype

| Immutable (frozen at hatch) | Mutable (live telemetry) |
|---|---|
| species/silhouette, build, crest, markings, material, base palette, element, rarity | mood/energy state, level/EXP, aura animation intensity, accessories, evolution form (separately versioned) |

## Identity derivation

`compileIdentitySpec()`:
1. `normalizeTelemetry(raw)` → frozen snapshot
2. `dnaSeed(githubUserId)` → 256-bit namespaced seed
3. `meritScore(snap)` → `rarityFor(merit)` — rarity is **earned** from
   `MERIT_WEIGHTS` (saturating log normalizers so whales don't dominate and
   newcomers aren't zeroed), not rolled from the seed
4. `elementFor(seed, snap)` — GitHub language evidence first (`LANGUAGE_ELEMENT`,
   plus a `nightCommitRatio ≥ 0.5` vote for Void); seed only breaks ties, over a
   **sorted** candidate list
5. cosmetics via `pick(seed, domain, table)` — each locus hashes
   `seed:domain:identitySpecVersion` independently

**Domain separation matters:** one shared PRNG stream would mean adding a new
cosmetic field silently reshuffles every existing Guardian. Independent
per-locus hashes make new fields additive.

## Canonical serialization

`canonicalJson()` — sorted keys, no whitespace, `undefined` dropped. All hashes
go through it. Never hash `JSON.stringify()` output directly: key order would
leak into the hash.

## Idempotency

`requestFingerprint({ spec, referenceSha256, modelId })` covers processing policy,
prompt compiler, pose set, frame geometry, identity hash, telemetry hash,
reference hash, and exact model id. A fingerprint hit means accepted bytes **may
be reused after re-validation** — never that validation can be skipped.

## Canonical reference lifecycle

Prompt determinism does not make model output deterministic, so the first
accepted identity render is pinned:

1. render candidate → structural gate → semantic identity check
2. on acceptance, store content-addressed with `reference_sha256`, dimensions,
   mime type, `identityHash`, `promptHash`, exact model id
3. never overwrite in place; a new reference means a new `render_version`
4. every later pose call attaches this exact reference inline

Sample Guardians: `assets/sample-pets/{id}-gemini-raw.jpg`. Real users: immutable
hash-pinned object storage — not one Git commit per user.

If the reference is lost, the identity cannot be reconstructed from prompt bytes.
Treat reference durability as a data-integrity requirement.

## Do not

- feed any free text into a prompt
- let an LLM rewrite/translate/embellish compiled prompts
- put timestamps, attempt numbers, job ids, or usernames into prompt bytes
- promise identical pixels from identical prompts
- define a threshold anywhere except `contracts.mjs`
