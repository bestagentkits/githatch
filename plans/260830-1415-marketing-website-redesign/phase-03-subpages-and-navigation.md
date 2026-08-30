# Phase 3: Global Navigation, Footer & Subpages

## Context
Ensure all routes and shared navigation elements adhere to the accepted English marketing narrative and Cyber-Arcade Fantasy design system.

## Deliverables
1. **Global Navbar (`src/client/components/Navbar.tsx`)**:
   - Brand `🦉 GitHoot`, desktop nav links (Home, Explore, Design Studio, Docs & Architecture).
   - Quota Pill with live `remaining/total` slots or `degraded` fallback text.
   - Search box with accessible label and `Preview` submit CTA (replacing misleading `Hatch →`).
   - 44×44px mobile menu button (`aria-expanded`, `aria-controls`) and collapsible mobile drawer.
   - Persistent mobile quota line under the brand on ≤640px.
2. **Global Footer (`src/client/components/Footer.tsx`)**:
   - 4-column layout: GitHoot routes, For Developers, From the Creator, Status & Privacy.
   - Verified links including GitHub source (`https://github.com/bestagentkits/githatch`).
   - Verbatim credit: `Made with ❤️ by AgentKit.best`.
   - Mount in `src/client/main.tsx` or `HomePage.tsx`.
3. **Subpages Translation & Alignment**:
   - `src/client/pages/DocsPage.tsx`: English technical architecture, Edge SWR, API reference, anchor `id`s for clean linking.
   - `src/client/pages/ExplorePage.tsx`: English archetype explorer and sample developer links.
   - `src/client/pages/DesignSystemPage.tsx`: English Option 1 Cyber-Arcade tokens, colors, typography, and motion showcase.

## Files to Modify / Create
- `src/client/components/Navbar.tsx`
- `src/client/components/Footer.tsx` (new)
- `src/client/main.tsx`
- `src/client/pages/DocsPage.tsx`
- `src/client/pages/ExplorePage.tsx`
- `src/client/pages/DesignSystemPage.tsx`

## Validation
- All routes (`/`, `/explore`, `/design`, `/docs`, `/:username`) render in English with 0 type errors.
- Navigation links between pages work seamlessly.
