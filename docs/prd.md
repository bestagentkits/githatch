# GitHatch product requirements document

## 1. Product summary

GitHatch is a gamified identity and discovery layer built on top of GitHub.

Any public GitHub profile can be viewed as a GitHatch profile by replacing the domain:

```text
https://github.com/mrgoonie
              ↓
https://githatch.com/mrgoonie
```

The developer is represented by a persistent fantasy guardian. The guardian hatches from an egg, gains experience from meaningful GitHub activity, evolves visually, protects repositories, competes in an Arena, and acts as a discovery surface for the developer's projects.

The core product thesis is intentionally broader than "GitHub contributions as a pet":

> GitHatch is a developer attention network disguised as a pet game.

GitHub is the source of proof-of-work. GitHatch converts that work into identity, entertainment, discovery, and attention.

## 2. Problem statement

GitHub profiles are useful for inspecting a developer's work, but they are weak as entertainment and discovery products.

Current profile surfaces have several limitations:

- Contribution graphs communicate quantity more clearly than meaning.
- Repository lists are useful but visually flat.
- Small but high-quality projects are difficult to discover.
- Developers have little reason to repeatedly visit another developer's profile.
- Milestones such as releases, merged PRs, new contributors, and repository momentum are not packaged into shareable identity moments.
- Existing gamification approaches can over-reward raw activity counts and accidentally encourage low-value contribution farming.

GitHatch should make developer identity fun enough to revisit and share, while still pointing attention back to real repositories and work.

## 3. Product goals

GitHatch should:

1. Make GitHub identity expressive and entertaining.
2. Create emotional attachment through a persistent guardian identity.
3. Reward meaningful work instead of raw activity volume.
4. Make under-discovered developers and repositories easier to find.
5. Drive measurable outbound traffic to GitHub repositories, demos, products, and personal sites.
6. Turn real GitHub milestones into shareable game moments.
7. Support competitive gameplay without invalidating earned progression through pay-to-win mechanics.
8. Create a foundation for cosmetics, seasons, sponsored discovery, and community systems.

## 4. Non-goals

The first release is not intended to be:

- a replacement for GitHub
- a real-time action game
- a full MMO
- a marketplace-first product
- an NFT/blockchain project
- a system where every commit maps directly to power
- a private-repository analytics product
- a productivity surveillance tool

GitHatch should add a playful discovery layer over GitHub, not create a second code-hosting platform.

## 5. Target users

### 5.1 Primary users

Open-source developers, indie builders, maintainers, founders, and active GitHub users who want a more expressive public developer identity and more attention for their projects.

### 5.2 Secondary users

- developers browsing other builders
- open-source contributors looking for interesting repositories
- GitHub organizations and developer communities
- developer-tool companies looking for relevant sponsorship surfaces
- fans or followers who enjoy collecting, comparing, and sharing guardians

## 6. Core product loop

```text
GitHub activity
      ↓
meaningful event normalization
      ↓
EXP / traits / achievements
      ↓
guardian grows or evolves
      ↓
user shares guardian or enters discovery surfaces
      ↓
visitors discover developer and repositories
      ↓
outbound GitHub traffic / follows / contributors
      ↓
more meaningful activity
      ↺
```

A second acquisition loop begins before the user has signed up:

```text
visit githatch.com/:username
      ↓
see deterministic unclaimed egg
      ↓
curiosity / claim CTA
      ↓
GitHub authentication
      ↓
hatch
      ↓
share
      ↓
new visitors substitute their own username
```

## 7. First-time experience

### 7.1 Public unclaimed profile

Any valid public GitHub user should have a GitHatch route even if they never signed up.

The unclaimed experience must not trigger expensive AI image generation. It should render a deterministic egg generated from stable public metadata.

Example:

```text
Mysterious Egg

Power potential: ★★★★☆
Element: ???
Mutation: ???
Repositories detected: 43

This guardian hasn't been hatched yet.

[ Claim & Hatch ]
```

The egg should be derived from a stable seed such as GitHub numeric user ID plus a versioned public-profile fingerprint.

### 7.2 Claim and hatch

The owner authenticates through GitHub, proves ownership of the GitHub account, and begins the hatch flow.

The system then:

1. creates or resolves the user record
2. snapshots public GitHub identity
3. derives deterministic guardian DNA
4. creates the canonical guardian record
5. queues initial hero artwork generation
6. plays a hatch reveal once the asset is ready
7. presents species, element, rarity, archetype, initial attributes, and primary repository
8. offers a share action

