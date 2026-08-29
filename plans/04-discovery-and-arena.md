# Phase 4 - Discovery and Arena

## Goal

Turn GitHatch from a profile/progression product into a competitive discovery network where matches create attention for developers and repositories.

Arena should not be built as an isolated minigame. Every important competitive surface must retain a path back to real GitHub work.

## Entry gate

Do not begin full implementation until Phase 3 demonstrates meaningful share and repository-discovery signals.

## Product principles

1. Arena is initially an auto-battler.
2. Real GitHub work prepares the guardian; users do not need to play twitch-action combat.
3. Famous GitHub accounts must not automatically dominate ranked play.
4. Match results must be reproducible server-side.
5. Repository discovery is part of the battle UI, not an afterthought.
6. Matchmaking should create exposure opportunities for under-discovered builders.

## Workstream A - Discovery feeds v2

Materialize multiple discovery surfaces:

- Trending
- Rising
- Underdogs
- Maintainers
- Shippers
- Collaborators
- New Hatchlings
- Featured Repositories
- Arena leaders

### Ranking contract

Candidate factors:

```text
qualified activity quality
freshness
momentum
discovery need
rotation/diversity
abuse flags
```

Do not merge sponsored placement into the organic ranking formula.

### Tasks

- version ranking configurations
- batch/materialized feed computation
- feed cache and pagination
- exposure counters to reduce repeated monopoly
- category/language filters if data quality supports them
- analytics for impressions and repository clicks

## Workstream B - Arena rating

Implement a competitive Rating separate from Level, Power, Fame, and Reputation.

### Requirements

- rating changes only from qualified competitive outcomes
- rating snapshot before/after stored per match
- provisional/new-player handling
- seasonal reset policy supported
- inactivity decay only if product design chooses it explicitly

Start with a standard explainable rating model such as Elo/Glicko-style behavior rather than inventing complexity without data.

## Workstream C - Combat stat snapshot

At match creation, freeze all combat inputs:

- guardian version
- current Power
- archetype/class
- trait-derived combat mapping
- equipment/loadout
- ability versions
- season modifiers

Persist the snapshot so later progression cannot rewrite a past result.

## Workstream D - Ability system v1

Keep the first combat model small.

Example categories:

- basic attack
- defensive action
- archetype skill
- elemental interaction
- one equipment modifier

Avoid dozens of abilities at launch.

Each ability is versioned configuration/data with deterministic behavior.

## Workstream E - Deterministic simulation engine

### Contract

```text
battle snapshot A
battle snapshot B
season/rules version
seed
      ↓
simulation
      ↓
result + replay events
```

Same inputs must reproduce the same result.

### Replay event examples

```text
ROUND_STARTED
ATTACK
DAMAGE
BLOCK
STATUS_APPLIED
ABILITY_USED
KO
MATCH_ENDED
```

UI animation consumes replay events. UI timing never determines game truth.

## Workstream F - Matchmaking

Candidate matchmaking signals:

- Rating proximity
- Power band
- opponent repetition avoidance
- recent activity recency
- account trust/abuse state
- repository discovery opportunity

Do not use repository popularity as a simple combat advantage.

### New-player protection

- provisional placement matches
- wider exposure rotation
- avoid immediate pairing against dominant veterans where possible

## Workstream G - Battle presentation

Target replay length: approximately 10-20 seconds for the initial experience.

Add combat sprites:

- attack
- hurt
- skill
- win

Support reduced-motion mode using simplified transitions/event log.

### Before battle

Show the real work contributing context to the guardian, for example:

```text
POWERED BY
AgentKit      43%
ClaudeKit     22%
GoClaw        14%
```

Percentages must be derived from a documented model, not fake decorative precision.

### After battle

Show:

- winner
- rating delta
- short replay summary
- MVP/featured repository
- direct `Explore repository` action

## Workstream H - Repository spotlight attribution

Every battle repository click emits an attributable discovery event.

Track:

- battle impression
- repository spotlight impression
- repository click
- GitHub outbound URL
- participant/season/match context

Do not leak private identifiers in public query strings.

## Workstream I - Leaderboards

Views:

- Today where meaningful
- This week
- Season
- All-time lifetime categories where appropriate

Keep seasonal Rating separate from lifetime Level/Fame.

Use pagination and anti-scraping controls where necessary.

## Workstream J - Challenge flow

After ranked auto-match is stable, add friendly challenges.

Requirements:

- challenge links or user selection
- explicit expiry
- no or separate Rating impact
- abuse/rate limits
- shareable result

Friendly challenges are useful viral content but must not become an easy farming vector.

## Workstream K - Anti-collusion and abuse

Initial signals:

- repeated pair farming
- challenge spam
- multi-account patterns where detectable
- suspicious outcome loops
- rating manipulation
- automated match flooding

Arena settlement checks eligibility before changing Rating/rewards.

## Workstream L - Seasonal foundation

Implement season records and rule versions even before monetized battle passes.

Season defines:

- start/end
- rules version
- modifier set
- rating reset policy
- leaderboard scope
- cosmetic/achievement rewards if any

Permanent guardian identity survives resets.

## Tests

### Simulation

- deterministic seed tests
- ability interaction matrix
- no impossible negative/overflow states
- replay fully reconstructs the result

### Settlement

- retry does not apply Rating twice
- match cannot settle before valid result
- disconnected/reloaded client cannot alter outcome

### Matchmaking

- acceptable Rating bands
- repeated opponent constraints
- provisional-player behavior

### Discovery

- organic feed not affected by sponsored records
- battle repository links match snapshots

## Rollout

1. internal simulation with synthetic guardians
2. shadow Arena using real guardian snapshots without user-visible Rating
3. invite-only matches
4. public unranked Arena
5. ranked season beta

Inspect win-rate distribution by Power, Level, Fame, account age, and spend state before monetized equipment exists.

## Phase metrics

Product:

- Arena entry rate
- match completion
- matches/user/week
- battle-result share rate
- Arena → repository CTR
- unique repositories discovered
- repeat Arena participation

Fairness:

- win distribution by account-age bucket
- win distribution by GitHub popularity/Fame bucket
- Rating concentration
- new-player retention

Operational:

- simulation latency
- settlement errors
- replay failures
- matchmaking wait time

## Exit gate

Arena is successful when it creates repeat engagement and measurable repository discovery without becoming a leaderboard that merely restates existing GitHub fame.

## Explicit non-goals

- real-time manual combat
- esports-grade spectator infrastructure
- cash-prize tournaments
- guild wars
- paid stat dominance
