# Phase 0 - Foundation

## Goal

Create the technical contracts that make later GitHatch features safe, explainable, retryable, and affordable.

This phase should produce very little flashy gameplay. Its purpose is to prevent identity, scoring, AI generation, and analytics from becoming permanent spaghetti once the product starts receiving real traffic.

## Dependencies

None. This is the root phase.

## Deliverables

- application skeleton and environments
- PostgreSQL schema/migrations
- Redis/cache and durable job queue
- object storage + CDN integration
- GitHub OAuth/App configuration
- stable GitHub account identity model
- public GitHub profile resolver
- activity ledger schema
- scoring contract v1
- deterministic DNA and egg schema v1
- AI provider abstraction
- asset provenance/cost model
- product analytics event schema
- observability and rate-limit controls

## Workstream A - Application foundation

### Tasks

- choose runtime/framework and repository conventions
- create local/dev/staging/production configuration model
- add environment validation at startup
- configure structured logging
- add request IDs and job correlation IDs
- configure database migrations
- configure Redis or equivalent
- configure durable queue and worker process
- configure object storage and CDN URL strategy
- add health/readiness endpoints

### Acceptance criteria

- web and worker processes start independently
- a migration can be applied and rolled back safely in non-production
- queue jobs support retry and dead-letter behavior
- object assets can be stored and served through the configured public path
- logs correlate a request with downstream jobs

## Workstream B - GitHub identity

### Data contracts

Create records for users and GitHub accounts. GitHub numeric user ID is canonical; login is mutable display/routing metadata.

Minimum fields:

```text
users
  id
  status
  created_at

github_accounts
  id
  user_id nullable
  github_user_id unique
  github_login
  avatar_url
  public_snapshot
  claimed_at nullable
  last_synced_at
```

### Tasks

- implement public GitHub profile lookup adapter
- normalize provider responses into internal types
- add lookup cache with bounded TTL
- preserve stale cache for graceful degradation
- distinguish not-found, rate-limited, provider-down, and invalid-login states
- add API instrumentation for GitHub rate-limit consumption

### Acceptance criteria

- the same GitHub user keeps the same local identity after login rename
- duplicate lookup requests do not create duplicate records
- cached public profile can render when GitHub is temporarily unavailable

## Workstream C - Authentication skeleton

### Tasks

- register/configure GitHub OAuth or GitHub App auth
- define minimum scopes/permissions
- implement login start and callback
- store auth/session state securely
- fetch authenticated numeric GitHub user ID
- prevent CSRF/state replay
- add logout/session revocation

Do not build pet claiming yet; Phase 1 owns that workflow.

## Workstream D - Activity ledger

Define provider-independent normalized activity vocabulary.

Initial types:

```text
COMMIT_AUTHORED
PR_OPENED
PR_MERGED
EXTERNAL_PR_MERGED
ISSUE_OPENED
ISSUE_RESOLVED
REVIEW_SUBMITTED
RELEASE_PUBLISHED
STAR_GAINED
FORK_GAINED
CONTRIBUTOR_JOINED
REPOSITORY_CREATED
```

### Tables/concepts

```text
raw_github_events
activity_ledger
progression_entries
```

### Tasks

- define unique provider event keys/idempotency strategy
- persist raw events before processing when applicable
- implement normalized event schema
- support append-oriented ledger records
- create adjustment/correction strategy
- create fixture format for replay tests

### Acceptance criteria

- replaying the same raw event twice produces one logical ledger event
- normalized activities are independent from UI narrative copy
- ledger data can be replayed into a scoring function in tests

## Workstream E - Scoring contract v1

Do not attempt to perfectly solve contribution quality in Phase 0. Build a versioned scoring framework with a conservative initial configuration.

### Tasks

- define `scoring_version`
- implement base event weights
- implement per-event-family diminishing returns
- implement basic collaboration modifier interface
- implement quality flag input contract
- create XP, trait, Fame, and Reputation delta output
- create scoring explanations for debugging/admin views

### Invariants

- Level XP cannot be negative through normal activity
- raw commit count cannot grow power linearly without bound
- stars/forks primarily affect Fame, not direct combat power
- same ledger + same version yields the same output

## Workstream F - Deterministic guardian DNA

### Schema

Define bounded fields for:

- species family
- element
- archetype seed
- temperament
- palette
- silhouette family
- markings
- rarity seed
- mutation seed
- base traits

### Tasks

- define DNA schema version
- derive server-side deterministic seed from GitHub identity
- implement deterministic selection utilities
- create test vectors
- persist canonical DNA independently from assets

### Acceptance criteria

- same GitHub identity + same DNA version produces identical DNA
- retries do not create a second identity
- generated asset changes never rewrite DNA

## Workstream G - Egg renderer

Eggs must be cheap and deterministic.

### Tasks

- define bounded egg shapes/patterns/palettes/effects
- map DNA seed hints to egg primitives
- implement SVG/CSS/canvas renderer
- include mystery/rarity hints without leaking hidden mechanics
- add snapshot tests

### Critical cost invariant

Anonymous public profile rendering cannot call an AI image provider.

## Workstream H - AI provider abstraction

### Interface

Create a provider-neutral adapter for image generation/editing and cost estimation.

### Tasks

- define canonical generation request/response types
- create provider adapters behind configuration
- implement idempotency fingerprint
- implement generation-attempt records
- capture model/provider/version/cost metadata
- define moderation/validation states
- define object-storage persistence
- create fallback/failed state

Do not build production pet prompts yet; Phase 1 owns the first canonical generation template.

## Workstream I - Analytics

Define product events now so Phase 1 launches with attribution rather than adding it afterward.

Initial events:

```text
profile_viewed
egg_viewed
claim_started
claim_completed
hatch_completed
guardian_shared
repository_clicked
```

### Tasks

- session/anonymous visitor identity strategy
- server and client event emission rules
- dedupe rules for repository discovery
- event warehouse/provider adapter if required
- dashboard queries for claim funnel

## Workstream J - Security and operations

- secrets management
- GitHub webhook signature helper
- per-IP anonymous rate limiting
- per-user expensive-action rate limiting
- database backup policy
- queue monitoring
- AI budget alerting
- audit log skeleton

## Tests

Required test groups:

- GitHub adapter contract tests
- DNA deterministic test vectors
- egg rendering snapshots
- ledger idempotency tests
- scoring replay tests
- job retry/idempotency tests
- auth state/CSRF tests

## Exit gate

Phase 0 is complete when:

- public GitHub users resolve reliably
- same GitHub user cannot fork into duplicate identities
- DNA is deterministic
- anonymous views cannot create AI spend
- normalized activity and scoring are independently versioned
- duplicate events are retry-safe
- queue and external-provider failures are observable
- product analytics can measure the Phase 1 claim funnel

## Explicit non-goals

- polished guardian art
- hatch animation
- progression UI
- Arena
- marketplace
- guilds
- private repositories