The same account must never receive a completely unrelated guardian because a generation request was retried.

## 8. Guardian DNA

AI must render a structured identity rather than invent a new identity on every call.

A guardian has versioned canonical DNA including fields such as:

```yaml
species: fox
element: fire
archetype: builder
temperament: chaotic
palette: crimson-gold
silhouette_family: vulpine-a
markings: ember-tail
mutation_seed: 88271921
traits:
  collaboration: 71
  consistency: 85
  impact: 64
  shipping: 91
```

DNA should be deterministic for initial creation, persistent after claim, and independently versioned from generated artwork.

Evolution should preserve recognizable identity while adding maturity, equipment, mutations, and stronger silhouettes.

## 9. Repository guardianship

The guardian represents the developer but narratively protects one or more repositories.

The profile should feature a primary guarded repository and optionally additional repositories.

GitHub events can be translated into deterministic game language:

| GitHub event | Game narrative |
|---|---|
| issue opened | threat appeared |
| issue resolved | threat defeated |
| PR opened | quest started |
| PR merged | quest completed |
| release published | realm upgraded |
| external contributor joined | ally arrived |
| stars gained | fame gained |
| fork gained | colony founded |

Every narrative event must retain a direct link to the real GitHub artifact.

Narrative text in v1 should use deterministic templates rather than an LLM interpreting arbitrary commit content.

## 10. Progression model

Raw contribution count must not directly equal power.

Progression should model several dimensions:

- Effort
- Impact
- Consistency
- Collaboration
- Shipping

Recommended conceptual weighting:

| Activity | Reward behavior |
|---|---|
| normal commit | low |
| repeated commits in a burst | diminishing returns |
| PR opened | medium |
| PR merged | high |
| external PR merged | very high |
| meaningful review | high |
| issue resolved | medium |
| release published | very high |
| new external contributor | very high |
| stars/forks gained | primarily Fame |
| suspicious self-generated noise | near zero |

Scoring must be versioned so formula changes do not silently rewrite historical outcomes.

## 11. Anti-farming requirements

GitHatch must resist obvious gamification abuse.

Initial safeguards:

- diminishing returns by activity family and time window
- burst detection
- duplicate/repetitive event discounting
- self-interaction discounting
- collaboration validation bonuses
- repository-quality heuristics
- daily/weekly caps where appropriate
- suspicious-account flags
- scoring audit logs

The system should optimize for useful outcomes and collaboration, not contribution-graph cosmetics.

## 12. Separate identity and competitive dimensions

Do not compress all progression into one number.

### Level

Permanent lifetime progression. Does not reset seasonally.

### Power

Current combat capability influenced by recent meaningful activity, class, and allowed equipment effects.

### Fame

Attention and social momentum such as stars, profile discovery, repository growth, and community visibility.

### Rating

Arena skill/competition rating derived from matches.

### Reputation

Collaboration and community contribution signal.

This separation allows a small but active developer to compete against a famous historical account.

## 13. Evolution

Evolution should represent how someone builds, not simply how often they commit.

Possible archetypes include:

- Maintainer
- Shipper
- Collaborator
- Researcher
- Security Sentinel
- Infrastructure Guardian
- Frontend Artisan
- Open-source Leader

Evolution criteria may combine level, activity fingerprint, repository history, collaboration, achievements, shipping behavior, and rare mutations.

Inactivity must not kill or permanently degrade the guardian. Allowed inactive states include Active, Resting, and Sleeping.

## 14. Profile requirements

A claimed profile should eventually include:

- guardian hero artwork
- species / element / archetype
- level and evolution stage
- current state
- guarded repositories
- featured repository
- recent achievements
- narrative activity feed
- equipment and cosmetics
- share action
- GitHub links
- project/demo/personal-site links
- owner analytics

Repository cards must remain prominent. The profile is successful when the pet increases curiosity about the developer's real work.

## 15. Distribution features

### 15.1 Share cards

Generate shareable cards for milestones including:

- hatch
- evolution
- mutation
- level milestone
- Arena victory
- rank change
- major release
- achievement

Each card must include an attributable GitHatch URL.

### 15.2 README embeds

Provide embeddable cards for GitHub profile and repository READMEs, initially as cached SVG/PNG and optionally animated formats later.

The card should expose guardian identity, level, primary repository, and recent achievement without leaking private data.

