# Phase 4: Navigation, Routing Integration & Full Verification

## Context & Objectives
Integrate the Gallery route into the client and server routing pipeline, update desktop and mobile navigation in `Navbar.tsx`, ensure server-side OpenGraph fallback does not mistake `/gallery` for a user profile, and run comprehensive end-to-end verification (typecheck, unit tests, Cloudflare worker integration tests, and build verification).

## Files to Modify / Create
- Update `src/client/main.tsx` (register `/gallery` in `parsePath` and render `GalleryPage`)
- Update `src/client/components/Navbar.tsx` (add desktop & mobile "Gallery" links with active states)
- Update `src/server/index.ts` (exclude `gallery` from `isProfile` OpenGraph router check)
- Create `tests/unit/gallery-routing-and-nav.test.ts` (test client route parsing, navbar active state, and server fallback)
- Create `tests/integration/gallery-edge.integration.test.ts` (test end-to-end API execution against real D1 migrations and KV namespace)

## Implementation Steps
1. **Client Router (`src/client/main.tsx`)**:
   - In `parsePath(pathStr)`:
     ```ts
     if (path === '/gallery') {
       return { route: '/gallery', profileUsername: null };
     }
     ```
   - In `renderActivePage`:
     ```tsx
     if (routeState.route === '/gallery') {
       return (
         <GalleryPage
           onRouteChange={handleRouteChange}
         />
       );
     }
     ```
2. **Navigation Bar (`src/client/components/Navbar.tsx`)**:
   - Desktop nav list:
     - Add `<li><button onClick={() => handleNav('/gallery')} className={`nav-link ${activeRoute === '/gallery' ? 'active' : ''}`}>Gallery</button></li>`
     - Change "Explore" label to "Explore Archetypes" or keep "Explore" $\rightarrow$ `/explore`.
   - Mobile drawer nav list:
     - Add `<li><button onClick={() => handleNav('/gallery')} className={`mobile-nav-link ${activeRoute === '/gallery' ? 'active' : ''}`}>Gallery of Guardians</button></li>`
3. **Server Route Exclusions (`src/server/index.ts`)**:
   - Update `isProfile` definition in `app.all('*', ...)`:
     ```ts
     const isProfile = cleanUser && !url.pathname.includes('.') &&
       cleanUser !== 'explore' &&
       cleanUser !== 'gallery' &&
       cleanUser !== 'design' &&
       cleanUser !== 'docs' &&
       cleanUser !== 'api' &&
       cleanUser !== 'auth' &&
       cleanUser !== 'badge' &&
       cleanUser !== 'og';
     ```
4. **End-to-End Test Suite**:
   - Unit tests (`tests/unit/gallery-routing-and-nav.test.ts`):
     - Test `parsePath('/gallery')` and `parsePath('/gallery/')`.
     - Test Navbar renders Gallery link and handles navigation.
     - Test server `isProfile` ignores `/gallery`.
   - Worker Integration tests (`tests/integration/gallery-edge.integration.test.ts`):
     - Apply all 9 migrations to in-memory D1 database.
     - Seed test data (hatched published guardians, unpublished guardians, quarantined guardians).
     - Exercise `GET /api/gallery` with no params, element filter, rarity filter, prefix search, and pagination.
     - Verify KV SWR headers (`HIT`, `MISS`, `BYPASS`, `STALE`).
     - Verify zero leakage of unpublished pets.

## Validation & Definition of Done
1. `npm run typecheck` $\rightarrow$ 0 errors.
2. `npm run build` $\rightarrow$ React client, Pages worker, and Queue worker bundle cleanly.
3. `npm test` $\rightarrow$ All unit tests, Cloudflare worker integration tests, and determinism tests pass 100%.
4. Final sign-off by subagent `kongming`.
