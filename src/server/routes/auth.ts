// ============================================================================
// GitHoot Authentication & Admin Review Router (src/server/routes/auth.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateSignedState, verifySignedState, exchangeCodeForAccessToken, fetchAuthenticatedUser, createSessionToken, verifySessionToken, fetchAggregateStats, revokeAccessToken } from '../services/auth/oauth';
import type { UserSession } from '../types';
import { executeClaimTransaction } from '../services/claim/transaction';
import { twoPhaseApproveReference } from '../services/ai/reference-manager';
import { approveGuardianPosesAndPublish } from '../services/ai/hatch-admin';
import { verifyReviewerAuthorization } from '../services/auth/admin-auth';
import { reviewRouter } from './review';
import { deleteProfileCacheKeys } from '../services/github/cache-keys';

export const authRouter = new Hono<{ Bindings: Env }>();
function escapeHtml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&#39;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}


// Mount Admin Review Router (/auth/admin/review/:jobId)
authRouter.route('/admin/review', reviewRouter);

// 1. Initiate GitHub OAuth Login & Hatch flow
authRouter.get('/github', async (c) => {
  const rawClaimUser = c.req.query('claim_username');
  let claimUsername = '';
  let intent: 'login' | 'claim' = 'login';

  if (typeof rawClaimUser === 'string' && rawClaimUser.trim().length > 0) {
    const clean = rawClaimUser.trim().replace(/^@/, '');
    const isValid = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(clean);
    if (!isValid) {
      return c.text('Invalid claim username format. Must be a valid GitHub username.', 400);
    }
    claimUsername = clean.toLowerCase();
    intent = 'claim';
  }

  const rawClientId = c.env.GITHUB_CLIENT_ID || '';
  const clientId = rawClientId.replace(/^["']|["']$/g, '').trim();

  if (!clientId) {
    return c.text('GITHUB_CLIENT_ID not configured.', 500);
  }
  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    return c.text('AUTH_SECRET not configured on server.', 500);
  }

  // Universal product-consent boundary in front of EVERY OAuth entry point
  // (navbar login, mobile menu, claim CTA, direct URL). Shown before requesting
  // GitHub's broad classic `repo` scope so no caller can bypass disclosure.
  if (c.req.query('consent') !== '1') {
    const continueHref = claimUsername
      ? `/auth/github?consent=1&claim_username=${encodeURIComponent(claimUsername)}`
      : `/auth/github?consent=1`;
    return c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize GitHoot · GitHub Access</title></head>
<body style="margin:0;background:#07090e;color:#f0f6fc;font-family:'Segoe UI',-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:560px;background:#0d111a;border:1px solid rgba(0,240,255,0.25);border-radius:16px;padding:32px;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
    <h1 style="font-size:22px;margin:0 0 8px;color:#00f0ff;">🦉 Authorize GitHoot</h1>
    <p style="font-size:14px;line-height:1.6;color:#c8d6e5;">To include your <strong>private-repo activity</strong> in your public GitHoot profile, sign-in requests GitHub's classic <strong style="color:#ffa800;">repo</strong> permission.</p>
    <ul style="font-size:13px;line-height:1.7;color:#8b9bb4;padding-left:18px;">
      <li>Classic <strong style="color:#ffa800;">repo</strong> grants <strong>full read/write access to your public &amp; private repositories</strong> (and some org resources). It is not read-only.</li>
      <li>GitHoot uses the token <strong>once</strong> to compute two <strong>public</strong> counts: contributions in the last year and total owned repositories (including private).</li>
      <li>GitHoot stores <strong>no token</strong> and <strong>no private repo names, URLs, or details</strong> — only those two numbers.</li>
      <li>GitHoot <strong>attempts to revoke the token immediately</strong> after use. You can also revoke access anytime in your <a href="https://github.com/settings/applications" target="_blank" rel="noopener noreferrer" style="color:#00f0ff;">GitHub settings</a>.</li>
      <li>Exact public totals can reveal the <strong>volume</strong> of your private work (private repo count is inferable).</li>
    </ul>
    <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;">
      <a href="${continueHref}" style="flex:1;text-align:center;background:linear-gradient(135deg,#00f0ff,#0099ff);color:#000;font-weight:800;padding:14px 20px;border-radius:10px;text-decoration:none;min-width:180px;">Continue with GitHub →</a>
      <a href="/" style="flex:1;text-align:center;background:transparent;border:1px solid rgba(255,255,255,0.2);color:#8b9bb4;font-weight:700;padding:14px 20px;border-radius:10px;text-decoration:none;min-width:120px;">Cancel</a>
    </div>
  </div>
</body></html>`);
  }

  const state = await generateSignedState(claimUsername, secret, intent);

  const redirectUri = `${c.req.url.split('/auth')[0]}/auth/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('repo read:user')}&state=${encodeURIComponent(state)}`;

  return c.redirect(githubAuthUrl);
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
    return c.text('AUTH_SECRET not configured on server.', 500);
  }
  const statePayload = await verifySignedState(state, secret);

  if (!statePayload) {
    return c.text('Invalid or expired OAuth state token (CSRF check failed).', 403);
  }

  let accessToken: string | null = null;
  try {
    // 1. Exchange code for access token (held only in callback-local memory)
    accessToken = await exchangeCodeForAccessToken(code, c.env);

    // 2. Fetch authenticated user data from GitHub
    const authUser = await fetchAuthenticatedUser(accessToken);

    // 3. Derive + persist owner-consented private-INCLUSIVE aggregate COUNTS only
    //    (contributions last year + owned repos incl. private). Sanitized numbers,
    //    never names/URLs/token. Non-blocking; preserve prior snapshot on failure.
    try {
      const stats = await fetchAggregateStats(accessToken, authUser.id);
      if (stats) {
        await c.env.DB.prepare(
          `INSERT INTO github_aggregate_stats
            (github_user_id, contributions_last_year, owned_repositories_total, period_started_at, period_ended_at, refreshed_at, consent_version)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
           ON CONFLICT(github_user_id) DO UPDATE SET
            contributions_last_year = ?2,
            owned_repositories_total = ?3,
            period_started_at = ?4,
            period_ended_at = ?5,
            refreshed_at = ?6,
            consent_version = 1`
        ).bind(
          authUser.id,
          stats.contributions_last_year,
          stats.owned_repositories_total,
          Date.parse(stats.period_started_at),
          Date.parse(stats.period_ended_at),
          Date.parse(stats.refreshed_at)
        ).run();
        try {
          await deleteProfileCacheKeys(c.env.CACHE_KV, authUser.login);
        } catch {}
      }
    } catch {
      // Non-blocking: never overwrite a good snapshot with zeros; login proceeds.
    }

    // 4. Set persistent secure HttpOnly session cookie (token-free)
    const userSession: UserSession = {
      id: authUser.id,
      login: authUser.login,
      name: authUser.name,
      avatar_url: authUser.avatar_url
    };
    const sessionToken = await createSessionToken(userSession, secret);
    const isSecure = c.env.ENVIRONMENT === 'production' || c.req.url.startsWith('https://');
    const secureAttr = isSecure ? '; Secure' : '';
    c.header('Set-Cookie', `githoot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly${secureAttr}; SameSite=Lax; Max-Age=2592000`);

    // 5. Handle pure login intent (0 AI cost, no premature claim)
    if (statePayload.intent === 'login') {
      return c.redirect(`/${encodeURIComponent(authUser.login)}`);
    }

    // 6. Handle explicit claim intent
    // Security check: User must match the claim target if target was specified
    if (statePayload.claim_username && statePayload.claim_username !== authUser.login.toLowerCase()) {
      const safeAuthLogin = escapeHtml(authUser.login);
      const safeClaimTarget = escapeHtml(statePayload.claim_username || '');
      return c.html(`
        <div style="background:#07090e; color:#ff2a85; font-family:sans-serif; padding:48px; text-align:center;">
          <h2>⚠️ Identity Mismatch</h2>
          <p>You authenticated as <strong>@${safeAuthLogin}</strong>, but attempted to claim <strong>@${safeClaimTarget}</strong>.</p>
          <a href="/${encodeURIComponent(authUser.login)}" style="color:#00f0ff; margin-top:16px; display:inline-block;">Go to your own egg: githoot.com/${encodeURIComponent(authUser.login)} →</a>
        </div>
      `, 403);
    }

    // Execute atomic claim transaction
    const claimRes = await executeClaimTransaction(authUser, c.env);

    // Redirect to Hatch Reveal ritual with server-authoritative slot status
    return c.redirect(`/${encodeURIComponent(authUser.login)}?hatch=true&guardian_id=${claimRes.guardian.id}&is_free=${claimRes.isFree ? '1' : '0'}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Claim transaction failed';
    if (msg.includes('EARLY_ACCESS_FULL')) {
      return c.redirect(`/${encodeURIComponent(statePayload.claim_username || 'user')}?checkout=true`);
    }
    return c.text(`Authentication error: ${msg}`, 500);
  } finally {
    // Always revoke the single OAuth token at GitHub, then discard locally.
    if (accessToken) {
      await revokeAccessToken(accessToken, c.env);
    }
  }
});

