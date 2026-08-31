// ============================================================================
// GitHoot Authentication & OAuth Router (src/server/routes/auth.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateSignedState, verifySignedState, exchangeCodeForAccessToken, fetchAuthenticatedUser, createSessionToken, verifySessionToken, fetchAggregateStats, revokeAccessToken } from '../services/auth/oauth';
import type { UserSession } from '../types';
import { executeClaimTransaction } from '../services/claim/transaction';

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


// 1. Initiate GitHub OAuth
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
    return c.text('Invalid OAuth callback: missing code or state.', 400);
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
          await c.env.CACHE_KV.delete(`gh:profile:v3:${authUser.login.toLowerCase()}`);
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
