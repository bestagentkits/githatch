// ============================================================================
// GitHoot Dynamic OpenGraph & Social Image Endpoint (src/server/routes/og.ts)
// ============================================================================

import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveGitHubProfile } from '../services/github/resolver';
import { renderSvgToPng } from '../services/image/resvg-renderer';

export const ogRouter = new Hono<{ Bindings: Env }>();

function getRarityColor(tier?: string): string {
  switch (tier) {
    case 'Rare': return '#3b82f6';
    case 'Epic': return '#ff2a85';
    case 'Legendary': return '#ffa800';
    case 'Mythic': return '#a855f7';
    case 'Common':
    default: return '#00f0ff';
  }
}

function getSpeciesVectorArt(species?: string, rarityColor = '#00f0ff'): string {
  if (!species || species.includes('Unhatched') || species.includes('Egg')) {
    // Golden egg with glowing core
    return `
      <g transform="translate(270, 275)">
        <ellipse cx="0" cy="0" rx="60" ry="80" fill="url(#neonGrad)" opacity="0.8" />
        <ellipse cx="0" cy="0" rx="52" ry="70" fill="#141c2c" />
        <path d="M -20 -30 L 10 -10 L -10 15 L 20 40" stroke="#00f0ff" stroke-width="3" fill="none" opacity="0.8"/>
        <circle cx="0" cy="0" r="18" fill="#ffa800" filter="url(#glow)" opacity="0.6"/>
      </g>
    `;
  }

  // Living Dragon / Celestial Drake
  if (species.includes('Celestial') || species.includes('Drake')) {
    return `
      <g transform="translate(270, 275) scale(1.15)">
        <path d="M -50 20 C -40 -30, -10 -60, 0 -70 C 10 -60, 40 -30, 50 20 C 30 60, -30 60, -50 20 Z" fill="${rarityColor}" opacity="0.25"/>
        <path d="M -40 -10 C -25 -40, -5 -60, 0 -65 C 5 -60, 25 -40, 40 -10 C 20 40, -20 40, -40 -10 Z" fill="#101726" stroke="${rarityColor}" stroke-width="2"/>
        <path d="M -25 -40 C -45 -70, -60 -80, -70 -75 C -65 -60, -45 -45, -30 -35 Z" fill="#00f0ff"/>
        <path d="M 25 -40 C 45 -70, 60 -80, 70 -75 C 65 -60, 45 -45, 30 -35 Z" fill="#00f0ff"/>
        <circle cx="-14" cy="-5" r="5" fill="#ff2a85"/>
        <circle cx="14" cy="-5" r="5" fill="#ff2a85"/>
        <polygon points="0,-25 8,-12 0,0 -8,-12" fill="#00f0ff" filter="url(#glow)"/>
      </g>
    `;
  }

  // Emberfox / Fire
  if (species.includes('Emberfox') || species.includes('Fire')) {
    return `
      <g transform="translate(270, 275) scale(1.15)">
        <polygon points="-50,-50 -25,-10 -60,20" fill="#ff2a85"/>
        <polygon points="50,-50 25,-10 60,20" fill="#ff2a85"/>
        <polygon points="-40,-10 40,-10 0,50" fill="#141c2c" stroke="#ff2a85" stroke-width="2"/>
        <polygon points="-25,-5 25,-5 0,35" fill="#ffa800"/>
        <circle cx="-12" cy="5" r="4" fill="#000"/>
        <circle cx="12" cy="5" r="4" fill="#000"/>
        <circle cx="0" cy="22" r="3" fill="#000"/>
      </g>
    `;
  }

  // Neon Byte / Cyber
  if (species.includes('Neon') || species.includes('Byte')) {
    return `
      <g transform="translate(270, 275) scale(1.15)">
        <rect x="-45" y="-45" width="90" height="90" rx="14" fill="#101726" stroke="#00f0ff" stroke-width="3"/>
        <path d="M -10 -30 L 15 -5 L -5 5 L 10 30" stroke="#00f0ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none" filter="url(#glow)"/>
        <circle cx="-25" cy="-25" r="4" fill="#00ff88"/>
        <circle cx="25" cy="25" r="4" fill="#00ff88"/>
      </g>
    `;
  }

  // Default Cyber Crest
  return `
    <g transform="translate(270, 275) scale(1.15)">
      <polygon points="0,-60 50,-20 35,45 0,65 -35,45 -50,-20" fill="#101726" stroke="${rarityColor}" stroke-width="3"/>
      <circle cx="0" cy="0" r="24" fill="${rarityColor}" opacity="0.3" filter="url(#glow)"/>
      <polygon points="0,-30 25,-10 0,35 -25,-10" fill="${rarityColor}"/>
    </g>
  `;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const MAX_HERO_BYTES = 3 * 1024 * 1024;

export async function getGuardianImageDataUri(heroUrl: string | undefined, env: Env, reqUrl: string): Promise<string | null> {
  if (!heroUrl) return null;
  try {
    // 1. Local deterministic sample-pet asset served by the Pages ASSETS binding.
    //    Convert to the PNG variant and allow ONLY an exact sanitized path.
    if (heroUrl.includes('/assets/sample-pets/')) {
      if (!env.ASSETS) return null;
      const pngPath = heroUrl.replace(/\.(webp|jpg|jpeg)$/i, '.png');
      if (!/^\/assets\/sample-pets\/[a-z0-9-]+\.png$/.test(pngPath)) return null;
      const res = await env.ASSETS.fetch(new Request(new URL(pngPath, reqUrl).toString()));
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (ct && !ct.includes('image/png')) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_HERO_BYTES) return null;
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    }

    // 2. AI-generated guardian hero stored in R2, addressed via the trusted CDN host only.
    const cdnHost = env.CDN_DOMAIN || 'cdn.githoot.com';
    let parsed: URL;
    try {
      parsed = new URL(heroUrl);
    } catch {
      return null;
    }
    const key = parsed.pathname.replace(/^\//, '');
    if (parsed.hostname === cdnHost && /^guardians\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.png$/.test(key)) {
      if (!env.ASSETS_BUCKET) return null;
      const obj = await env.ASSETS_BUCKET.get(key) as unknown as { size?: number; arrayBuffer(): Promise<ArrayBuffer> } | null;
      if (!obj) return null;
      // Pre-check size before reading the full body when R2 exposes it.
      if (typeof obj.size === 'number' && (obj.size === 0 || obj.size > MAX_HERO_BYTES)) return null;
      const bytes = new Uint8Array(await obj.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_HERO_BYTES) return null;
      return `data:image/png;base64,${bytesToBase64(bytes)}`;
    }

    return null;
  } catch {
    return null;
  }
}

ogRouter.get('/:username', async (c) => {
  const rawParam = c.req.param('username');
  const username = rawParam.replace(/\.(png|gif|webp|svg)$/, '');

  try {
    const profile = await resolveGitHubProfile(username, c.env);
    const guardian = profile.guardian;
    const guardianName = guardian?.name || (profile.claimed ? 'Living Guardian' : 'Genesis Guardian Egg');
    const species = guardian?.species || (profile.claimed ? 'Bound Companion' : 'Unhatched Egg');
    const rarity = guardian?.rarity_tier || profile.estimated_rarity || 'Common';
    const rarityColor = getRarityColor(rarity);
    const topLang = profile.top_languages[0] || 'Polyglot';
    const element = guardian?.element || 'Aether';
    const energyState = guardian?.energy_state || profile.mood?.state || 'Active';
    const vectorArt = getSpeciesVectorArt(species, rarityColor);
    const heroDataUri = profile.claimed ? await getGuardianImageDataUri(guardian?.hero_image_url, c.env, c.req.url) : null;
    const shrineArt = heroDataUri
      ? `<image x="160" y="165" width="220" height="220" href="${heroDataUri}" clip-path="url(#shrineClip)" preserveAspectRatio="xMidYMid meet"/>`
      : vectorArt;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#141c2c"/>
      <stop offset="60%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#040609"/>
    </radialGradient>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ff2a85"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${rarityColor}"/>
      <stop offset="100%" stop-color="#00f0ff"/>
    </linearGradient>
    <pattern id="cyberGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 240, 255, 0.05)" stroke-width="1"/>
    </pattern>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <clipPath id="shrineClip">
      <circle cx="270" cy="275" r="88"/>
    </clipPath>
  </defs>

  <!-- Background Layer -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  <rect width="1200" height="630" fill="url(#cyberGrid)"/>

  <!-- Glowing Outer Frame -->
  <rect x="20" y="20" width="1160" height="590" rx="20" fill="none" stroke="${rarityColor}" stroke-width="2" stroke-opacity="0.4"/>
  <rect x="28" y="28" width="1144" height="574" rx="16" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>

  <!-- Corner Brackets -->
  <path d="M 20 60 L 20 20 L 60 20" fill="none" stroke="#00f0ff" stroke-width="4" />
  <path d="M 1180 60 L 1180 20 L 1140 20" fill="none" stroke="#ff2a85" stroke-width="4" />
  <path d="M 20 570 L 20 610 L 60 610" fill="none" stroke="#00f0ff" stroke-width="4" />
  <path d="M 1180 570 L 1180 610 L 1140 610" fill="none" stroke="#ff2a85" stroke-width="4" />

  <!-- Brand Logo Top-Left -->
  <rect x="60" y="52" width="44" height="44" rx="12" fill="url(#neonGrad)"/>
  <g transform="translate(82, 74) scale(0.68)">
    <ellipse cx="0" cy="0" rx="18" ry="22" fill="#07090e"/>
    <circle cx="-7" cy="-5" r="6" fill="#00f0ff"/>
    <circle cx="7" cy="-5" r="6" fill="#00f0ff"/>
    <circle cx="-7" cy="-5" r="2.5" fill="#000"/>
    <circle cx="7" cy="-5" r="2.5" fill="#000"/>
    <polygon points="0,0 -3,6 3,6" fill="#ffa800"/>
  </g>
  <text x="116" y="83" font-family="Archivo" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="-0.5">GitHoot</text>
  <text x="236" y="81" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="#00f0ff" letter-spacing="1">REALM GUARDIAN</text>

  <!-- Rarity Pill Top-Right -->
  <rect x="840" y="52" width="300" height="44" rx="22" fill="${rarityColor}" fill-opacity="0.12" stroke="${rarityColor}" stroke-width="1.5"/>
  <text x="990" y="80" font-family="JetBrains Mono" font-size="14" font-weight="900" fill="${rarityColor}" text-anchor="middle" letter-spacing="1.5">[ ${rarity.toUpperCase()} · ${element.toUpperCase()} ]</text>

  <!-- Left Side: Guardian Shrine Stage -->
  <rect x="60" y="125" width="420" height="445" rx="16" fill="#0c111c" stroke="${rarityColor}" stroke-width="1.5" stroke-opacity="0.6"/>
  
  <!-- Aura Circle & Guardian Character (real hatched pet image when claimed) -->
  <circle cx="270" cy="275" r="120" fill="${rarityColor}" fill-opacity="0.1" filter="url(#glow)"/>
  <circle cx="270" cy="275" r="90" fill="#141c2c" stroke="${rarityColor}" stroke-width="1.5" stroke-dasharray="4,4"/>
  ${shrineArt}

  <!-- Guardian Name & Species -->
  <text x="270" y="445" font-family="Archivo" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(guardianName)}</text>
  <text x="270" y="475" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="#00f0ff" text-anchor="middle">${escapeXml(species)}</text>

  <!-- Energy State Pill -->
  <rect x="150" y="500" width="240" height="34" rx="17" fill="rgba(0, 255, 136, 0.12)" stroke="#00ff88" stroke-width="1"/>
  <text x="270" y="522" font-family="JetBrains Mono" font-size="12" font-weight="800" fill="#00ff88" text-anchor="middle">STATE: ${energyState.toUpperCase()}</text>

  <!-- Right Side: Developer Dossier & Metric Cards -->
  <!-- User Title Banner -->
  <text x="520" y="175" font-family="Archivo" font-size="36" font-weight="900" fill="#ffffff">${escapeXml(profile.name || profile.login)}</text>
  <text x="520" y="210" font-family="JetBrains Mono" font-size="18" font-weight="700" fill="#00f0ff">@${escapeXml(profile.login)}</text>
  <text x="520" y="240" font-family="JetBrains Mono" font-size="13" fill="#8b9bb4">Guarding open source codebase on GitHub · Seed: 0x${profile.dna_seed.slice(0, 8)}</text>

  <!-- 4 Stats Metric Cards (2x2 Grid) -->
  <!-- Card 1: Public Repos -->
  <rect x="520" y="270" width="290" height="88" rx="12" fill="#101726" stroke="rgba(255, 255, 255, 0.08)"/>
  <text x="544" y="312" font-family="JetBrains Mono" font-size="28" font-weight="900" fill="#00f0ff">${profile.public_repos}</text>
  <text x="544" y="338" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#53627a" letter-spacing="1">PUBLIC REPOSITORIES</text>

  <!-- Card 2: Followers -->
  <rect x="830" y="270" width="290" height="88" rx="12" fill="#101726" stroke="rgba(255, 255, 255, 0.08)"/>
  <text x="854" y="312" font-family="JetBrains Mono" font-size="28" font-weight="900" fill="#00f0ff">${profile.followers}</text>
  <text x="854" y="338" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#53627a" letter-spacing="1">GITHUB FOLLOWERS</text>

  <!-- Card 3: Primary Stack -->
  <rect x="520" y="375" width="290" height="88" rx="12" fill="#101726" stroke="rgba(255, 255, 255, 0.08)"/>
  <text x="544" y="417" font-family="JetBrains Mono" font-size="22" font-weight="900" fill="#ffa800">${escapeXml(topLang)}</text>
  <text x="544" y="443" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#53627a" letter-spacing="1">PRIMARY STACK</text>

  <!-- Card 4: Total Stars -->
  <rect x="830" y="375" width="290" height="88" rx="12" fill="#101726" stroke="rgba(255, 255, 255, 0.08)"/>
  <g transform="translate(850, 404) scale(0.9)">
    <polygon points="0,-12 3.6,-3.6 12,-3.6 5.2,1.8 7.8,10.2 0,5.4 -7.8,10.2 -5.2,1.8 -12,-3.6 -3.6,-3.6" fill="#ff2a85" filter="url(#glow)"/>
  </g>
  <text x="872" y="417" font-family="JetBrains Mono" font-size="24" font-weight="900" fill="#ff2a85">${profile.total_stars}</text>
  <text x="854" y="443" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#53627a" letter-spacing="1">REPOSITORY STARS</text>
  <!-- Bottom Interactive CTA Banner -->
  <rect x="520" y="485" width="600" height="75" rx="12" fill="url(#accentGrad)" filter="url(#glow)"/>
  <text x="820" y="532" font-family="JetBrains Mono" font-size="16" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="1">EXPLORE &amp; HATCH → GITHOOT.COM/${escapeXml(profile.login.toUpperCase())}</text>
</svg>
    `.trim();

    let format: 'png' | 'svg' = 'png';
    if (rawParam.endsWith('.png')) {
      format = 'png';
    } else if (rawParam.endsWith('.svg')) {
      format = 'svg';
    } else {
      // Negotiate via Accept header only when no explicit extension is supplied
      const accept = c.req.header('accept') || '';
      if (accept.startsWith('image/svg+xml') && !accept.includes('image/png') && !accept.includes('image/*') && !accept.includes('*/*')) {
        format = 'svg';
      } else {
        format = 'png';
      }
    }

    if (format === 'svg') {
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400'
        }
      });
    }

    const pngBuffer = await renderSvgToPng(svg, 1200);
    return new Response(pngBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pngBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OG Image] Error generating card:', msg);
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
