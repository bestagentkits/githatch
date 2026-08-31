/**
 * GitHoot Semantic Review Verdict Contract (src/server/services/claim/verdict-contract.ts)
 *
 * Enforces cryptographic hash-binding and reviewer provenance for pose and reference approvals.
 */

export interface SemanticVerdict {
  verdict: 'pass' | 'fail';
  reviewer: string;
  boundToSha256: string;
  boundToIdentityHash?: string;
  covers?: string[];
  timestamp: number;
}

export function createSemanticVerdict(
  reviewer: string,
  boundToSha256: string,
  boundToIdentityHash?: string,
  verdict: 'pass' | 'fail' = 'pass'
): SemanticVerdict {
  return {
    verdict,
    reviewer: reviewer.trim(),
    boundToSha256,
    boundToIdentityHash,
    covers: ['species', 'anatomy', 'silhouette', 'palette', 'crest', 'style', 'subject count'],
    timestamp: Date.now()
  };
}

export function validateSemanticVerdict(
  raw: unknown,
  expectedSha256: string,
  expectedIdentityHash?: string
): { valid: boolean; reason?: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'Semantic verdict must be a non-null object' };
  }

  const v = raw as Record<string, unknown>;
  if (v.verdict !== 'pass') {
    return { valid: false, reason: `Verdict is "${String(v.verdict)}", expected "pass"` };
  }

  if (typeof v.reviewer !== 'string' || v.reviewer.trim().length === 0) {
    return { valid: false, reason: 'Reviewer must be a non-empty string' };
  }

  if (v.boundToSha256 !== expectedSha256) {
    return { valid: false, reason: `Verdict bound to SHA ${v.boundToSha256} but expected SHA is ${expectedSha256}` };
  }

  if (expectedIdentityHash && v.boundToIdentityHash && v.boundToIdentityHash !== expectedIdentityHash) {
    return { valid: false, reason: `Verdict identity hash mismatch: expected ${expectedIdentityHash}, got ${v.boundToIdentityHash}` };
  }

  return { valid: true };
}