// 3. Current Authenticated Session (/auth/me or /api/auth/me)
authRouter.get('/me', async (c) => {
  const cookieHeader = c.req.header('cookie') || '';
  const match = cookieHeader.match(/githoot_session=([^;]+)/);
  
  if (!match || !match[1]) {
    return c.json({ authenticated: false, user: null });
  }

  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    return c.text('AUTH_SECRET not configured on server.', 500);
  }

  const sessionToken = decodeURIComponent(match[1]);
  const user = await verifySessionToken(sessionToken, secret);

  if (!user) {
    return c.json({ authenticated: false, user: null });
  }

  return c.json({
    authenticated: true,
    user
  });
});

// 4. Logout Session
authRouter.all('/logout', async (c) => {
  const isSecure = c.env.ENVIRONMENT === 'production' || c.req.url.startsWith('https://');
  const secureAttr = isSecure ? '; Secure' : '';
  c.header('Set-Cookie', `githoot_session=; Path=/; HttpOnly${secureAttr}; SameSite=Lax; Max-Age=0`);
  if (c.req.method === 'GET') {
    return c.redirect('/');
  }
  return c.json({ success: true, authenticated: false });
});

// 5. Owner-only: delete my published private-inclusive aggregate snapshot (consent withdrawal).
//    Refresh is achieved by re-authenticating via /auth/github (re-consent + re-fetch).
authRouter.delete('/aggregate-stats/delete', async (c) => {
  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    return c.text('AUTH_SECRET not configured on server.', 500);
  }
  const cookieHeader = c.req.header('cookie') || '';
  const match = cookieHeader.match(/githoot_session=([^;]+)/);
  if (!match || !match[1]) {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }
  const user = await verifySessionToken(decodeURIComponent(match[1]), secret);
  if (!user) {
    return c.json({ success: false, error: 'Not authenticated' }, 401);
  }

  try {
    await c.env.DB.prepare('DELETE FROM github_aggregate_stats WHERE github_user_id = ?').bind(user.id).run();
    try {
      await deleteProfileCacheKeys(c.env.CACHE_KV, user.login);
    } catch {}
    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: 'Delete failed' }, 500);
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
