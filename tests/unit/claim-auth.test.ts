// ============================================================================
// Claim Route Authentication & Session Unit Tests (tests/unit/claim-auth.test.ts)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { deriveClaimPrincipal } from '../../src/server/services/claim/auth-guard';

describe('Claim Route Authentication & Principal Derivation', () => {
  it('derives principal strictly from verified server session', () => {
    const session = {
      user: {
        github_user_id: 11829471,
        login: 'mrgoonie'
      }
    };
    const principal = deriveClaimPrincipal(session, { spoofed_id: 999999 });
    expect(principal.github_user_id).toBe(11829471);
    expect(principal.login).toBe('mrgoonie');
  });

  it('rejects unauthenticated requests without session', () => {
    expect(() => {
      deriveClaimPrincipal(null, { github_user_id: 11829471 });
    }).toThrow(/unauthorized/i);
  });

  it('rejects corrupted sessions missing github_user_id', () => {
    expect(() => {
      deriveClaimPrincipal({ user: {} }, {});
    }).toThrow(/invalid session/i);
  });
});
