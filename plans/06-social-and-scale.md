# Phase 6 - Social systems and scale

## Goal

Expand GitHatch from individual guardian identity into a persistent developer game world only after product data shows that users want to cooperate, compete repeatedly, and organize around repositories or communities.

This phase is intentionally modular. Repo Raids, Guilds, creator collaborations, social graph, and platform APIs should be treated as independent bets rather than one mandatory mega-release.

## Entry gate

Before building major social systems, look for evidence such as:

- repeated Arena participation
- users repeatedly visiting the same builders/repos
- organic challenge behavior
- requests for teams/organizations
- strong repository discovery traffic
- sustained cosmetic/season engagement where economy exists

## Part A - Repo Raids

### Product idea

A repository can receive a time-bounded cooperative narrative encounter.

Example:

```text
AGENTKIT

Dependency Dragon
HP: 12,430

Community Raid
██████████░░ 82%

47 Guardians participating
```

The raid is a game layer, not a gate on actual repository work.

### Inputs

Possible raid contribution signals:

- qualified GitHub contributions
- community game actions
- repository discovery/support actions with anti-farming constraints
- season-specific objectives

### Requirements

- raid definition/version
- repository association
- start/end state machine
- participant ledger
- idempotent contribution settlement
- reward eligibility
- repository links throughout UI

### Safety rule

Never claim that defeating a GitHatch boss technically caused a GitHub release unless the repository owner explicitly created such a playful integration. Default copy should say the raid celebrates or accompanies a real milestone.

## Part B - Guilds and GitHub organizations

### Product idea

Optionally map a GitHub organization or community identity into a GitHatch Guild.

```text
GitHub Organization
        ↓
GitHatch Guild
```

### Data model

```text
guild
guild_member
guild_role
github_org_link
guild_season_score
guild_event
```

### Organization verification

Do not allow arbitrary users to claim an official organization identity.

Require a defensible verification method using GitHub organization membership/permissions or an explicit admin/manual process.

### Initial features

- guild profile
- member roster
- aggregate guardian showcase
- guild achievements
- seasonal guild ranking
- cooperative Raid participation

Guild-vs-guild wars are a later experiment, not a starting requirement.

## Part C - Community quests

### Goal

Use time-bounded quests to direct attention toward useful community behavior.

Examples:

- discover three underdog repositories in a category
- participate in a cooperative raid
- review/engage with open-source work through externally validated flows
- seasonal technology/community exploration

### Rules

Do not create quests that incentivize GitHub spam such as opening meaningless issues or PRs purely for rewards.

Where a quest involves GitHub activity, only reward normalized, qualified actions already supported by anti-farming rules.

## Part D - Repository and creator ecosystem

### Repository-themed cosmetics

Allow approved OSS projects or developer brands to collaborate on official items.

Examples:

- project weapon skin
- framework-themed aura
- organization background
- mascot companion

### Partnership workflow

- verify project/brand authority
- create collection
- review legal/brand assets
- publish catalog
- track sales/claims
- calculate revenue share/donation if enabled

Start manually. Automate partner onboarding only after repeatable demand exists.

### Creator economy caution

Do not jump directly to an open marketplace. Moderation, copyright, payouts, fraud, and asset compatibility become a separate business overnight.

A curated collection model is a safer first step.

## Part E - Social graph

Potential relationships:

- follow
- rival
- ally
- recent opponents
- guild membership

### Requirements

- privacy/blocking model
- notification controls
- spam limits
- relationship uniqueness/idempotency

Avoid building direct messaging until there is a strong product reason. Messaging adds moderation and abuse complexity disproportionate to the core discovery thesis.

## Part F - Trust, moderation, and abuse

As the product becomes social/economic, trust systems become more important.

### Moderation surfaces

- guardian names
- profile text/links
- guild names/descriptions
- user-uploaded assets if introduced
- generated AI assets
- comments/messages if ever introduced

### Abuse systems

- reporting
- blocking
- moderation queue
- account sanctions
- economic freeze where required
- appeal/audit trail

### Competitive integrity

