// ============================================================================
// Phase 2: GitHub Resolver Authentic Telemetry & Provenance Unit Tests
// (tests/unit/resolver-telemetry.test.ts)
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { fetchTelemetrySnapshot, createAllUnavailableSnapshot } from '../../src/server/services/github/resolver';
import type { GitHubUserRaw, Env } from '../../src/server/types';

describe('Phase 2: GitHub Telemetry Enrichment & Provenance Contracts', () => {
  const mockRawUser: GitHubUserRaw = {
    id: 11829471,
    login: 'octocat',
    avatar_url: 'https://github.com/octocat.png',
    name: 'The Octocat',
    bio: 'GitHub mascot',
    public_repos: 5,
    followers: 100,
    created_at: new Date(Date.now() - 365.25 * 2 * 86400000).toISOString() // 2 years old
  };

  const mockEnv: Partial<Env> = {
    GITHUB_TOKENS: '["ghp_test_token_12345"]'
  };

  it('measures repos, languages, stars, and forks with complete measured provenance', async () => {
    const exactUser: GitHubUserRaw = {
      ...mockRawUser,
      public_repos: 3
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        return new Response(JSON.stringify([
          { language: 'TypeScript', stargazers_count: 50, forks_count: 10 },
          { language: 'TypeScript', stargazers_count: 30, forks_count: 5 },
          { language: 'Rust', stargazers_count: 40, forks_count: 8 }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/events/public?')) {
        return new Response(JSON.stringify([
          { type: 'PushEvent', created_at: '2026-08-15T23:30:00Z' }, // Night commit (23h UTC)
          { type: 'PushEvent', created_at: '2026-08-22T14:00:00Z' }  // Day commit (14h UTC)
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/search/issues?q=author')) {
        return new Response(JSON.stringify({ total_count: 12 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/search/issues?q=reviewed-by')) {
        return new Response(JSON.stringify({ total_count: 8 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const snapshot = await fetchTelemetrySnapshot(exactUser, mockEnv as Env);

    expect(snapshot.stars).toBe(120);
    expect(snapshot.forks).toBe(23);
    expect(snapshot.topLanguages).toEqual(['typescript', 'rust']);
    expect(snapshot.mergedExternalPRs).toBe(12);
    expect(snapshot.reviewRatio).toBe(1); // 8 reviews / 3 repos => capped at 1
    expect(snapshot.activeWeeks).toBe(2);
    expect(snapshot.nightCommitRatio).toBe(0.5); // 1 night push out of 2 total pushes
    expect(snapshot.accountAgeYears).toBe(2);

    expect(snapshot.provenance.topLanguages).toBe('measured');
    expect(snapshot.provenance.stars).toBe('measured');
    expect(snapshot.provenance.forks).toBe('measured');
    expect(snapshot.provenance.mergedExternalPRs).toBe('measured');
    expect(snapshot.provenance.reviewRatio).toBe('measured');
    expect(snapshot.provenance.activeWeeks).toBe('measured');
    expect(snapshot.provenance.nightCommitRatio).toBe('measured');
  });

  it('paginates repositories across multiple pages when public_repos > 100', async () => {
    const highRepoUser: GitHubUserRaw = {
      ...mockRawUser,
      public_repos: 150
    };

    let page1Called = false;
    let page2Called = false;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        const page = new URL(url).searchParams.get('page');
        if (page === '1') {
          page1Called = true;
          const p1 = Array.from({ length: 100 }, () => ({
            language: 'TypeScript',
            stargazers_count: 1,
            forks_count: 1
          }));
          return new Response(JSON.stringify(p1), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (page === '2') {
          page2Called = true;
          const p2 = Array.from({ length: 50 }, () => ({
            language: 'Rust',
            stargazers_count: 2,
            forks_count: 1
          }));
          return new Response(JSON.stringify(p2), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      if (url.includes('/events/public?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ total_count: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const snapshot = await fetchTelemetrySnapshot(highRepoUser, mockEnv as Env);

    expect(page1Called).toBe(true);
    expect(page2Called).toBe(true);
    expect(snapshot.stars).toBe(200); // 100 * 1 + 50 * 2 = 200
    expect(snapshot.forks).toBe(150); // 100 * 1 + 50 * 1 = 150
    expect(snapshot.provenance.stars).toBe('measured');
    expect(snapshot.provenance.forks).toBe('measured');
  });

  it('fails closed to unavailable when pagination is interrupted (never emits partial measured total)', async () => {
    const highRepoUser: GitHubUserRaw = {
      ...mockRawUser,
      public_repos: 250
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        const page = new URL(url).searchParams.get('page');
        if (page === '1') {
          const p1 = Array.from({ length: 100 }, () => ({ language: 'TypeScript', stargazers_count: 10, forks_count: 1 }));
          return new Response(JSON.stringify(p1), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (page === '2') {
          // Page 2 rate-limited!
          return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const snapshot = await fetchTelemetrySnapshot(highRepoUser, mockEnv as Env);

    // Assert that incomplete partial totals are NOT tagged measured
    expect(snapshot.provenance.stars).toBe('unavailable');
    expect(snapshot.provenance.forks).toBe('unavailable');
    expect(snapshot.provenance.topLanguages).toBe('unavailable');
  });

  it('fails closed to unavailable when public_repos > 1000 (never marks truncated first 1000 repos as measured)', async () => {
    const hugeRepoUser: GitHubUserRaw = {
      ...mockRawUser,
      public_repos: 1050
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        const p = Array.from({ length: 100 }, () => ({ language: 'TypeScript', stargazers_count: 10, forks_count: 1 }));
        return new Response(JSON.stringify(p), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const snapshot = await fetchTelemetrySnapshot(hugeRepoUser, mockEnv as Env);

    expect(snapshot.provenance.stars).toBe('unavailable');
    expect(snapshot.provenance.forks).toBe('unavailable');
    expect(snapshot.provenance.topLanguages).toBe('unavailable');
  });

  it('fails closed to unavailable when public events are truncated across 3 full pages (300 events)', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/events/public?')) {
        const fullPage = Array.from({ length: 100 }, () => ({
          type: 'PushEvent',
          created_at: '2026-08-15T23:30:00Z'
        }));
        return new Response(JSON.stringify(fullPage), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ total_count: 0 }), { status: 200 });
    });

    const snapshot = await fetchTelemetrySnapshot(mockRawUser, mockEnv as Env);

    expect(snapshot.provenance.activeWeeks).toBe('unavailable');
    expect(snapshot.provenance.nightCommitRatio).toBe('unavailable');
  });

  it('handles successful empty events and repos as measured zero (not unavailable)', async () => {
    const emptyUser: GitHubUserRaw = {
      ...mockRawUser,
      public_repos: 0
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/repos?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/events/public?')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/search/issues?')) {
        return new Response(JSON.stringify({ total_count: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const snapshot = await fetchTelemetrySnapshot(emptyUser, mockEnv as Env);

    expect(snapshot.stars).toBe(0);
    expect(snapshot.forks).toBe(0);
    expect(snapshot.activeWeeks).toBe(0);
    expect(snapshot.nightCommitRatio).toBe(0);
    expect(snapshot.mergedExternalPRs).toBe(0);
    expect(snapshot.reviewRatio).toBe(0);

    expect(snapshot.provenance.stars).toBe('measured');
    expect(snapshot.provenance.forks).toBe('measured');
    expect(snapshot.provenance.activeWeeks).toBe('measured');
    expect(snapshot.provenance.nightCommitRatio).toBe('measured');
    expect(snapshot.provenance.mergedExternalPRs).toBe('measured');
    expect(snapshot.provenance.reviewRatio).toBe('measured');
  });

  it('handles accounts under one year old as measured accountAgeYears = 0', async () => {
    const brandNewUser: GitHubUserRaw = {
      ...mockRawUser,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString() // 30 days old
    };

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const snapshot = await fetchTelemetrySnapshot(brandNewUser, mockEnv as Env);
    expect(snapshot.accountAgeYears).toBe(0); // Under 1 year => exactly 0, not forced to 1
    expect(snapshot.provenance.accountAgeYears).toBe('measured');
  });

  it('creates authentic all-unavailable snapshot on rate limit', () => {
    const snapshot = createAllUnavailableSnapshot(mockRawUser);

    expect(snapshot.provenance.stars).toBe('unavailable');
    expect(snapshot.provenance.forks).toBe('unavailable');
    expect(snapshot.provenance.topLanguages).toBe('unavailable');
    expect(snapshot.provenance.mergedExternalPRs).toBe('unavailable');
    expect(snapshot.provenance.reviewRatio).toBe('unavailable');
    expect(snapshot.provenance.activeWeeks).toBe('unavailable');
    expect(snapshot.provenance.nightCommitRatio).toBe('unavailable');
    // Base authentic fields from rawUser are preserved
    expect(snapshot.provenance.publicRepos).toBe('measured');
    expect(snapshot.provenance.followers).toBe('measured');
    expect(snapshot.provenance.accountAgeYears).toBe('measured');
  });
});
