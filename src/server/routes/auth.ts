// ============================================================================
// GitHoot Authentication & Admin Review Router (src/server/routes/auth.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import {
  generateOAuthLoginUrl,
  exchangeCodeForAccessToken,
  fetchAuthenticatedUser,
  verifySignedState
} from '../services/auth/oauth';
import { executeClaimTransaction } from '../services/claim/transaction';
import { twoPhaseApproveReference } from '../services/ai/reference-manager';
import { approveGuardianPosesAndPublish } from '../services/ai/hatch-admin';
import { verifyReviewerAuthorization } from '../services/auth/admin-auth';
import { reviewRouter } from './review';

export const authRouter = new Hono<{ Bindings: Env }>();

// Mount Admin Review Router (/auth/admin/review/:jobId)
authRouter.route('/admin/review', reviewRouter);

// 1. Initiate GitHub OAuth Login & Hatch flow
authRouter.get('/github', async (c) => {
  const targetUsername = c.req.query('claim_username') || '';
  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    return c.text('AUTH_SECRET is not configured on server.', 500);
  }
  
  const authUrl = await generateOAuthLoginUrl(targetUsername, c.env, secret);
  return c.redirect(authUrl);
});

// 2. OAuth Callback
authRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.text('Missing required OAuth code or state parameter.', 400);
  }

  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    return c.text('AUTH_SECRET is not configured on server.', 500);
  }
  const statePayload = await verifySignedState(state, secret);

  if (!statePayload) {
    return c.text('Invalid or expired OAuth state token (CSRF check failed).', 403);
  }
  try {
    // 1. Exchange code for access token
    const accessToken = await exchangeCodeForAccessToken(code, c.env);

    // 2. Fetch authenticated user data from GitHub
    const authUser = await fetchAuthenticatedUser(accessToken);

    // 3. Security check: User must match the claim target if target was specified
    if (statePayload.claim_username && statePayload.claim_username !== authUser.login.toLowerCase()) {
      return c.html(`
        <div style="background:#07090e; color:#ff2a85; font-family:sans-serif; padding:48px; text-align:center;">
          <h2>⚠️ Identity Mismatch</h2>
          <p>You authenticated as <strong>@${authUser.login}</strong>, but attempted to claim <strong>@${statePayload.claim_username}</strong>.</p>
          <a href="/${encodeURIComponent(authUser.login)}" style="color:#00f0ff; margin-top:16px; display:inline-block;">Go to your own egg: githoot.com/${authUser.login} →</a>
        </div>
      `, 403);
    }

    // 4. Execute atomic claim transaction
    const claimRes = await executeClaimTransaction(authUser, c.env);

    // 5. Redirect to Hatch Reveal ritual
    return c.redirect(`/${encodeURIComponent(authUser.login)}?hatch=true&guardian_id=${claimRes.guardian.id}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Claim transaction failed';
    if (msg.includes('EARLY_ACCESS_FULL')) {
      return c.redirect(`/${encodeURIComponent(statePayload.claim_username || 'user')}?checkout=true`);
    }
    return c.text(`Authentication error: ${msg}`, 500);
  }
});

// 3. Admin & Reviewer Endpoint: Approve Reference Candidate (Protected by Cloudflare Access / Admin Token)
authRouter.post('/admin/approve-reference', async (c) => {
  try {
    const principal = await verifyReviewerAuthorization(c.req.raw.headers, c.env);

    const body = await c.req.json() as {
      guardianId: string;
      candidateId: string;
      candidateSha256: string;
      verdict: 'pass';
    };

    if (!body.guardianId || !body.candidateId || !body.candidateSha256 || body.verdict !== 'pass') {
      return c.json({ error: 'Missing required approval fields or verdict is not strictly "pass"' }, 400);
    }

    const result = await twoPhaseApproveReference({
      guardianId: body.guardianId,
      candidateId: body.candidateId,
      candidateSha256: body.candidateSha256,
      reviewer: principal.email,
      verdict: 'pass',
      env: c.env
    });
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reference approval failed';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return c.json({ error: message }, status);
  }
});