Detect:

- account rings
- match farming
- raid farming
- fake GitHub activity clusters where detectable
- coordinated discovery manipulation

Rules should remain explainable where possible.

## Part G - Scale and reliability

Do not extract services just because Phase 6 sounds "enterprise".

Use production telemetry to identify actual bottlenecks.

Likely extraction candidates if needed:

### AI asset workers

Reason:

- expensive external calls
- independent concurrency controls
- provider-specific dependencies

### GitHub ingestion workers

Reason:

- high event volume
- rate-limit/backpressure isolation

### Arena simulation workers

Reason:

- CPU load and deterministic batch processing

### Analytics/ranking pipeline

Reason:

- large materialized ranking computations

The primary product API can remain a modular monolith much longer than fashion would suggest.

## Part H - Platform/API experiments

Only expose a public API/SDK if external developers demonstrate demand.

Potential capabilities:

- public guardian profile lookup
- verified embed generation
- public achievement/milestone feed
- webhook for guardian evolution
- organization integrations

### Security

- scoped API keys/OAuth
- rate limits
- no private GitHub data by default
- stable versioned response contracts

Do not expose internal scoring implementation in a way that makes farming trivial. Explanations can be transparent without publishing every abuse threshold.

## Part I - Analytics and success criteria

### Social metrics

- follows per active user
- repeated profile visits
- guild participation
- Raid participation/completion
- challenge recurrence

### Discovery metrics

- repository discoveries from Guild/Raid surfaces
- unique under-discovered repos receiving traffic
- repeat visitors to repositories/builders

### Ecosystem metrics

- partner collection demand
- partner-driven new users
- project revenue share/donations where enabled

### Reliability metrics

- event ingestion lag
- queue lag by workload
- ranking freshness
- simulation throughput
- AI generation backlog
- cache hit rate

## Scale milestones

Scale decisions should be tied to thresholds defined from observed production behavior, for example:

- sustained queue lag beyond SLO
- provider rate-limit saturation
- worker CPU contention affecting web latency
- ranking jobs exceeding freshness budget

Do not invent distributed systems requirements before these conditions exist.

## Data lifecycle

By this phase, formalize retention policies for:

- raw GitHub provider payloads
- normalized activity ledger
- battle snapshots/replays
- analytics sessions
- payment/economy audit records
- generated asset provenance

Keep only what the product, legal, debugging, and audit requirements justify.

## Disaster recovery

Define and test:

- database point-in-time recovery
- object-storage backup/versioning as appropriate
- queue loss/replay strategy
- provider credential rotation
- payment ledger reconciliation
- GitHub resync after outage

## Testing

### Raids

- duplicate GitHub activity cannot grant raid credit twice
- raid expiry/settlement is deterministic
- reward settlement is idempotent

### Guilds

- organization claim authorization
- membership role changes
- user cannot join impossible duplicate memberships where rules forbid it

### Economy partners

- revenue records reconcile to underlying orders
- revoked/refunded transactions handled correctly

### Scale

- load tests for hottest profile/discovery routes
- queue saturation tests
- GitHub rate-limit degradation tests
- AI provider outage tests

## Rollout strategy

Treat Phase 6 as separate experiments:

1. run one manually curated Repo Raid
2. launch invite-only Guilds for selected organizations
3. run one repository-themed cosmetic collaboration
4. measure social/discovery lift
5. automate only the systems that repeat successfully

## Exit criteria

There is no single final "Phase 6 complete" state. The phase is an expansion framework.

A social subsystem earns continued investment when it measurably improves at least one of:

- retention
- repository discovery
- healthy community participation
- sustainable revenue

without creating disproportionate moderation, abuse, or infrastructure cost.

## Long-term thesis

If the previous phases work, GitHatch can evolve from:

```text
GitHub pet profile
```

into:

```text
developer identity
+ game progression
+ repository discovery
+ competition
+ community
+ attention marketplace
```

The guardian remains the accessible emotional interface. The durable network value comes from the graph of builders, repositories, activity, identity, and attention behind it.