## 16. Discovery homepage

The homepage should evolve from a simple discovery surface into the Arena.

Do not rely only on a global all-time ranking. Candidate sections:

- Trending
- Rising
- Underdogs
- Maintainers
- Collaborators
- Shippers
- New Hatchlings
- Featured Repositories
- Arena

Discovery ranking should include freshness, meaningful activity quality, momentum, diversity, and under-discovery rather than raw popularity alone.

## 17. Arena

Arena should begin as an auto-battler rather than real-time action gameplay.

Developer activity prepares the guardian. The server resolves a short deterministic or seeded simulation and produces a replay.

Inputs can include:

- Power
- guardian archetype
- abilities
- loadout
- counters
- seasonal modifiers
- Arena rating

Matches should expose the repositories that powered the participants and offer post-match repository discovery links.

Arena exists to redistribute attention as much as to determine winners.

## 18. Monetization principles

Premium spending must not directly invalidate earned work.

Use at least two currency/economy layers:

### Earned currency

Used for standard equipment, crafting, upgrades, and normal cosmetics.

### Premium currency

Used primarily for skins, backgrounds, cosmetic weapons, auras, companions, profile frames, emotes, evolution skins, and limited collections.

Ranked play should normalize stat budgets where necessary. Paid equipment may change play style horizontally but should not create simple wallet-to-win scaling.

Sponsored discovery may exist as clearly labeled inventory such as Sponsored Guardian, Featured Repository, Promoted Raid, or Launch Spotlight. Sponsored placement must never alter organic competitive rank.

## 19. AI visual requirements

The visual system has two layers.

### Hero artwork

High-detail generated assets for hatch reveals, profiles, evolution reveals, collections, and share cards.

### Game sprites

Constrained assets derived from the canonical guardian and a stable character sheet. Equipment should use layered compositing where practical rather than regenerating every frame.

All generated assets must store:

- guardian DNA version
- prompt/schema version
- model/provider/version
- references or seed metadata
- moderation state
- asset status
- generation cost
- timestamps

Generation must be asynchronous and aggressively cached. Public page views must never trigger unbounded generation work.

## 20. Authentication and privacy

Use GitHub OAuth or a GitHub App with minimum permissions.

Public profiles can be previewed anonymously.

Authentication is required to claim a guardian, change profile configuration, equip items, participate in competitive systems, and manage purchases.

Private repository access is explicitly out of MVP and must always be opt-in if introduced later.

## 21. Analytics and North Star metric

### North Star

**Repository discovery events**: unique sessions in which a GitHatch surface leads to an outbound visit to a GitHub repository.

### Supporting metrics

- unclaimed profile view → claim rate
- claim → successful hatch rate
- hatch → share rate
- shared link → new profile visit rate
- shared link → new hatch rate
- GitHatch profile → GitHub outbound CTR
- weekly returning guardian owners
- evolution/milestone share rate
- README embed impressions and clicks
- discovery/Arena → repository outbound CTR
- AI generation cost per claimed guardian
- fraud/abuse rate

## 22. MVP validation gate

Do not aggressively invest in Arena, marketplace, guilds, or complex economy until the first product loop demonstrates that:

1. developers claim eggs
2. developers care enough to share guardians
3. shared guardians create new users
4. GitHatch drives meaningful outbound traffic to repositories
5. progression is understandable and not trivially farmed
6. AI generation cost is bounded

## 23. MVP acceptance criteria

The first validated release must support:

- any valid public `/:username` route
- deterministic unclaimed eggs
- GitHub ownership verification
- persistent guardian DNA
- asynchronous canonical pet generation
- meaningful activity ingestion and versioned scoring
- levels and basic traits
- repository guardianship
- a public claimed profile
- milestone sharing
- README embed
- attributable outbound repository clicks
- basic anti-farming protections
- operational visibility into GitHub sync, scoring, and AI-generation cost

## 24. Product principles

1. GitHub work is the source of progression.
2. Useful activity beats noisy activity.
3. The guardian tells the builder's story.
4. AI renders controlled identity; it does not own product truth.
5. Competition should create discovery, not toxicity.
6. Smaller builders must have paths to visibility.
7. Paid features enhance expression or buy clearly labeled promotion, not organic rank.
8. Public data is sufficient for MVP; private access is always optional.
9. Every major surface should point attention back to real repositories.
10. Validate the identity/share/discovery loop before building the MMO around it.
