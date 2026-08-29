# GitHatch system architecture

## 1. Architecture goals

GitHatch needs to support three very different workloads without mixing their failure modes:

1. public profile and discovery reads
2. GitHub event ingestion and progression calculation
3. asynchronous AI asset generation

The initial architecture should be a modular monolith with explicit domain boundaries, a primary relational database, cache/CDN, object storage, and a background job queue.

Do not start with a distributed microservice topology unless scale or operational isolation requires it. The important thing is not the number of services; it is that domain contracts are explicit enough to extract later.

## 2. High-level architecture

```text
                           +----------------------+
                           |      GitHub API      |
                           | OAuth / App / Events |
                           +----------+-----------+
                                      |
                                      v
+-------------+            +----------------------+            +----------------+
| Web client  |----------->| GitHatch application |----------->| Cache / CDN    |
| / mobile UI |            | API + server render  |            | cards + assets |
+------+------+            +----+-----------+-----+            +----------------+
       |                        |           |
       |                        |           +-----------------------+
       |                        v                                   v
       |                 +-------------+                    +----------------+
       |                 | Primary DB  |                    | Object storage |
       |                 +------+------+                    | images/sprites |
       |                        |                            +----------------+
       |                        v
       |                 +-------------+
       +---------------->| Job queue   |
                         +------+------+ 
                                |
                 +--------------+-------------------+
                 |              |                   |
                 v              v                   v
          +-------------+ +-------------+    +----------------+
          | GitHub sync | | Scoring     |    | AI asset jobs  |
          | workers     | | workers     |    | generation     |
          +-------------+ +-------------+    +----------------+
```

The final line in the diagram may be implemented as workers inside the same deployable application at first.

## 3. Recommended runtime shape

Initial deployable components:

### Web/API application

Responsibilities:

- server-render public profiles
- authentication callbacks
- owner dashboard
- profile API
- discovery endpoints
- share-card metadata endpoints
- Arena requests when introduced
- admin/moderation APIs

### Background worker

Responsibilities:

- GitHub bootstrap sync
- periodic reconciliation
- event normalization
- progression scoring
- achievement evaluation
- share-card rendering
- AI generation orchestration
- asset validation
- analytics aggregation

### Primary database

A relational database such as PostgreSQL should be the source of truth for product state.

### Queue

Use a durable job queue with retries, visibility timeouts, idempotency keys, and dead-letter handling.

### Cache

Use Redis or equivalent for hot profile caches, rate limiting, job coordination, distributed locks, and short-lived computed rankings.

### Object storage + CDN

Store generated images, sprites, static profile cards, and animation assets in object storage fronted by a CDN.

## 4. Domain boundaries

Keep modules explicit even inside one application.

Suggested modules:

```text
identity
  users
  github_accounts
  auth

guardians
  dna
  species
  evolution
  assets

repositories
  repositories
  guardianship
  repository_metrics

github_activity
  ingestion
  normalization
  ledger
  reconciliation

progression
  scoring
  levels
  traits
  achievements
  anti_farming

discovery
  rankings
  feeds
  attribution

arena
  ratings
  matchmaking
  simulation
  replays

economy
  inventory
  currencies
  catalog
  purchases
  entitlements

social
  guilds
  raids
  follows

platform
  jobs
  cache
  storage
  analytics
  moderation
```

Modules should communicate through application-level interfaces and durable domain events rather than reaching into each other's tables arbitrarily.

## 5. Core data model

The names below are conceptual and can change with implementation conventions.

### users

```text
id
created_at
updated_at
status
```

### github_accounts

```text
id
user_id nullable for unclaimed cache records
github_user_id unique
github_login
avatar_url
profile_snapshot_json
claimed_at
last_synced_at
```

Use GitHub numeric user ID as the stable external identity. Login names can change.

### guardians

```text
id
user_id unique
dna_version
dna_json
species
element
archetype
rarity
level
lifetime_xp
current_power
fame
reputation
evolution_stage
state
created_at
```

Do not use generated image output as the canonical identity. `dna_json` is canonical; assets are derived artifacts.

### guardian_assets

```text
id
guardian_id
asset_type
stage
equipment_signature nullable
storage_key
status
provider
model
model_version
prompt_schema_version
input_fingerprint
cost_metadata_json
moderation_status
created_at
```

`input_fingerprint` must make generation idempotent.

### repositories

```text
id
github_repository_id unique
owner_github_user_id
name
full_name
visibility
primary_language
stars
forks
archived
metadata_json
last_synced_at
```

MVP should store only public repositories.

### guardianships

```text
guardian_id
repository_id
role
priority
featured
created_at
```

### raw_github_events

Stores provider payloads necessary for reconciliation and debugging.

```text
id
provider_event_key unique
github_user_id
github_repository_id nullable
event_type
occurred_at
received_at
payload_json
source
```

