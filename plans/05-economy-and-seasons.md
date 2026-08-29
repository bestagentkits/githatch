# Phase 5 - Economy and seasons

## Goal

Introduce monetization after identity, progression, distribution, and Arena have demonstrated value.

The economy should monetize expression, collection, seasonal participation, and clearly labeled attention products without allowing wallet size to erase earned GitHub progression or organic ranking credibility.

## Entry gate

Before implementing the full economy, verify:

- users return for guardian progression
- users share/evolve guardians
- Arena or discovery has recurring engagement
- players value visual identity enough that cosmetics have plausible demand

## Product principles

1. Cosmetics first.
2. Organic discovery rank is never sold.
3. Ranked combat uses normalized budgets where required.
4. Every currency mutation is auditable.
5. Purchases grant entitlements idempotently.
6. Seasonal FOMO must not destroy permanent guardian identity.

## Workstream A - Inventory model

### Concepts

```text
catalog_item
inventory_item
item_definition
item_instance where needed
equipment_loadout
entitlement
```

Most cosmetics should use definition + ownership rather than unique instances unless uniqueness has real gameplay value.

### Item categories

- head cosmetics
- armor/body cosmetics
- weapon skins
- auras
- companions
- profile frames
- backgrounds/habitats
- emotes
- evolution skins
- titles/nameplates

## Workstream B - Earned currency

Create a game currency earned through qualified activity/game systems.

### Requirements

- append-only currency ledger
- balance derived or transactionally maintained against ledger
- idempotent reward grants
- anti-farming limits
- admin adjustment with audit reason

Earned currency may purchase standard cosmetics and bounded gameplay items.

Do not simply pay currency per raw commit.

## Workstream C - Premium purchases

Integrate a payment provider behind an application boundary.

### Flow

```text
create order
  ↓
redirect/confirm payment
  ↓
provider webhook
  ↓
verify signature
  ↓
idempotent order settlement
  ↓
grant entitlement
```

### Requirements

- never trust browser-only success state
- store provider transaction IDs
- handle duplicate webhooks
- support refund/reversal policy
- audit entitlement changes

Premium currency may be avoided entirely if direct SKU purchases are simpler for v1. Do not create virtual currency solely because games usually have one.

## Workstream D - Cosmetic composition

Use the slot/layer contract introduced in Phase 3.

### Tasks

- build catalog preview renderer
- validate item compatibility by species/evolution
- support item equip/unequip
- cache composed profile/card output where appropriate
- avoid AI regeneration for every equipment change

Some rare cosmetics may use generated assets, but generation cost and compatibility must be known before sale.

## Workstream E - Equipment and competitive integrity

If equipment affects gameplay, use horizontal tradeoffs.

Example:

```text
Flame Sword
+ fire attack modifier
- defense modifier
```

Avoid:

```text
$50 Legendary Sword
+500 all stats
```

### Ranked normalization

Define an allowed competitive budget/ruleset so purchased items cannot create unbounded advantage.

Possible policy:

- cosmetic-only items: no combat impact
- strategic items: same budget/tier pool in ranked
- casual/adventure modes: broader item stats if desired

Store item/rules versions in battle snapshots.

## Workstream F - Storefront

Initial storefront sections:

- Featured
- New
- Seasonal
- Guardian cosmetics
- Profile cosmetics

Requirements:

- clear pricing
- preview before purchase
- ownership state
- no dark-pattern purchase flows
- locale/currency strategy where provider supports it
- mobile-responsive checkout

## Workstream G - Seasons

A season packages fresh competitive and cosmetic content.

### Season configuration

```text
season_id
starts_at
ends_at
rules_version
arena_modifiers
rating_reset_policy
reward_track
catalog_availability
```

### Permanent vs seasonal

Permanent:

- guardian DNA
- lifetime Level
- evolution history
- durable owned cosmetics

Seasonal:

- Arena Rating/league where configured
- seasonal quests/progression
- limited modifiers
- season leaderboard

## Workstream H - Seasonal reward track

Start with an earned/free reward track.

If engagement supports it, experiment with a paid pass.

Rewards should lean toward:

- cosmetics
- backgrounds
- profile frames
- titles
- emotes
- bounded earned currency

Avoid locking core guardian progression behind the pass.

## Workstream I - Sponsored discovery

Create a completely separate product surface for paid attention.

Candidate products:

- Sponsored Guardian
- Featured Repository
- Launch Spotlight
- Promoted Raid later

### Rules

- every paid placement clearly labeled
- sponsored inventory stored separately from organic rank
- paid impressions/clicks measured separately
- targeting uses allowed contextual/product data, not private repository data
- no "pay to become #1 organic Arena rank"

This product can become more valuable than virtual items if GitHatch develops meaningful developer traffic.

## Workstream J - Repository-themed collaborations

Prepare a catalog ownership/partner model for official items such as project-themed cosmetics.

Potential flow:

```text
project/brand approved
  ↓
collection created
  ↓
assets reviewed
  ↓
items sold/earned
  ↓
revenue share or donation allocation
```

Do not build complex creator payouts before a small number of manual collaborations prove demand.

## Workstream K - Economy administration

Internal tools should support:

- catalog publish/unpublish
- price changes with history
- grant/revoke entitlement with audit reason
- currency adjustment
- order lookup
- refund state
- suspicious purchase flags
- season configuration

Admin changes require stronger authorization and audit logging.

## Workstream L - Economy abuse prevention

Threats:

- payment fraud
- duplicate settlement
- currency farming
- account resale pressure
- multi-account reward abuse
- refund after consumption where relevant

Start with provider fraud tooling plus server-side idempotency and gameplay reward caps.

## Testing

### Ledger

- duplicate reward event cannot mint twice
- balance reconciles to ledger
- adjustment is auditable

### Payments

- duplicate webhook grants one entitlement
- failed payment grants nothing
- refund policy produces expected entitlement state

### Ranked integrity

- paid cosmetic cannot affect combat
- strategic paid/owned items obey normalized budget
- battle snapshot preserves item version

### Sponsored discovery

- sponsored entry cannot leak into organic leaderboard calculations
- sponsorship label always rendered

## Rollout sequence

1. free earned cosmetics/inventory
2. limited paid cosmetic catalog
3. seasonal collection
4. first season rewards
5. paid pass experiment only if retention justifies it
6. sponsored repository experiment
7. manual project-themed collaboration

## Phase metrics

Commercial:

- payer conversion
- ARPPU
- cosmetic attach rate
- repeat purchase rate
- refund/dispute rate

Engagement:

- season participation
- reward-track completion
- cosmetic equip/share rate

Fairness:

- ranked win rate by spend bucket
- Rating distribution by spend bucket
- sentiment/support reports about pay-to-win

Sponsored:

- repository CTR
- cost per qualified repository discovery
- repeat sponsor demand

## Exit gate

The economy is healthy when monetization adds expression and sustainable revenue without causing paid users to have a structurally unavoidable competitive or organic-discovery advantage.

## Explicit non-goals

- speculative asset ownership
- blockchain/NFT integration
- unrestricted user-to-user trading
- cash-out economy
- gambling/loot-box mechanics
- selling organic leaderboard positions
