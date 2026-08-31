// ============================================================================
// GitHoot Authentication & OAuth Router (src/server/routes/auth.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { generateSignedState, verifySignedState, exchangeCodeForAccessToken, fetchAuthenticatedUser, createSessionToken, verifySessionToken } from '../services/auth/oauth';
import type { UserSession } from '../types';
import { executeClaimTransaction } from '../services/claim/transaction';

export const authRouter = new Hono<{ Bindings: Env }>();

// 1. Initiate GitHub OAuth
authRouter.get('/github', async (c) => {
  const claimUsername = c.req.query('claim_username') || '';
  const intent: 'login' | 'claim' = claimUsername ? 'claim' : 'login';
  const rawClientId = c.env.GITHUB_CLIENT_ID || '';
  const clientId = rawClientId.replace(/^["']|["']$/g, '').trim();

  if (!clientId) {
    return c.text('GITHUB_CLIENT_ID not configured.', 500);
  }

  const secret = c.env.AUTH_SECRET || 'default-secret-change-in-prod';
  const state = await generateSignedState(claimUsername, secret, intent);

  const redirectUri = `${c.req.url.split('/auth')[0]}/auth/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${encodeURIComponent(state)}`;

  return c.redirect(githubAuthUrl);
});

// 2. OAuth Callback
authRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.text('Invalid OAuth callback: missing code or state.', 400);
  }

  const secret = c.env.AUTH_SECRET || 'default-secret-change-in-prod';
  const statePayload = await verifySignedState(state, secret);

  if (!statePayload) {
    return c.text('Invalid or expired OAuth state token (CSRF check failed).', 403);
  }

  try {
    // 1. Exchange code for access token
    const accessToken = await exchangeCodeForAccessToken(code, c.env);

    // 2. Fetch authenticated user data from GitHub
    const authUser = await fetchAuthenticatedUser(accessToken);
    // 3. Set persistent secure HttpOnly session cookie first
    const userSession: UserSession = {
      id: authUser.id,
      login: authUser.login,
      name: authUser.name,
      avatar_url: authUser.avatar_url
    };
    const sessionToken = await createSessionToken(userSession, secret);
    c.header('Set-Cookie', `githoot_session=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);

    // 4. Handle pure login intent (0 AI cost, no premature claim)
    if (statePayload.intent === 'login') {
      return c.redirect(`/${encodeURIComponent(authUser.login)}`);
    }

    // 5. Handle explicit claim intent
    // Security check: User must match the claim target if target was specified
    if (statePayload.claim_username && statePayload.claim_username !== authUser.login.toLowerCase()) {
      return c.html(`
        <div style="background:#07090e; color:#ff2a85; font-family:sans-serif; padding:48px; text-align:center;">
          <h2>⚠️ Identity Mismatch</h2>
          <p>You authenticated as <strong>@${authUser.login}</strong>, but attempted to claim <strong>@${statePayload.claim_username}</strong>.</p>
          <a href="/${encodeURIComponent(authUser.login)}" style="color:#00f0ff; margin-top:16px; display:inline-block;">Go to your own egg: githoot.com/${authUser.login} →</a>
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
  }
});

// 3. Current Authenticated Session (/auth/me or /api/auth/me)
authRouter.get('/me', async (c) => {
  const cookieHeader = c.req.header('cookie') || '';
  const match = cookieHeader.match(/githoot_session=([^;]+)/);
  
  if (!match || !match[1]) {
    return c.json({ authenticated: false, user: null });
  }

  const sessionToken = decodeURIComponent(match[1]);
  const secret = c.env.AUTH_SECRET || 'default-secret-change-in-prod';
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
  c.header('Set-Cookie', 'githoot_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  if (c.req.method === 'GET') {
    return c.redirect('/');
  }
  return c.json({ success: true, authenticated: false });
});