Retention can be bounded once normalized records are trustworthy.

### activity_ledger

This is one of the most important tables in the system.

```text
id
actor_user_id
guardian_id
repository_id nullable
source_event_id
activity_type
occurred_at
quantity
quality_flags_json
validation_context_json
scoring_version
created_at
```

The ledger should be immutable or append-oriented. Corrections should create adjustment records rather than silently mutating historical meaning.

### progression_entries

```text
id
guardian_id
activity_ledger_id nullable
entry_type
xp_delta
power_delta
fame_delta
reputation_delta
trait_deltas_json
scoring_version
created_at
```

This makes the score explainable and replayable.

### achievements

Store definitions separately from unlocks so criteria can be versioned.

### outbound_attribution

```text
id
session_id
source_surface
source_entity_id
destination_type
destination_url
campaign_key nullable
occurred_at
```

This powers the North Star metric.

## 6. Public profile resolution

Request:

```text
GET /:username
```

Resolution path:

```text
request
  ↓
route validation
  ↓
profile cache lookup
  ↓ miss
local github_account lookup
  ↓ miss
GitHub public API lookup
  ↓
cache normalized public identity
  ↓
render unclaimed egg OR claimed guardian
```

Important rules:

- page views must never directly trigger AI generation
- GitHub failures should degrade to cached data where possible
- anonymous requests should be aggressively rate limited and cached
- unknown GitHub usernames should produce a clean not-found state

## 7. Deterministic egg generation

Egg rendering should be cheap and deterministic.

Possible process:

```text
seed_material =
  github_numeric_user_id
  + dna_schema_version
  + stable_public_fingerprint

seed = HMAC(server_secret, seed_material)
```

The seed chooses from bounded visual primitives:

- shell shape
- pattern
- palette family
- glow
- particles
- rarity hints

Never expose a raw deterministic seed that lets clients predict secret rarity mechanics if rarity is economically meaningful later.

## 8. Authentication and claiming

Recommended flow:

```text
visitor
  ↓
Sign in with GitHub
  ↓
OAuth/App callback
  ↓
retrieve authenticated GitHub numeric user ID
  ↓
match requested profile
  ↓
transactionally create/claim user + guardian
  ↓
enqueue bootstrap sync
  ↓
derive DNA
  ↓
enqueue canonical asset generation
```

Claiming must be idempotent. A callback retry cannot create a second guardian.

Use minimum OAuth/App permissions. Private repository access is not required for MVP.

## 9. GitHub ingestion strategy

GitHub data has different consistency and latency properties, so GitHatch should combine several strategies.

### Bootstrap

On claim:

- fetch user identity
- fetch contribution summaries where available
- fetch public repositories
- fetch recent PR/issue/release/review metadata within API limits
- create normalized baseline ledger entries
- mark incomplete historical ranges explicitly

Do not pretend GitHatch possesses a perfect historical event stream before claim.

### Event-driven updates

For data available through GitHub App webhooks, process events through a signed webhook endpoint.

Webhook pipeline:

```text
GitHub
  ↓
verify signature
  ↓
persist raw event
  ↓
acknowledge quickly
  ↓
async normalization
  ↓
ledger
  ↓
scoring
```

### Reconciliation

Periodically reconcile high-value state such as repository stars, releases, merged PRs, and profile metadata because webhooks can be missed and not all activity is webhook-driven for every installation shape.

## 10. Event normalization

Provider events should map into a small internal vocabulary, for example:

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

Normalization logic is versioned and tested independently from scoring.

Do not mix narrative copy, score calculation, and provider payload parsing in one function.

## 11. Scoring architecture

Scoring should be deterministic for a given:

```text
activity ledger
+ scoring version
+ guardian state at evaluation boundary
```

Recommended stages:

```text
normalized activity
   ↓
quality / abuse classification
   ↓
base weights
   ↓
diminishing-return functions
   ↓
validation / collaboration modifiers
   ↓
XP + traits + Fame/Reputation deltas
   ↓
progression entries
   ↓
level/evolution/achievement evaluation
```

### Versioning

Every score-producing record should reference `scoring_version`.

When a formula changes:

- new events use the new version
- historical rescore is an explicit migration/job
- user-visible changes caused by rescore can be audited

## 12. Anti-farming architecture

Anti-farming should begin rules-based and explainable.

Signals can include:

- event frequency bursts
- repeated commit-message patterns
- repeated self-open/self-close loops
- repository age and interaction diversity
- number of distinct collaborators
- repeated low-value repositories created only for scoring
- anomalous star/fork velocity

Output should be flags/modifiers, not opaque account bans by default.

Example:

```json
{
  "burst_discount": 0.35,
  "self_interaction_discount": 0.5,
  "collaboration_bonus": 1.2,
  "suspicious": false
}
```

