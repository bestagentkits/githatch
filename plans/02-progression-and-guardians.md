# Phase 2 - Progression and repository guardians

## Goal

Make real GitHub activity produce understandable guardian progression and repository storytelling while preventing obvious contribution farming.

The phase validates:

> Does useful GitHub work create progression developers care about without incentivizing meaningless activity?

## Dependencies

Requires claimed guardians, repository bootstrap, activity ledger, scoring framework, and analytics from Phases 0-1.

## Workstream A - GitHub ingestion

### Sources

Use the best available combination of:

- GitHub App webhooks
- authenticated GitHub APIs
- public APIs for non-installed data
- scheduled reconciliation

### Tasks

- create signed webhook endpoint
- persist raw webhook events before async work
- normalize supported event types
- implement periodic reconciliation jobs
- record source and data completeness
- monitor GitHub rate-limit budgets

### Reliability rules

- acknowledge valid webhooks quickly
- processing is asynchronous
- duplicate webhook deliveries are harmless
- reconciliation can correct missed events

## Workstream B - Normalization

For each supported GitHub event, implement a provider parser and normalized activity output.

Initial activity set:

- commit authored
- PR opened
- PR merged
- external PR merged
- issue opened
- issue resolved
- review submitted
- release published
- stars gained
- forks gained
- new external contributor

### Tests

Create fixture-based tests from realistic provider payloads.

Narrative rendering and scoring must consume normalized events, never raw provider payloads directly.

## Workstream C - Scoring v1 productionization

### Dimensions

Compute changes across:

- lifetime XP
- Power
- Fame
- Reputation
- trait dimensions such as Shipping, Collaboration, Consistency, Impact

### Diminishing returns

Implement bounded functions per event family.

Examples:

- early meaningful commits in a work period can contribute small XP
- the 30th tiny commit in a burst contributes close to zero
- one meaningful release should outweigh commit-message spam
- collaboration with distinct external users can receive a validation modifier

### Explanations

Persist enough information to explain a progression event:

```text
PR merged
base XP: 40
collaboration modifier: 1.2
burst modifier: 1.0
final XP: 48
```

The exact values are configuration, not hard-coded UI truth.

## Workstream D - Anti-farming v1

Start conservative and explainable.

### Rules

- event-family caps/windows
- burst discounts
- repeated-message/duplicate-pattern flags
- self-interaction discounts
- low-diversity repository activity flags
- external collaborator bonus
- suspicious star/fork growth flagging

### Admin/debugging

Build an internal view showing:

- raw normalized activities
- quality flags
- modifiers
- final score
- current scoring version

Do not auto-ban accounts solely from weak heuristics in v1.

## Workstream E - Level and traits

### Level

Lifetime XP maps monotonically to Level through a versioned curve.

Requirements:

- Level never decreases under ordinary operation
- curve is configurable
- level-up event is durable

### Traits

Expose a small readable set, for example:

- Shipping
- Collaboration
- Consistency
- Impact
- Craftsmanship if a defensible signal exists later

Do not invent precision unsupported by source data. A trait should only exist if the input signals can be explained.

## Workstream F - Current Power

Power should favor recent meaningful activity so old famous accounts are not permanent bosses.

Possible model:

```text
qualified progression entries
  ↓
time-decay window
  ↓
trait/archetype modifiers
  ↓
current Power
```

Arena does not exist yet, but this prepares its fairer input model.

## Workstream G - Fame and Reputation

### Fame

Inputs can include repository attention/momentum and GitHatch discovery signals.

Fame should influence cosmetic/social presentation more strongly than combat.

### Reputation

Favor externally validated collaboration:

- reviews
- merged contributions involving others
- external contributors to maintained repos
- sustained open-source maintenance signals

Keep the formula conservative until enough real data exists.

## Workstream H - Repository guardianship

### Profile

Show:

- primary guarded repository
- additional guarded repositories
- repository momentum/status
- recent meaningful events
- direct GitHub links

### Selection

Owner chooses the primary repository from eligible public repositories. The system may recommend one based on recent activity but should not silently change the user's featured project.

## Workstream I - Narrative event feed

Map normalized activities to deterministic story templates.

Examples:

```text
PR_MERGED
→ Emberfox completed a quest in bestagentkits/githatch.

RELEASE_PUBLISHED
→ The githatch realm was upgraded to v0.2.0.
```

Requirements:

- retain real event date
- link to GitHub artifact
- never fabricate code impact
- use bounded templates
- allow localization later

An LLM is not needed to explain events in v1.

## Workstream J - Achievements v1

Create versioned achievement definitions such as:

- First Release
- First External Contributor
- Ten Merged PRs
- Consistent Builder
- Maintainer milestone

Avoid achievements that reward unhealthy daily streak obsession.

Achievement evaluation consumes normalized/progression events and is idempotent.

## Workstream K - Activity state

Guardian energy state provides narrative feedback without punishment.

Suggested states:

```text
Energetic
Active
Resting
Sleeping
```

Inactivity changes animation/presentation only. It does not kill the pet or remove permanent progress.

## Workstream L - Progression UI

Profile adds:

- Level and XP bar
- readable traits
- current state
- achievement shelf
- recent progression feed
- scoring explanation affordance for major events

Avoid showing dozens of opaque stats.

## Analytics

Track:

- progression event delivered
- level-up viewed
- achievement viewed
- repository card clicked
- narrative event clicked
- returning owner after progression event

Create distributions for XP source by activity type and account cohort.

## Testing

### Determinism

Same ledger and scoring version produce same progression entries.

### Diminishing returns

Test high-volume synthetic spam scenarios.

### Collaboration

External interaction cannot be trivially forged by repeatedly interacting with the same controlled account without hitting discounts/flags.

### Reconciliation

Missed webhook fixture followed by reconciliation yields the correct logical ledger without duplication.

### User-visible correctness

Every narrative feed event points to the correct repository/artifact or clearly indicates when no link exists.

## Rollout strategy

- enable scoring for internal/test users
- shadow-compute score distributions
- inspect extreme accounts manually
- adjust weights/version before making rankings public
- roll out profile progression broadly

Do not launch a public competitive leaderboard until score distributions are understood.

## Phase metrics

- percentage of claimed users with qualified progression
- progression processing latency
- return rate after progression
- repository outbound CTR
- XP share by event family
- percentage of events discounted/flagged
- concentration of Power among top accounts

## Exit gate

Proceed when:

- progression is understandable to users
- real shipping/collaboration visibly matters
- obvious commit spam has poor marginal returns
- repository links receive meaningful clicks
- score distribution is not catastrophically dominated by historical popularity

## Explicit non-goals

- AI semantic judgment of code quality
- Arena combat
- paid boosts
- complex crafting
- daily-death/streak punishment
