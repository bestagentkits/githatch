# GitHatch roadmap

## 1. Roadmap philosophy

GitHatch should be developed through validation gates rather than by blindly completing a feature checklist.

The dependency chain is:

```text
identity
  ↓
hatch
  ↓
progression
  ↓
sharing
  ↓
repository discovery
  ↓
competitive discovery
  ↓
economy
  ↓
social world
```

The project should not invest heavily in Arena, marketplace, guilds, or raids before the identity/share/discovery loop demonstrates real demand.

## 2. Phase overview

| Phase | Theme | Primary question |
|---|---|---|
| 0 | Foundation | Can we establish trustworthy identity, data, scoring, and cost boundaries? |
| 1 | Hatch and profile | Will developers claim a guardian representing their GitHub identity? |
| 2 | Progression and repository guardians | Does real GitHub work create understandable, motivating progression? |
| 3 | Evolution and distribution | Will users care enough to evolve and share their guardian? |
| 4 | Discovery and Arena | Can competition redistribute attention toward real repositories? |
| 5 | Economy and seasons | Can monetization support expression without destroying competitive trust? |
| 6 | Social systems and scale | Do users want persistent cooperation, communities, and an ecosystem? |

Detailed execution plans live in `plans/`.

## 3. Phase 0 - Foundation

### Objective

Build the minimum technical contracts that all later game systems depend on.

### Deliverables

- application skeleton
- relational database and migrations
- background queue and worker
- cache and object storage
- GitHub OAuth/App integration
- stable GitHub identity model using numeric IDs
- public profile lookup cache
- activity event vocabulary
- immutable/append-oriented activity ledger
- scoring v1 contract
- deterministic DNA schema v1
- deterministic egg renderer
- AI provider abstraction
- asset provenance/cost tracking
- analytics event schema
- baseline observability

### Exit gate

Proceed only when:

- the same GitHub user resolves consistently
- duplicate GitHub events do not create duplicate progression
- DNA generation is deterministic for the same seed/schema
- public profile traffic cannot create image-generation spend
- scoring is replayable from test fixtures
- background jobs are idempotent and observable

## 4. Phase 1 - Hatch and profile

### Objective

Deliver the first emotionally meaningful product loop from URL to claimed guardian.

### User journey

```text
/:username
  ↓
unclaimed egg
  ↓
Claim & Hatch
  ↓
GitHub auth
  ↓
DNA creation
  ↓
canonical pet generation
  ↓
hatch reveal
  ↓
claimed public profile
```

### Deliverables

- any valid public `/:username` route
- unclaimed profile state
- deterministic egg visuals
- account claim flow
- guardian creation transaction
- initial bootstrap sync
- canonical hero asset generation
- hatch reveal animation
- public claimed profile
- primary/featured repository selection
- graceful generation failure state
- basic owner settings

### Key metrics

- egg view → claim start
- claim start → claim complete
- claim complete → hatch complete
- generation failure rate
- generation cost per hatch

### Exit gate

Do not call Phase 1 validated merely because the flow works technically.

Look for evidence that users voluntarily claim profiles and complete the hatch experience at a meaningful rate.

## 5. Phase 2 - Progression and repository guardians

### Objective

Make GitHub activity visibly matter while preventing trivial farming.

### Deliverables

- GitHub activity normalization
- webhook/event ingestion where practical
- periodic reconciliation
- EXP/Level system
- trait dimensions
- Power, Fame, Reputation separation
- diminishing-return rules
- collaboration modifiers
- basic suspicious-activity flags
- repository guardianship UI
- deterministic narrative feed
- achievements v1
- Active/Resting/Sleeping state

### Key metrics

- percentage of claimed users receiving progression events
- progression latency
- user return after progression
- suspicious score concentration
- score distribution by event type
- repository link CTR from profile

### Exit gate

Progression must be understandable from UI explanations and obvious commit spam must not dominate rankings.

## 6. Phase 3 - Evolution and distribution

### Objective

Turn progression into emotional milestones and organic acquisition.

### Deliverables

- Evolution I and Evolution II
- archetype-aware evolution criteria
- canonical reference/character sheets
- sprite pipeline v1
- idle/work/celebration animations
- share cards
- milestone pages
- attribution links
- README profile cards
- social sharing flows
- basic profile-owner traffic analytics
- discovery homepage v1 with noncompetitive surfaces

### Key metrics

- hatch → share rate
- evolution → share rate
- README embeds created
- README embed CTR
- shares → profile visits
- shares → new claims
- profile → GitHub repository outbound CTR
- repository discovery events

### Critical validation gate

This is the most important product gate before Arena.

Arena should receive major investment only if evidence shows:

- users are emotionally attached enough to share guardians
- sharing creates new profile visits/claims
- GitHatch sends meaningful traffic to repositories

If these fail, improve identity, visuals, progression, and discovery before adding combat complexity.

## 7. Phase 4 - Discovery and Arena

### Objective

