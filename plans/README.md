# GitHatch implementation plans

This directory turns the product requirements and architecture into executable implementation phases.

## Source documents

- [`../docs/prd.md`](../docs/prd.md) - product requirements and product principles
- [`../docs/system-architecture.md`](../docs/system-architecture.md) - technical architecture and domain contracts
- [`../docs/roadmap.md`](../docs/roadmap.md) - sequencing and product validation gates

## Phase plans

1. [`00-foundation.md`](00-foundation.md) - platform foundation, identity, event ledger, deterministic DNA, queues, analytics
2. [`01-hatch-and-profile.md`](01-hatch-and-profile.md) - public profiles, claim flow, canonical guardian generation, hatch reveal
3. [`02-progression-and-guardians.md`](02-progression-and-guardians.md) - GitHub activity ingestion, scoring, anti-farming, repository guardianship
4. [`03-evolution-and-distribution.md`](03-evolution-and-distribution.md) - evolution, sprite pipeline, sharing, README embeds, attribution
5. [`04-discovery-and-arena.md`](04-discovery-and-arena.md) - discovery feeds, rating, matchmaking, auto-battle and repository spotlight
6. [`05-economy-and-seasons.md`](05-economy-and-seasons.md) - inventory, currencies, cosmetics, seasons, sponsored discovery
7. [`06-social-and-scale.md`](06-social-and-scale.md) - Repo Raids, guilds, community systems, ecosystem and scale

## Execution rules

### 1. Complete contracts before cosmetics

Each phase starts with data contracts, state machines, and observability before visual polish. Game UI is allowed to be beautiful; game state is not allowed to be vibes.

### 2. Keep expensive external calls asynchronous

GitHub reconciliation, image generation, sprite processing, share-card rendering, and later Arena batch work should run through durable jobs where appropriate.

### 3. Idempotency is mandatory

The following operations must be retry-safe:

- GitHub webhook/event ingestion
- account claim
- guardian creation
- bootstrap sync
- progression scoring
- AI asset generation
- payment webhooks
- Arena result settlement

### 4. Product gates are real gates

Phase 4 Arena is not automatically approved because Phase 3 engineering is complete. The Phase 3 distribution metrics must first demonstrate that users share guardians and GitHatch drives repository discovery.

The same rule applies to economy and social-world expansion.

### 5. Explainable progression before machine learning

Start anti-farming and ranking logic with versioned, explainable rules. ML can be added after enough labeled abuse and engagement data exists.

### 6. Keep permanent and seasonal state separate

Permanent:

- guardian DNA
- lifetime Level
- evolution history
- owned durable cosmetics
- achievement history where appropriate

Seasonal:

- competitive Rating
- seasonal progression
- seasonal modifiers
- seasonal rewards

### 7. Repository discovery is a first-class deliverable

Every phase that creates a new surface should ask how it helps visitors discover real developer work.

## Suggested issue decomposition

Each phase file can become an epic/parent issue. Sections under `Workstreams` can become child issues or parallel task groups.

For engineering execution, split work by independently testable vertical slices rather than by frontend/backend labels whenever possible. Example:

```text
bad:
- build all backend endpoints
- build all frontend screens

good:
- unclaimed profile vertical slice
- GitHub claim vertical slice
- guardian generation vertical slice
```

This keeps the product continuously demonstrable.
