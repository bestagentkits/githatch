# Phase 3: React Client Gallery Page & Cards

## Context & Objectives
Build the Cyber-Arcade Fantasy gallery UI in React (`src/client/pages/GalleryPage.tsx` and `src/client/components/GuardianGalleryCard.tsx`). Deliver search, multi-faceted filtering, deterministic sorting, keyset load-more pagination, URL synchronization, and lazy on-demand sprite animation.

## Files to Modify / Create
- Create `src/client/components/GuardianGalleryCard.tsx` (Card component displaying pet stats, owner info, static hero, and on-demand 16-frame animation)
- Create `src/client/pages/GalleryPage.tsx` (Main gallery page with toolbar, responsive grid, mobile filter drawer, empty states, and pagination)
- Create `tests/unit/gallery-page.test.tsx` (Unit tests for card rendering, filter logic, URL sync, and accessibility)

## Implementation Steps
1. **`GuardianGalleryCard.tsx`**:
   - Presentation:
     - Hero container: fixed aspect ratio (1:1), lazy-loaded `hero_image_url` with `decoding="async"`.
     - Rarity badge: Option 1 glow color based on `rarity_tier` (`Common` gray, `Rare` blue, `Epic` purple, `Legendary` gold, `Mythic` crimson/rainbow).
     - Element chip: e.g. `🔥 Fire`, `⚡ Cyber`, `💧 Water`, `🌿 Nature`, `✨ Light`, `🌑 Void`, `⚙️ Metal`, `🌌 Cosmic`.
     - Guardian Name & Species: Archivo font for name, cyan `#00f0ff` accent for species.
     - Owner Row: GitHub avatar ($24\text{px}$ circle), `@login`, and total stars count.
     - Level & Mood: `LVL {level}` badge and energy state indicator.
   - On-Demand Animation:
     - On desktop mouse hover or keyboard focus: lazily mount spritesheet player using `spritesheet_url` (if available), playing one 1.1s `steps(15)` sequence settling on frame 16.
     - On unhover/blur: restore static hero image.
     - Respect `prefers-reduced-motion: reduce` $\rightarrow$ disable all sprite animations, glowing pulses, and lifts.
     - Touch/Mobile devices: tapping card navigates directly to `/:login` without trapping taps in hover state.
2. **`GalleryPage.tsx`**:
   - Page Structure:
     - Header: "Gallery of Guardians", subtitle "Discover living realm companions hatched by GitHub developers." with a link to "Explore egg archetypes $\rightarrow$".
     - Query Toolbar:
       - Search input with 300ms debounce and clear button.
       - Element filter dropdown (`All Elements`, `Fire`, `Cyber`, etc.).
       - Rarity filter dropdown (`All Rarities`, `Common`, `Rare`, etc.).
       - Sort selector (`Newest First`, `Oldest First`).
       - Active filter chips with "✕" remove buttons.
       - "Clear all" button when filters are active.
     - Mobile Filter Button & Drawer:
       - Displays "Filters (N)" trigger button on mobile viewports ($\ge 44\text{px}$ touch target).
       - Opens modal drawer with focus trap, `Escape` key handler, and explicit "Apply" & "Clear" buttons.
     - Results Status: `<p role="status" aria-live="polite">` announcing result count.
     - Card Grid: CSS grid with responsive columns:
       - 1 column on phone ($<640\text{px}$)
       - 2 columns on tablet ($640\text{px} - 1024\text{px}$)
       - 3 columns on standard desktop ($1024\text{px} - 1440\text{px}$)
       - 4 columns on wide screens ($>1440\text{px}$)
     - Pagination Button: "Load More Guardians" using `page.next_cursor`.
     - Empty States:
       - No matches: "No Guardians match your filters." with "Clear Filters" button.
       - Empty realm: "No Guardians have hatched yet." with "Hatch the First Guardian" button linking to Home.
     - Error State: "Failed to load gallery." with "Retry" button.
   - URL Sync:
     - Reflects `q`, `element`, `rarity`, `sort` into `window.location.search`.
     - Changing any filter resets the cursor and fetches page 1.
     - Browser Back/Forward (`popstate`) restores exact filter state.

## Validation
- `npm run typecheck` passes.
- `npx vitest run tests/unit/gallery-page.test.tsx` passes.
