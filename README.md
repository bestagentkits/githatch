# GitHatch

> Turn your GitHub activity into a living fantasy companion — and your profile into a game people want to visit.

**GitHatch** is a gamified identity layer for GitHub. Any public GitHub profile can be viewed as an interactive pet profile by replacing the domain:

```text
https://github.com/mrgoonie
              ↓
https://githatch.com/mrgoonie
```

> **Working name:** GitHatch. **GitPet** is an alternative depending on domain and trademark availability.

## The idea

GitHub profiles are valuable records of what developers build, but they are optimized for inspection rather than discovery, personality, or play.

GitHatch converts public GitHub activity into a fantasy pet that hatches, grows, evolves, and cares for its owner's repositories. The result is a more expressive developer profile that can attract community attention and send traffic back to the user's work and products.

## First-time experience

A visitor who opens a GitHatch profile for the first time sees an egg.

1. **Click to hatch** the egg.
2. Receive a randomly generated fantasy pet.
3. Sign in with GitHub to claim the pet and continue raising it.
4. Keep building on GitHub to earn experience and unlock visual evolution.

The initial hatch should feel rare and personal. Pet visuals can be generated with image models such as **GPT Image 2** or **Nano Banana 2**, then converted into consistent sprite sheets for idle, movement, work, celebration, battle, and evolution animations.

## GitHub activity becomes progression

A pet's progression is powered by meaningful GitHub activity. Potential signals include:

- Contributions and contribution consistency
- Commits and merged pull requests
- Issues opened, resolved, or meaningfully discussed
- Releases and repository milestones
- Stars, forks, watchers, and community growth
- Code review and collaboration activity
- Maintaining healthy, active repositories over time

These signals should not map directly to raw power without safeguards. GitHatch must reward sustained, useful work while resisting spam, empty commits, low-effort repositories, and other forms of activity farming.

## Pets as repository guardians

Each pet acts as the guardian of its owner's repositories.

A GitHatch profile may show:

- The pet's species, level, experience, rarity, and evolution stage
- Repositories currently under its care
- Recent achievements and activity streaks
- Repository health or momentum represented as habitats, quests, resources, or status effects
- Featured projects and links back to GitHub, demos, products, and personal sites
- Cosmetic equipment and earned collectibles

The more consistently the owner builds and maintains useful projects, the more experienced and visually impressive the pet becomes.

## Evolution system

Pets can evolve visually over time based on both activity and behavioral archetypes.

Examples:

- A prolific maintainer may develop guardian or leadership traits.
- A strong collaborator may evolve into a support-oriented class.
- A release-focused builder may unlock forge-themed forms.
- A security contributor may gain sentinel traits.
- A long-running open-source project may unlock legacy evolutions.

Evolution should communicate the story of how someone builds, not merely display a contribution count.

## The Arena

The GitHatch homepage is an arena and discovery surface where pets — and therefore GitHub users — earn attention from the community.

Potential experiences include:

- Global, regional, language, and technology leaderboards
- Seasonal leagues and themed events
- Friendly pet challenges
- Repository-versus-repository matchups
- Team or organization battles
- Community quests tied to real open-source contributions
- Featured builders, rising projects, and under-discovered maintainers

The battle gameplay is intentionally open for exploration. The core design constraint is that competition must create positive visibility for builders and their repositories rather than becoming a detached pay-to-win game.

A strong battle system should use a mixture of:

- Earned stats from verified GitHub activity
- Strategic loadouts and pet classes
- Time-bounded seasonal modifiers
- Fair matchmaking
- Cosmetic expression
- Community participation

## Discovery and traffic loop

GitHatch is designed to create a loop:

1. A GitHub user receives a pet profile.
2. GitHub activity makes the pet grow and evolve.
3. A more interesting pet earns visibility in the arena.
4. Visitors discover the owner, repositories, products, and demos.
5. New attention encourages more building and community participation.

GitHatch succeeds when the game increases meaningful discovery of developers and their work.

## Monetization

GitHatch can monetize through optional virtual goods and visibility products:

- Cosmetic items and accessories
- Armor, gear, equipment, and weapons
- Pet skins, habitats, animations, emotes, and profile themes
- Seasonal passes and collectible sets
- Tournament entry or special challenge formats
- Sponsored arena placements and featured profile slots
- Visibility boosts for launches, repositories, or products
- Utility items that alter strategy without invalidating earned progression

Monetization should preserve trust. Purchases may improve expression, provide bounded strategic choices, or buy clearly labeled promotion, but should not erase the value of genuine GitHub activity. Competitive systems should avoid hard pay-to-win mechanics.

## AI visual pipeline

A possible asset pipeline:

1. Generate a canonical pet concept from a controlled species/class/evolution schema.
2. Lock identity traits, palette, silhouette, and equipment slots.
3. Generate consistent poses and evolution forms with GPT Image 2 or Nano Banana 2.
4. Convert approved poses into sprite sheets.
5. Validate silhouette, frame alignment, transparency, and animation continuity.
6. Store provenance, prompt metadata, model version, and moderation status for every asset.

AI should expand visual variety while the product maintains deterministic identity and animation consistency.

## Identity and authentication

Public GitHub profiles may be previewed without registration. Authentication is required to:

- Claim and name a pet
- Save progression
- Equip items
- Choose featured repositories
- Enter challenges or ranked modes
- Purchase or manage virtual goods
- Configure profile and privacy settings

GitHub OAuth should request the minimum permissions necessary. Public contribution data can power discovery, while any private-repository integration must be explicit, optional, and narrowly scoped.

## Product principles

- **GitHub work is the source of progression.**
- **The pet tells the builder's story.**
- **Competition should create discovery, not toxicity.**
- **Useful activity beats noisy activity.**
- **Paid items should enhance expression, not replace effort.**
- **Public data is usable by default; private access is always opt-in.**
- **AI-generated assets require consistency, provenance, and moderation.**

## Suggested MVP

### Phase 1 — Hatch and profile

- Resolve public GitHub usernames
- Generate the initial egg and hatch interaction
- GitHub OAuth and pet claiming
- Basic activity ingestion and experience calculation
- One pet species system with several visual variations
- Public profile with featured repositories

### Phase 2 — Growth and retention

- Levels, streaks, achievements, and evolution
- Sprite-sheet animations
- Repository guardian views
- Cosmetics and inventory
- Activity-abuse detection

### Phase 3 — Arena and discovery

- Leaderboards and seasonal rankings
- Featured builders and repositories
- Friendly challenges
- Shareable pet cards and embeds
- Referral and traffic analytics for profile owners

### Phase 4 — Economy

- Cosmetic marketplace
- Seasonal content
- Sponsored, clearly labeled visibility boosts
- Balanced equipment and competitive formats

## Open questions

- Which GitHub activities best represent meaningful contribution?
- How should GitHatch detect and penalize contribution farming?
- Should pets represent a user, a repository, or both?
- What battle mechanics can remain fair, legible, and fun?
- How can new developers compete with long-established accounts?
- Which progression is permanent, and which resets seasonally?
- How should organizations and teams participate?
- What visual-generation pipeline can guarantee sprite consistency at scale?
- Which name and domain — GitHatch or GitPet — has the strongest legal and brand availability?

## Status

Early concept and product exploration. The name, mechanics, economy, visual direction, and technical architecture are subject to validation.
