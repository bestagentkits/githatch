# Phase 1 - Hatch and profile

## Goal

Deliver the first complete GitHatch experience: any public GitHub username resolves to an egg, the real owner can claim it, a persistent guardian is created, and the owner receives a memorable hatch reveal and public profile.

The phase validates the first product question:

> Will developers claim a fantasy identity derived from their GitHub account?

## Dependencies

Requires Phase 0 identity, auth, DNA, jobs, object storage, analytics, and AI provider contracts.

## User journey

```text
visit /:username
  ↓
public GitHub lookup
  ↓
unclaimed deterministic egg
  ↓
Claim & Hatch
  ↓
GitHub authentication
  ↓
ownership verification
  ↓
guardian creation
  ↓
bootstrap profile/repository sync
  ↓
canonical image generation
  ↓
hatch reveal
  ↓
claimed profile
```

## Workstream A - Public username route

### Tasks

- implement `/:username` server route
- validate GitHub login syntax
- resolve local cached GitHub account
- perform public GitHub lookup on miss
- render not-found/provider-error/stale states
- redirect renamed accounts where reliable
- emit `profile_viewed`

### Performance

- cache anonymous profile output where safe
- avoid blocking on unrelated repository detail fetches
- no AI-generation call from GET route

## Workstream B - Unclaimed profile

### UI

Display:

- GitHub avatar/login as supporting identity
- deterministic egg
- repository count or bounded public hints
- mystery traits
- clear `Claim & Hatch` CTA

Do not reveal deterministic values that make rerolling/economic exploitation trivial later.

### Tasks

- egg component and responsive layout
- owner-vs-visitor CTA copy
- shareable unclaimed URL metadata
- abuse-safe anonymous cache
- `egg_viewed` analytics

## Workstream C - Claim transaction

Claiming is security-sensitive and must be transactional.

### Required checks

- authenticated GitHub numeric ID equals profile's numeric ID
- no existing claimed guardian belongs to another account
- callback retry is idempotent
- existing user claiming same identity resolves to the same guardian

### Transaction

```text
resolve authenticated identity
  ↓
lock github_account
  ↓
create/resolve user
  ↓
mark github_account claimed
  ↓
derive/persist guardian DNA
  ↓
create guardian
  ↓
commit
  ↓
enqueue bootstrap + asset jobs
```

Emit `claim_started` and `claim_completed` at appropriate boundaries.

## Workstream D - Bootstrap repository sync

### Fetch

- GitHub profile metadata
- public repositories
- basic repository stats
- primary language
- stars/forks
- recent activity summaries available within supported APIs

### Tasks

- persist repositories by GitHub repository ID
- filter archived/forked repositories according to product rules
- suggest primary guarded repository
- allow owner to override featured repository
- record sync completeness and timestamps

The bootstrap must not claim a perfect historical record. Store provenance/range metadata where historical APIs are incomplete.

## Workstream E - Canonical guardian prompt compiler

The image model receives structured DNA, not arbitrary instructions assembled in UI code.

### Prompt inputs

- species
- element
- silhouette
- palette
- markings
- temperament
- initial archetype hints
- art-direction version
- negative/consistency constraints

### Tasks

- define prompt schema v1
- snapshot compiled prompts in tests
- prohibit untrusted GitHub text from overriding generation instructions
- define provider-specific adaptation behind the adapter

## Workstream F - Initial hero generation

### Job flow

```text
guardian_created
  ↓
compute asset fingerprint
  ↓
check existing READY/in-flight asset
  ↓
submit provider generation
  ↓
validate/moderate
  ↓
normalize image
  ↓
store object
  ↓
mark READY
```

### Failure behavior

If the provider fails:

- guardian remains valid
- profile shows a deterministic fallback/silhouette
- job can be retried
- user does not receive a second DNA roll

## Workstream G - Hatch reveal

The reveal is the activation moment and should be designed as a share-worthy ritual.

### Reveal content

- hatch animation
- guardian hero image
- species
- element
- rarity tier if used
- archetype/title
- initial traits
- primary repository/realm
- short deterministic flavor line

### Technical tasks

- polling/SSE/websocket strategy for async asset readiness
- reduced-motion fallback
- retry-safe reveal state
- ensure refresh does not re-hatch/re-roll
- emit `hatch_completed`

## Workstream H - Claimed profile v1

### Required sections

- guardian hero
- GitHub identity
- Level 1 / initial progression state
- species/element/archetype
- primary guarded repository
- additional repository list
- GitHub/profile links
- owner-only settings affordance

Do not overbuild the activity timeline yet; Phase 2 owns full progression storytelling.

## Workstream I - Profile settings

Owner can:

- set guardian display name within moderation limits
- choose featured repository from eligible public repos
- add allowed external project/demo/personal links
- configure lightweight profile preferences

Do not permit DNA/species rerolls in MVP. If rerolls are ever sold later, treat them as an explicit economy decision rather than an accidental API retry behavior.

## Workstream J - Analytics funnel

Dashboard/queries:

```text
profile views
  ↓
egg views
  ↓
claim started
  ↓
claim completed
  ↓
hatch completed
```

Segment by:

- direct URL
- shared/referral URL where available
- GitHub account age/activity bucket
- provider generation status

## Security tests

- user A cannot claim user B profile
- renamed GitHub login still resolves through numeric identity
- CSRF/state replay rejected
- callback retry does not create duplicate guardian
- hostile GitHub bio/repository strings cannot prompt-inject image system instructions
- external profile links are sanitized

## Performance/cost tests

- 1000 anonymous views of one unclaimed profile cause zero image-generation requests
- concurrent claim retries create one guardian and one logical asset job
- cached claimed profile renders without waiting for GitHub APIs

## Launch checklist

- provider budget ceilings configured
- AI failure fallback tested
- GitHub API rate-limit alerting enabled
- anonymous profile rate limiting enabled
- claim funnel dashboard live
- moderation path for offensive pet names/profile data available

## Phase metrics

Primary:

- egg view → claim start
- claim start → claim complete
- claim complete → hatch complete

Operational:

- median/p95 time to canonical asset ready
- generation cost per hatch
- failed generation rate
- GitHub bootstrap failure rate

## Exit gate

Phase 1 is validated when real users can discover and claim their profiles reliably and there is evidence that the hatch itself is compelling enough for users to complete the flow voluntarily.

Do not interpret successful engineering deployment as product validation.

## Explicit non-goals

- mature scoring
- evolution
- sprite combat
- Arena
- payments
- guilds
