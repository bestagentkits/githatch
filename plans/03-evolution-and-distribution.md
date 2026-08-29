# Phase 3 - Evolution and distribution

## Goal

Turn progression into emotionally meaningful visual milestones and organic distribution.

This phase validates the most important growth thesis before Arena:

> Will developers care enough about their guardian to share it, and will that sharing drive discovery of real repositories?

## Dependencies

Requires stable guardian DNA, canonical assets, progression, repositories, achievements, and attribution events.

## Workstream A - Evolution state machine

### Stages

Start small:

```text
HATCHLING
  ↓
EVOLUTION_1
  ↓
EVOLUTION_2
```

Legendary/rare forms can be added later.

### Criteria

Evolution should combine:

- Level threshold
- trait/archetype profile
- meaningful achievements
- repository history where relevant

Do not trigger evolution solely from raw contribution count.

### Tasks

- define versioned evolution rules
- persist unlock event and target stage
- ensure retry-safe stage transitions
- allow asset generation to lag behind state change
- maintain evolution history

## Workstream B - Archetype resolution

Derive readable archetype tendencies from accumulated traits.

Examples:

- Maintainer
- Shipper
- Collaborator
- Infrastructure Guardian
- Security Sentinel
- Researcher
- Frontend Artisan

Archetypes should be based on observable patterns, not invented personality claims.

The system can express uncertainty or blended archetypes rather than pretending every developer fits one box.

## Workstream C - Evolution asset generation

Input:

```text
canonical DNA
+ current canonical reference
+ target evolution stage
+ unlocked mutations
+ visual schema version
```

### Requirements

- preserve silhouette/species identity
- preserve major markings and palette lineage
- generation is idempotent
- previous evolution assets are retained
- failed generation does not revert game state
- owner receives a deterministic fallback until the asset is ready

### QA

Create automated checks where practical for:

- dimensions
- transparency
- file corruption
- output safety

Human moderation/review may be needed for rare high-visibility assets during early rollout.

## Workstream D - Character/reference sheet

Create a canonical reference asset to anchor later sprites and equipment.

Reference should include controlled poses such as:

- front/three-quarter hero
- side
- idle reference
- attack reference

Store reference version in asset metadata.

## Workstream E - Sprite pipeline v1

Initial animation scope:

- idle
- work
- celebrate
- sleep/rest

Arena-specific attack/hurt/win sprites can be added during Phase 4.

### Pipeline

```text
canonical reference
  ↓
controlled pose generation/conversion
  ↓
frame normalization
  ↓
anchor/alignment validation
  ↓
sprite package
  ↓
CDN
```

### Asset contract

A sprite package should define:

```text
frame dimensions
frame count
frame duration
anchor point
loop behavior
asset URLs
version
```

## Workstream F - Equipment slot foundation

Do not build a store yet. Create the visual composition contract required for future cosmetics.

Possible slots:

- head
- body/armor
- main hand
- off hand
- aura
- companion
- background/habitat

Test that layered items align with at least the core sprite states.

## Workstream G - Milestone events

Create durable share-worthy milestone events:

- hatch
- evolution
- level milestones
- rare mutation
- major achievement
- release milestone

Each event includes enough data to reproduce a share card without re-querying mutable GitHub state.

## Workstream H - Share-card renderer

### Requirements

- uses existing approved guardian artwork
- does not invoke AI image generation to compose text
- static deterministic layout templates
- responsive social metadata sizes as needed
- stored in object storage/CDN
- attribution URL included

Example content:

```text
My Emberfox evolved after shipping AgentKit v2.15
Level 30 • Shipper archetype
```

Avoid unsupported causal claims. If a specific release was not the rule that caused evolution, use safer copy such as "recently shipped" rather than "evolved because of".

## Workstream I - Sharing flows

Support:

- copy link
- platform share intent where available
- download/share image through normal browser/mobile affordances
- Open Graph/Twitter metadata

Every shared URL carries an attribution key that resolves server-side without exposing sensitive data.

Track:

```text
guardian_shared
share_link_opened
share_link_claim_started
share_link_hatch_completed
repository_clicked
```

## Workstream J - README embed

### Endpoint

Provide a stable public card endpoint such as:

```text
/card/:username.svg
```

### Card content

- compact guardian visual
- GitHub login / guardian name
- Level
- evolution stage
- primary repository
- recent badge/achievement if space allows

### Requirements

- highly cacheable
- sanitized text
- stable dimensions
- cheap render path
- profile link documentation
- graceful fallback if asset missing

Generate markdown snippet for the owner.

## Workstream K - Basic discovery homepage

Before Arena, launch noncompetitive discovery modules:

- New Hatchlings
- Rising Builders
- Recent Evolutions
- Shippers
- Under-discovered Repositories

Use materialized rankings rather than querying GitHub live per homepage request.

### Discovery score v1

Inputs can include:

- qualified recent activity
- freshness
- repository momentum
- current GitHatch exposure
- diversity/rotation constraints

Avoid an all-time popularity-only homepage.

## Workstream L - Owner analytics

Give owners lightweight evidence GitHatch is helping them.

Show:

- profile views
- share-link views
- README card clicks if measurable
- outbound GitHub repository clicks
- top discovered repositories

Do not overstate attribution beyond tracked GitHatch traffic.

## Distribution experiments

Run controlled experiments on:

- hatch share prompt timing
- evolution share prompt
- README embed onboarding
- share-card copy
- discovery section ordering

Primary goal is not generic engagement. It is repository discovery and viral acquisition.

## Performance/cost requirements

- sprite/card rendering does not block profile requests
- share cards are regenerated only when milestone/template changes
- evolution generation has per-user and global budgets
- CDN serves all public assets

## Testing

- evolution transition idempotency
- same milestone produces same logical share artifact
- attribution survives redirects and strips unsafe query data
- README SVG escapes user strings
- missing guardian asset has a valid static fallback
- reduced-motion profile remains usable

## Phase metrics

Primary:

- hatch → share rate
- evolution → share rate
- shared visitor → claim rate
- README embeds created
- README embed/profile CTR
- repository discovery events
- profile → GitHub outbound CTR

Operational:

- evolution generation cost
- sprite failure rate
- share-card render latency

## Critical exit gate before Arena

Arena should not receive major scope until real data shows that:

1. developers share guardians voluntarily
2. shares create new GitHatch visitors/claims
3. README/profile surfaces create repeatable acquisition
4. GitHatch sends measurable traffic to repositories

If these signals are weak, iterate on identity, visual quality, progression, and discovery first.

## Explicit non-goals

- full combat sprite set
- payments
- guilds
- marketplace
- user-to-user trading
