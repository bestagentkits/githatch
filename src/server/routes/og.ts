// ============================================================================
// GitHoot Dynamic OpenGraph & Social Image Endpoint (src/server/routes/og.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveGitHubProfile } from '../services/github/resolver';

export const ogRouter = new Hono<{ Bindings: Env }>();

ogRouter.get('/:username', async (c) => {
  const rawParam = c.req.param('username');
  const username = rawParam.replace(/\.(png|gif|webp|svg)$/, '');

  try {
    const profile = await resolveGitHubProfile(username, c.env);
    const guardianName = profile.guardian?.name || 'Mythic Guardian Egg';
    const rarity = profile.guardian?.rarity_tier || profile.estimated_rarity || 'Common';
    const topLang = profile.top_languages[0] || 'Polyglot';

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#141b27"/>
      <stop offset="100%" stop-color="#07090e"/>
    </radialGradient>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ff2a85"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>

  <!-- Glowing Border Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="none" stroke="#00f0ff" stroke-width="2" stroke-opacity="0.3"/>

  <!-- Logo Top Left -->
  <rect x="64" y="64" width="48" height="48" rx="12" fill="url(#neonGrad)"/>
  <text x="88" y="96" font-family="'Segoe UI', -apple-system, sans-serif" font-size="26" font-weight="bold" fill="#000" text-anchor="middle">🦉</text>
  <text x="124" y="98" font-family="'Segoe UI', -apple-system, sans-serif" font-size="32" font-weight="900" fill="#ffffff" letter-spacing="-1">GitHoot.com</text>

  <!-- Rarity Tag -->
  <rect x="850" y="64" width="280" height="42" rx="21" fill="#ff2a85" fill-opacity="0.15" stroke="#ff2a85" stroke-width="1.5"/>
  <text x="990" y="91" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#ff2a85" text-anchor="middle">★ ${rarity.toUpperCase()} GUARDIAN ★</text>

  <!-- Left Side: Character Card -->
  <rect x="64" y="150" width="440" height="400" rx="16" fill="#0d111a" stroke="#00f0ff" stroke-width="1.5"/>
  <circle cx="284" cy="330" r="140" fill="#00f0ff" fill-opacity="0.1"/>
  <text x="284" y="350" font-family="'Segoe UI', -apple-system, sans-serif" font-size="120" text-anchor="middle">🦊</text>
  <text x="284" y="510" font-family="'Segoe UI', -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#00f0ff" text-anchor="middle">${escapeXml(guardianName)}</text>

  <!-- Right Side: Developer Stats & Info -->
  <text x="560" y="210" font-family="'Segoe UI', -apple-system, sans-serif" font-size="44" font-weight="900" fill="#ffffff">@${escapeXml(profile.login)}</text>
  <text x="560" y="255" font-family="'Segoe UI', -apple-system, sans-serif" font-size="20" fill="#8b9bb4">Guarding open source repositories on GitHub</text>

  <!-- Stats Grid Boxes -->
  <rect x="560" y="300" width="260" height="90" rx="8" fill="#141b27" stroke="rgba(255,255,255,0.08)"/>
  <text x="585" y="345" font-family="'Courier New', monospace" font-size="28" font-weight="bold" fill="#00f0ff">${profile.public_repos}</text>
  <text x="585" y="370" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#53627a">PUBLIC REPOSITORIES</text>

  <rect x="850" y="300" width="260" height="90" rx="8" fill="#141b27" stroke="rgba(255,255,255,0.08)"/>
  <text x="875" y="345" font-family="'Courier New', monospace" font-size="28" font-weight="bold" fill="#ffa800">${escapeXml(topLang)}</text>
  <text x="875" y="370" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="#53627a">PRIMARY LANGUAGE</text>

  <!-- Bottom CTA Band -->
  <rect x="560" y="440" width="550" height="70" rx="10" fill="#00f0ff"/>
  <text x="835" y="484" font-family="'Courier New', monospace" font-size="20" font-weight="900" fill="#000000" text-anchor="middle">CLAIM YOUR GUARDIAN → githoot.com/${escapeXml(profile.login)}</text>
</svg>
    `.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch {
    return c.text('Error generating OG image', 500);
  }
});

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