Use game competition to redistribute developer attention.

### Deliverables

- materialized discovery feeds
- Rising / Trending / Underdogs / Maintainers / Shippers
- rating model
- matchmaking service/module
- deterministic battle simulation
- short battle replay
- loadout and abilities v1
- repository-powered battle context
- post-match repository spotlight
- seasonal leaderboard foundation
- anti-collusion/abuse signals

### Arena product rule

Every match should contain a useful path back to the participants' real work.

### Key metrics

- match completion rate
- repeat Arena participation
- Arena → repository CTR
- unique repositories discovered through Arena
- match fairness distribution
- new/small account exposure
- share rate of battle results

### Exit gate

Arena must improve discovery rather than becoming an isolated minigame with vanity rankings.

## 8. Phase 5 - Economy and seasons

### Objective

Monetize identity and expression while preserving earned legitimacy.

### Deliverables

- inventory
- equipment/loadout persistence
- earned currency ledger
- premium entitlement/payment flow
- cosmetic catalog
- cosmetic equipment layering
- ranked stat normalization
- first season configuration
- seasonal rewards
- optional battle pass experiment
- sponsored discovery inventory separated from organic ranking
- economy administration/audit tooling

### Monetization order

Preferred sequence:

1. cosmetics
2. profile themes / effects
3. seasonal collectibles
4. battle pass if retention supports it
5. clearly labeled repository/guardian promotion
6. strategic horizontal equipment only after balance testing

Avoid selling direct organic rank or unbounded combat stats.

### Key metrics

- payer conversion
- cosmetic attach rate
- ARPPU
- season participation
- purchase-related churn/support issues
- free vs paid ranked win-rate distribution
- sponsored placement repository CTR

### Exit gate

Paid users must not demonstrate a structurally unavoidable ranked advantage caused by spend alone.

## 9. Phase 6 - Social systems and scale

### Objective

Expand GitHatch from individual identity into a persistent developer game world only after social demand exists.

Potential tracks:

### Repo Raids

Cooperative encounters attached narratively to repositories and milestones.

### Guilds

Optional mapping from GitHub organizations or community groups into GitHatch guilds.

### Community quests

Time-bounded events encouraging collaboration and project discovery.

### Repository-themed cosmetics

Official collections created with OSS projects or developer brands, potentially with revenue sharing.

### Social graph

Follows, rivals, allies, challenge history, guild relationships.

### Platform/API

Public profile APIs, embed SDKs, event hooks, or third-party integrations if ecosystem demand appears.

### Scale work

Extract high-volume components only when actual load justifies it.

## 10. Explicitly deferred ideas

The following should not block initial validation:

- real-time manual PvP
- dozens of species at launch
- private-repository ingestion
- user-to-user item trading
- complex crafting trees
- guild wars
- organization tournaments
- cross-chain/NFT ownership
- AI-generated animation for every equipment combination
- mobile native applications
- public developer API

## 11. Cross-phase technical tracks

Several concerns run continuously through all phases.

### Security and privacy

- minimum GitHub permissions
- signed webhook verification
- no private repositories by default
- owner authorization for profile mutations
- audit logs for economic/admin actions

### Abuse resistance

- scoring spam
- fake stars/forks
- multi-account Arena manipulation
- economy fraud
- offensive generated/user-generated content

### Cost control

- no AI generation on anonymous profile view
- provider budgets and rate limits
- permanent asset caching
- generation cost telemetry

### Observability

- GitHub rate limits and lag
- scoring queues
- AI queues and cost
- profile latency
- discovery freshness
- Arena determinism failures

### Accessibility and performance

- static fallback for animation
- low-bandwidth profile mode
- reduced-motion support
- CDN-based assets

## 12. Decision checkpoints

At the end of each phase, answer the relevant product question before continuing.

### Checkpoint A - after Phase 1

Do developers want to claim these identities?

If no, fix the hatch concept and visual desirability.

### Checkpoint B - after Phase 2

Does GitHub activity create progression people understand and care about?

If no, fix scoring and narrative mapping.

### Checkpoint C - after Phase 3

Do users share guardians and drive repository discovery?

If no, do not hide the failure behind Arena scope.

### Checkpoint D - after Phase 4

Does Arena increase attention and repeat engagement?

If no, simplify/rework competition.

### Checkpoint E - after Phase 5

Can monetization coexist with competitive trust?

If no, move monetization further toward cosmetics and clearly labeled promotion.

## 13. Definition of product-market evidence

GitHatch does not need conventional SaaS revenue to prove the first thesis.

Strong early evidence would look like:

- developers voluntarily share guardian cards without being asked repeatedly
- README embeds spread organically
- users type other GitHub usernames into GitHatch out of curiosity
- repository maintainers report inbound traffic from GitHatch
- milestone/evolution posts bring new claims
- discovery feeds surface projects users would not otherwise encounter

That proves the Trojan horse is working: the pet attracts attention, and the attention reaches real developer work.
