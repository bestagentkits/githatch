// ============================================================================
// GitHoot Dynamic SVG README Badge Endpoint (src/server/routes/badge.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveGitHubProfile } from '../services/github/resolver';

export const badgeRouter = new Hono<{ Bindings: Env }>();

badgeRouter.get('/:username{.+\\.svg$}', async (c) => {
  const rawParam = c.req.param('username');
  const username = rawParam.replace(/\.svg$/, '');

  try {
    const profile = await resolveGitHubProfile(username, c.env);
    const guardianName = profile.guardian?.name || profile.egg_archetype_id || 'Guardian Egg';
    const level = profile.guardian?.level || 1;
    const rarity = profile.guardian?.rarity_tier || profile.estimated_rarity || 'Common';

    const elementColor = getElementBadgeColor(profile.guardian?.element || 'Cyber');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="40" viewBox="0 0 300 40">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#07090e"/>
      <stop offset="100%" stop-color="#141b27"/>
    </linearGradient>
  </defs>
  <rect width="300" height="40" rx="8" fill="url(#grad)" stroke="${elementColor}" stroke-width="1.5"/>
  <circle cx="20" cy="20" r="10" fill="${elementColor}"/>
  <text x="20" y="24" font-family="'Segoe UI', -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#000" text-anchor="middle">🦉</text>
  <text x="42" y="24" font-family="'Segoe UI', -apple-system, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">GitHoot: ${escapeXml(guardianName)}</text>
  <rect x="235" y="10" width="55" height="20" rx="4" fill="${elementColor}" fill-opacity="0.2" stroke="${elementColor}" stroke-width="1"/>
  <text x="262" y="24" font-family="'Courier New', monospace" font-size="11" font-weight="bold" fill="${elementColor}" text-anchor="middle">Lv.${level}</text>
</svg>
    `.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=43200, s-maxage=43200',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch {
    const fallbackSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="36" viewBox="0 0 220 36">
  <rect width="220" height="36" rx="6" fill="#0d111a" stroke="#00f0ff" stroke-width="1"/>
  <text x="110" y="22" font-family="sans-serif" font-size="12" font-weight="bold" fill="#00f0ff" text-anchor="middle">🦉 GitHoot Guardian</text>
</svg>
    `.trim();

    return new Response(fallbackSvg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
});

function getElementBadgeColor(element: string): string {
  switch (element) {
    case 'Fire': return '#ff4500';
    case 'Cyber': return '#00f0ff';
    case 'Water': return '#0070f3';
    case 'Nature': return '#00df71';
    case 'Light': return '#ffa800';
    case 'Void': return '#7928ca';
    default: return '#00f0ff';
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
