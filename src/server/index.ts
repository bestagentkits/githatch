// ============================================================================
// GitHoot Cloudflare Edge Application Entrypoint (src/server/index.ts)
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { resolveGitHubProfile } from './services/github/resolver';
import { authRouter } from './routes/auth';
import { badgeRouter } from './routes/badge';
import { ogRouter } from './routes/og';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// Mount Sub-Routers
app.route('/auth', authRouter);
app.route('/badge', badgeRouter);
app.route('/og', ogRouter);

// Healthcheck
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'githoot-edge-api',
    domain: c.env.DOMAIN || 'githoot.com',
    timestamp: Date.now()
  });
});

// Profile Lookup API (SWR & Anti-throttling)
app.get('/api/profile/:username', async (c) => {
  const username = c.req.param('username');
  if (!username || username.length > 40) {
    return c.json({ error: 'Invalid username' }, 400);
  }

  try {
    const profile = await resolveGitHubProfile(username, c.env);
    return c.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resolve profile';
    return c.json({ error: message }, 500);
  }
});

// Early Access Quota Status
app.get('/api/early-access/status', async (c) => {
  try {
    const totalSlots = parseInt(c.env.EARLY_ACCESS_TOTAL_SLOTS || '100', 10);
    const claimedRow = await c.env.DB.prepare("SELECT count(*) as count FROM early_access_slots WHERE status = 'claimed'")
      .first<{ count: number }>();
    
    const claimed = claimedRow ? claimedRow.count : 0;
    const remaining = Math.max(0, totalSlots - claimed);

    return c.json({
      total: totalSlots,
      claimed,
      remaining,
      is_free: remaining > 0
    });
  } catch {
    // Fallback if DB not ready
    return c.json({
      total: 100,
      claimed: 0,
      remaining: 100,
      is_free: true
    });
  }
});

// Static Asset & SPA Fallback for Cloudflare Pages
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) return res;
    const url = new URL(c.req.url);
    if (!url.pathname.includes('.')) {
      const indexReq = new Request(new URL('/', c.req.url).toString(), c.req.raw);
      return c.env.ASSETS.fetch(indexReq);
    }
    return res;
  }
  return c.text('Not found', 404);
});

export default app;
