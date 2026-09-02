// ============================================================================
// GitHoot Cloudflare Edge Application Entrypoint (src/server/index.ts)
// ============================================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { resolveGitHubProfile, UserNotFoundError } from './services/github/resolver';
import { authRouter } from './routes/auth';
import { badgeRouter } from './routes/badge';
import { ogRouter } from './routes/og';
import { galleryRouter } from './routes/gallery';
import { handleQueueBatch, type GenerationQueueMessage } from './queue/generation-worker';
import { processProfileRevalidation } from './queue/sync-worker';

export const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// Mount Sub-Routers
app.route('/auth', authRouter);
app.route('/api/auth', authRouter);
app.route('/badge', badgeRouter);
app.route('/og', ogRouter);
app.route('/api/gallery', galleryRouter);

// Healthcheck
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'githoot-edge-api',
    domain: c.env.DOMAIN || 'githoot.com',
    timestamp: Date.now()
  });
});

// Public Client Configuration & Status
app.get('/api/config', (c) => {
  const total = parseInt(c.env.EARLY_ACCESS_TOTAL_SLOTS || '100', 10);
  const posthog = Boolean(c.env.POSTHOG_API_KEY);
  return c.json({
    quota_total: total,
    free_until: total,
    charge_after_usd: 0.99,
    posthog_configured: posthog,
    analytics_enabled: posthog,
    environment: c.env.ENVIRONMENT || 'development',
    domain: c.env.DOMAIN || 'githoot.com',
    cdn_domain: c.env.CDN_DOMAIN || 'cdn.githoot.com'
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
    if (err instanceof UserNotFoundError || (err instanceof Error && err.name === 'UserNotFoundError')) {
      return c.json({ error: message }, 404);
    }
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
      is_free: remaining > 0,
      user_has_claimed: false,
      degraded: false
    });
  } catch {
    // Fallback if DB not ready / degraded (never synthesize fake 0/100 numbers)
    return c.json({
      total: 100,
      claimed: null,
      remaining: null,
      is_free: true,
      user_has_claimed: false,
      degraded: true
    });
  }
});

// Static Asset & SPA Fallback with Dynamic OpenGraph Meta Tags for Cloudflare Pages
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url);
    const cleanUser = url.pathname.replace(/^\//, '').split('/')[0];
    const isProfile = cleanUser && !url.pathname.includes('.') && cleanUser !== 'explore' && cleanUser !== 'gallery' && cleanUser !== 'design' && cleanUser !== 'docs' && cleanUser !== 'api' && cleanUser !== 'auth' && cleanUser !== 'badge' && cleanUser !== 'og';

    if (isProfile) {
      const indexReq = new Request(new URL('/', c.req.url).toString(), c.req.raw);
      const indexRes = await c.env.ASSETS.fetch(indexReq);
      const html = await indexRes.text();

      const title = `@${cleanUser} · GitHoot Realm Guardian`;
      const desc = `View @${cleanUser}'s developer identity, coding stats, and living hatched companion on GitHoot.`;
      const ogImage = `${url.origin}/og/${encodeURIComponent(cleanUser)}.png?v=3`;
      const ogUrl = `${url.origin}/${encodeURIComponent(cleanUser)}`;

      const ogMeta = `
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${ogUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${ogImage}">
      `.trim();

      // Strip generic tags and inject user-specific OpenGraph meta tags
      let modifiedHtml = html.replace(/<title>.*?<\/title>/s, '')
        .replace(/<meta\s+property="og:[^>]+>/gi, '')
        .replace(/<meta\s+name="twitter:[^>]+>/gi, '');

      modifiedHtml = modifiedHtml.replace('</head>', `${ogMeta}\n</head>`);

      return new Response(modifiedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0, must-revalidate'
        }
      });
    }

    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) return res;
    if (!url.pathname.includes('.')) {
      const indexReq = new Request(new URL('/', c.req.url).toString(), c.req.raw);
      return c.env.ASSETS.fetch(indexReq);
    }
    return res;
  }
  return c.text('Not found', 404);
});

// Export both fetch and queue consumer handlers for Cloudflare Workers / Pages
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<GenerationQueueMessage>, env: Env): Promise<void> {
    return handleQueueBatch(batch, env);
  },
  async scheduled(_controller: unknown, env: Env, _ctx: unknown): Promise<void> {
    const { drainOutbox } = await import('./queue/outbox');
    const { reconcileAbandonedReservations } = await import('./services/billing/budget-guard');
    await drainOutbox(env);
    await reconcileAbandonedReservations(env);
  }
};
