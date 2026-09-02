// ============================================================================
// GitHoot Claim Authentication & Session Guard (src/server/services/claim/auth-guard.ts)
// ============================================================================

export interface AuthenticatedPrincipal {
  github_user_id: number;
  login: string;
}

export function deriveClaimPrincipal(
  session: unknown,
  _untrustedBody?: unknown
): AuthenticatedPrincipal {
  if (!session || typeof session !== 'object') {
    throw new Error('Unauthorized: Valid GitHub OAuth session required to claim a Guardian.');
  }

  const s = session as Record<string, unknown>;
  const user = s.user as Record<string, unknown> | undefined;

  if (!user || !user.github_user_id) {
    throw new Error('Invalid session: missing verified github_user_id in session principal.');
  }

  const githubUserId = Number(user.github_user_id);
  if (!Number.isFinite(githubUserId) || githubUserId <= 0) {
    throw new Error('Invalid session: numeric github_user_id must be positive.');
  }

  const login = typeof user.login === 'string' ? user.login : `user-${githubUserId}`;

  return {
    github_user_id: githubUserId,
    login
  };
}