Keep a manual moderation path for economic or leaderboard abuse.

## 13. Progression calculation

Separate dimensions:

```text
lifetime XP -> Level
dimension scores -> Traits
recent qualified activity -> Power
attention signals -> Fame
collaboration signals -> Reputation
Arena results -> Rating
```

Power should use a decayed recent window so established accounts are not permanently unbeatable.

Level should be monotonic.

Fame should not directly translate 1:1 into combat stats.

## 14. Evolution engine

Evolution should be a state machine driven by explicit criteria.

Example:

```text
HATCHLING
  ↓ level + trait gate
EVOLUTION_1
  ↓ level + archetype + achievement gate
EVOLUTION_2
  ↓ rare criteria / long-term milestone
LEGENDARY_FORM
```

The engine produces an `evolution_unlocked` domain event. Asset generation consumes that event asynchronously.

Evolution identity input:

```text
canonical DNA
+ target stage
+ unlocked mutation traits
+ visual schema version
```

## 15. AI asset pipeline

The AI pipeline must be asynchronous, idempotent, observable, and provider-agnostic.

### Canonical generation

```text
DNA
  ↓
prompt compiler
  ↓
provider adapter
  ↓
raw generated asset
  ↓
moderation/validation
  ↓
normalization
  ↓
object storage
  ↓
asset record READY
```

### Provider abstraction

Define a narrow adapter:

```text
generateImage(request)
editImage(request)
getCapabilities()
estimateCost(request)
```

Do not spread GPT Image or Gemini-specific request schemas across domain code.

### Retry rules

- compute an idempotency fingerprint before enqueue
- one logical asset may have multiple attempts
- retries do not create duplicate user-visible assets
- permanently failed jobs surface an owner-friendly fallback
- provider outages must not take down profile rendering

### Cost controls

- never generate for anonymous page views
- budget per guardian/evolution
- cache permanent outputs
- deduplicate equivalent requests
- record provider/model/token or image cost metadata
- implement global and per-user generation rate limits

## 16. Sprite architecture

Hero images and sprites are separate asset types.

Recommended approach:

1. generate canonical hero/reference sheet
2. derive fixed poses from the reference
3. convert/normalize into constrained sprite frames
4. validate dimensions, alpha, anchors, and silhouette
5. package animation metadata

Equipment should be layered where possible:

```text
base body
+ armor layer
+ head layer
+ weapon layer
+ aura layer
+ companion layer
```

This prevents every cosmetic combination from becoming a new AI generation problem.

## 17. Share-card rendering

Share cards should be deterministic server-rendered assets or HTML-to-image renders using already approved guardian assets.

Pipeline:

```text
milestone domain event
   ↓
share-card job
   ↓
render template
   ↓
storage/CDN
   ↓
attribution URL
```

Do not invoke an image-generation model merely to add text to a card.

## 18. README embed architecture

Provide an endpoint such as:

```text
/card/:username.svg
```

Requirements:

- CDN cacheable
- bounded rendering time
- sanitized text
- stable dimensions
- no authentication required
- link target goes to GitHatch profile
- cache invalidation on meaningful profile change

If animated formats are introduced, preserve a cheap static fallback.

## 19. Discovery architecture

Discovery rankings should be computed asynchronously and materialized rather than recomputed from raw GitHub state on every request.

Candidate materialized lists:

- rising guardians
- trending repositories
- underdogs
- maintainers
- shippers
- collaborators
- new hatchlings

Ranking inputs should be explainable and versioned.

Popularity alone should never be the only ranking signal.

## 20. Arena architecture

Arena is introduced only after the profile/share/discovery loop passes product validation.

### Match request

```text
player enters queue
  ↓
matchmaking snapshot
  ↓
select compatible opponent
  ↓
freeze combat inputs
  ↓
seed simulation
  ↓
run deterministic battle engine
  ↓
persist result + replay events
  ↓
update rating transactionally
```

### Determinism

Given the same frozen input and seed, the server should reproduce the same battle result. This makes disputes, testing, and replay generation manageable.

### Battle snapshot

Never query mutable live values midway through a match.

Persist:

```text
participant IDs
rating before
power snapshot
loadout snapshot
ability versions
season version
simulation seed
result
rating after
replay event stream
```

### Repository discovery integration

Battle snapshots should include selected supporting repositories so the replay and result surfaces can link back to real work.

## 21. Economy architecture

Economy state must be auditable and transactional.

Tables/concepts:

```text
wallets
currency_ledger
inventory_items
catalog_items
entitlements
purchase_orders
equipment_loadouts
```

Never store a mutable currency balance without an append-only ledger capable of explaining it.

Payment provider webhooks must be idempotent.

Premium entitlements must not directly alter organic discovery rank.

## 22. Seasons

A season is versioned configuration:

```text
season_id
starts_at
ends_at
rules_version
rating_reset_policy
allowed_item_pool
modifiers
reward_catalog
```

Permanent guardian identity and lifetime level survive seasons. Seasonal rating, passes, and event progression may reset.

## 23. Guilds and raids

These are Phase 6 systems and should use separate modules rather than being baked into guardian ownership.

Possible Guild model:

```text
guild
guild_member
github_org_link
guild_season_score
```

Repo Raid model:

```text
raid
raid_repository
raid_participant
raid_contribution
raid_reward
```

Real GitHub milestones can inspire narrative raid events, but game completion must never block an actual repository workflow.

## 24. Analytics architecture

Track product analytics as first-class domain events rather than relying only on pageview analytics.

Critical events:

```text
profile_viewed
egg_viewed
claim_started
claim_completed
hatch_completed
guardian_shared
share_link_opened
readme_embed_rendered
readme_embed_clicked
repository_clicked
evolution_unlocked
arena_match_completed
arena_repository_clicked
purchase_completed
```

Repository discovery events need session-level deduplication to avoid inflated North Star metrics.

## 25. Caching strategy

Suggested cache layers:

### CDN

- public profile HTML where appropriate
- guardian assets
- README cards
- share cards

### application cache

- public GitHub lookups
- profile view models
- discovery lists
- rate-limit counters

### invalidation

Use domain events such as `guardian_progressed`, `profile_updated`, and `asset_ready` to invalidate affected cache keys.

Avoid globally purging the CDN on every commit event.

## 26. Rate limits and backpressure

External systems are constrained resources.

Implement separate concurrency/rate budgets for:

- GitHub API calls
- GitHub bootstrap syncs
- AI generation provider
- share-card renderer
- discovery recomputation

Queue depth should be observable by job type.

When AI generation is overloaded, profile progression can continue while visual reveal waits. Product truth must not depend on asset provider availability.

## 27. Security

### GitHub credentials

- use server-side OAuth/App credentials
- never expose installation tokens to browser clients
- minimize scopes
- rotate secrets
- verify webhook signatures

### User-controlled content

Sanitize:

- GitHub bios
- repository descriptions
- custom profile links
- pet names
- guild names

### AI prompts

Treat GitHub text as untrusted input. Do not directly concatenate arbitrary repository text into system-level generation prompts without escaping and length limits.

### Economy

All purchase and currency mutations occur server-side in transactions.

### Admin

Moderation and economic adjustment endpoints require stronger authorization and audit logs.

## 28. Reliability requirements

Initial targets can be modest, but architecture should support:

- cached public profiles during partial GitHub outages
- retryable background jobs
- dead-letter queues
- idempotent webhook processing
- idempotent payment processing
- asset provider failover or graceful fallback
- database backups and point-in-time recovery

## 29. Observability

Track:

### API

- latency by route
- error rates
- cache hit ratio

### GitHub integration

- API requests and rate-limit remaining
- webhook lag
- sync job age
- reconciliation drift

### progression

- events normalized/minute
- scoring errors
- suspicious-event rate
- score distribution by activity type

### AI

- generation attempts/success/failure
- latency by provider/model
- cost per asset type
- cost per claimed guardian
- moderation rejection rate

### product

- claim rate
- hatch completion
- share rate
- repository discovery events

## 30. Testing strategy

### Unit tests

High coverage on:

- seed/DNA determinism
- normalization
- scoring
- diminishing returns
- evolution criteria
- battle simulation
- economy ledger rules

### Contract tests

- GitHub provider adapters
- image-provider adapters
- object storage
- payment provider

### Replay tests

Store fixtures for activity ledgers and expected progression output under each scoring version.

### Property tests

Useful invariants:

- Level never decreases.
- Same DNA seed/version yields same DNA.
- Same Arena snapshot/seed yields same result.
- Currency ledger cannot produce impossible negative states unless explicitly allowed.
- Anonymous profile view cannot enqueue AI generation.

## 31. Deployment evolution

### Stage A

One web application + one worker + PostgreSQL + Redis + object storage.

### Stage B

Separate high-volume workers such as AI generation and GitHub ingestion if they contend with web traffic.

### Stage C

Extract only domains that demonstrate independent scaling or security requirements, likely:

- asset generation
- Arena simulation
- analytics/ranking

Do not pre-emptively split domain logic across network boundaries.

## 32. Architecture decision principles

1. Database state is canonical; generated assets are derivatives.
2. Guardian DNA is canonical; AI does not own identity.
3. Activity ledger is append-oriented and explainable.
4. Scoring and normalization are separately versioned.
5. Every expensive external action is asynchronous and idempotent.
6. Public page traffic cannot trigger unbounded external spend.
7. The system continues functioning when image generation is degraded.
8. Arena results are reproducible.
9. Economy mutations are ledgered and transactional.
10. Microservices are an optimization, not a starting aesthetic.
