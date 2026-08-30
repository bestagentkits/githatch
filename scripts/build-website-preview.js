// ============================================================================
// GitHoot Marketing Website Preview Generator
// Output: plans/reports/githoot-website-preview.html
// Implements the accepted contract design in Option 1 Cyber-Arcade Fantasy.
// ============================================================================

import fs from 'fs';
import path from 'path';

const OUT = 'plans/reports/githoot-website-preview.html';

const html = `<!DOCTYPE html>
<html lang="en" data-theme="cyber">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHoot — Your GitHub profile hatches a Guardian (Preview)</title>
  <meta name="description" content="Transform your public GitHub commits and developer identity into a living, persistent fantasy guardian companion on Cloudflare Edge.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=JetBrains+Mono:wght@500;700;800&family=Schibsted+Grotesk:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Option 1: Cyber-Arcade Fantasy Design Tokens */
      --bg-base: #07090E;
      --bg-surface-1: #0D111A;
      --bg-surface-2: #141B27;
      --bg-surface-3: #1C2637;
      --text-primary: #F0F6FC;
      --text-secondary: #8B9BB4;
      --text-muted: #53627A;
      --accent-cyan: #00F0FF;
      --accent-magenta: #FF2A85;
      --accent-amber: #FFA800;
      --accent-green: #00FF88;

      /* Glow & Shadow Tokens */
      --glow-cyan: 0 0 24px rgba(0, 240, 255, 0.35);
      --glow-magenta: 0 0 24px rgba(255, 42, 133, 0.35);
      --glow-amber: 0 0 24px rgba(255, 168, 0, 0.35);
      --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 240, 255, 0.12);

      /* Typography */
      --font-display: 'Archivo', sans-serif;
      --font-body: 'Schibsted Grotesk', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      /* Motion */
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 16px;
      line-height: 1.6;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      width: 100%;
    }

    /* Screen-reader accessible label */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Focus visible standard */
    a:focus-visible, button:focus-visible, input:focus-visible {
      outline: 2px solid var(--accent-cyan);
      outline-offset: 2px;
    }

    /* Typography Utilities */
    h1, h2, h3, h4 {
      font-family: var(--font-display);
      line-height: 1.15;
      text-wrap: balance;
    }

    p {
      text-wrap: pretty;
    }

    .mono {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.3);
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 16px;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.15);
    }

    .eyebrow.magenta {
      color: var(--accent-magenta);
      background: rgba(255, 42, 133, 0.08);
      border-color: rgba(255, 42, 133, 0.3);
      box-shadow: 0 0 16px rgba(255, 42, 133, 0.15);
    }

    .eyebrow.amber {
      color: var(--accent-amber);
      background: rgba(255, 168, 0, 0.08);
      border-color: rgba(255, 168, 0, 0.3);
      box-shadow: 0 0 16px rgba(255, 168, 0, 0.15);
    }

    .eyebrow.green {
      color: var(--accent-green);
      background: rgba(0, 255, 136, 0.08);
      border-color: rgba(0, 255, 136, 0.3);
      box-shadow: 0 0 16px rgba(0, 255, 136, 0.15);
    }

    /* Container */
    .container {
      width: 100%;
      max-width: 1120px;
      margin: 0 auto;
      padding: 0 24px;
      min-width: 0;
    }

    /* Global Navbar */
    .githoot-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(7, 9, 14, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(0, 240, 255, 0.12);
      padding: 10px 16px;
      width: 100%;
    }

    .nav-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }

    .nav-brand-wrap {
      display: flex;
      align-items: center;
      gap: 20px;
      min-width: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: #fff;
      font-family: var(--font-display);
      font-weight: 900;
      font-size: 20px;
      letter-spacing: -0.02em;
      flex-shrink: 0;
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
    }

    .desktop-nav {
      display: block;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
      list-style: none;
      flex-wrap: nowrap;
    }

    .nav-link {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 700;
      padding: 8px 10px;
      border-radius: 6px;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.15s, background-color 0.15s;
    }

    .nav-link:hover, .nav-link.active {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.06);
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .quota-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid var(--accent-cyan);
      padding: 5px 12px;
      border-radius: 9999px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-cyan);
      white-space: nowrap;
    }

    .quota-dot {
      width: 7px;
      height: 7px;
      background: var(--accent-cyan);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent-cyan);
      animation: pulse 1.5s infinite;
      flex-shrink: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .nav-search {
      display: flex;
      align-items: center;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 6px;
      overflow: hidden;
    }

    .nav-search input {
      background: transparent;
      border: none;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 6px 10px;
      width: 110px;
      outline: none;
    }

    .nav-search button {
      background: var(--accent-cyan);
      border: none;
      color: #000;
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 800;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .nav-search button:hover {
      background: #33f3ff;
    }

    /* Mobile Menu Toggle Button (>= 44x44px touch target) */
    .mobile-menu-btn {
      display: none;
      width: 44px;
      height: 44px;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 8px;
      color: var(--accent-cyan);
      font-size: 20px;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    }

    /* Persistent mobile quota row under brand (Contract S0: outside disclosure panel) */
    .mobile-quota-row {
      display: none;
      max-width: 1200px;
      margin: 0 auto;
    }

    .mobile-nav-panel {
      display: none;
      width: 100%;
      background: var(--bg-surface-1);
      border-top: 1px solid rgba(0, 240, 255, 0.15);
      padding: 16px 20px;
      margin-top: 10px;
    }

    .mobile-nav-panel.open {
      display: block;
    }

    .mobile-nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .mobile-nav-link {
      display: flex;
      align-items: center;
      min-height: 44px;
      padding: 8px 12px;
      color: var(--text-primary);
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 700;
      border-radius: 6px;
      background: var(--bg-surface-2);
    }

    .mobile-nav-link:hover, .mobile-nav-link.active {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
    }

    /* Section Spacing */
    section {
      padding: clamp(64px, 8vw, 112px) 0;
      border-bottom: 1px solid rgba(0, 240, 255, 0.12);
      position: relative;
      width: 100%;
      overflow: hidden;
    }

    /* S1: HERO */
    .hero-section {
      background: radial-gradient(circle at 50% 15%, #141B27 0%, #07090E 70%);
      padding-top: clamp(48px, 8vw, 96px);
      padding-bottom: clamp(64px, 10vw, 112px);
      text-align: center;
    }

    .hero-h1 {
      font-size: clamp(30px, 5.2vw, 56px);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 24px;
      color: #FFFFFF;
    }

    .hero-h1 .gradient-text {
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-magenta), var(--accent-amber));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: inline-block;
    }

    /* URL Morph Line */
    .url-morph-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.25);
      padding: 6px 16px;
      border-radius: 9999px;
      font-family: var(--font-mono);
      font-size: clamp(12px, 2.4vw, 15px);
      font-weight: 700;
      margin-bottom: 24px;
      max-width: 100%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .url-from {
      color: var(--text-muted);
      text-decoration: line-through;
      opacity: 0.7;
    }

    .url-arrow {
      color: var(--accent-magenta);
      font-weight: 900;
    }

    .url-to {
      color: var(--accent-cyan);
      text-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
    }

    .hero-subhead {
      font-size: clamp(15px, 2vw, 18px);
      color: var(--text-secondary);
      max-width: 680px;
      margin: 0 auto 36px;
      line-height: 1.6;
    }

    /* Hero Preview Pair (Egg + Poster) */
    .hero-visual-pair {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      margin: 0 auto 40px;
      max-width: 560px;
    }

    .hero-egg-box, .hero-guardian-box {
      flex: 1;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 230px;
      position: relative;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }

    .hero-visual-arrow {
      font-size: 24px;
      color: var(--accent-cyan);
      text-shadow: 0 0 16px var(--accent-cyan);
    }

    /* CSS Pure Egg Component (0 AI / 0 Bytes) */
    .pure-css-egg {
      width: 90px;
      height: 120px;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      background: radial-gradient(circle at 35% 35%, var(--egg-primary, #00F0FF), #050b14 75%);
      box-shadow: 0 0 30px var(--egg-glow, rgba(0, 240, 255, 0.45)), inset 0 0 15px rgba(255,255,255,0.4);
      position: relative;
      cursor: pointer;
      transition: transform 0.2s var(--ease-spring);
    }

    .pure-css-egg:hover {
      transform: scale(1.06) rotate(-3deg);
    }

    .pure-css-egg .crack {
      position: absolute;
      top: 30%;
      left: 25%;
      width: 50%;
      height: 40%;
      border-top: 2px solid #fff;
      border-right: 2px solid var(--egg-primary, #00F0FF);
      filter: drop-shadow(0 0 4px #fff);
      transform: rotate(-15deg);
      opacity: 0.8;
      animation: pulse 1s infinite;
    }

    /* Exactly ONE image downloaded above the fold */
    .hero-poster-img {
      width: 110px;
      height: 110px;
      object-fit: cover;
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
      border: 1px solid rgba(0, 240, 255, 0.3);
    }

    .visual-label {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      margin-top: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Hero Form */
    .hero-form {
      max-width: 540px;
      margin: 0 auto 16px;
      display: flex;
      background: var(--bg-surface-1);
      border: 2px solid var(--accent-cyan);
      border-radius: 12px;
      padding: 6px;
      box-shadow: var(--glow-cyan);
      transition: box-shadow 0.2s, border-color 0.2s;
    }

    .hero-form:focus-within {
      box-shadow: 0 0 32px rgba(0, 240, 255, 0.6);
    }

    .hero-prefix {
      display: flex;
      align-items: center;
      padding-left: 14px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 700;
      user-select: none;
    }

    .hero-input {
      flex: 1;
      background: transparent;
      border: none;
      color: #fff;
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 700;
      outline: none;
      padding: 10px 8px;
      min-width: 0;
    }

    .hero-btn {
      background: var(--accent-cyan);
      border: none;
      color: #000;
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 900;
      padding: 12px 28px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.4);
      transition: transform 0.15s, background-color 0.15s;
      white-space: nowrap;
      min-height: 44px;
    }

    .hero-btn:hover {
      background: #33f3ff;
      transform: translateY(-1px);
    }

    .hero-btn:active {
      transform: translateY(1px);
    }

    .hero-helper {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .hero-chips {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .chip-link {
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.06);
      border: 1px solid rgba(0, 240, 255, 0.2);
      padding: 6px 12px;
      border-radius: 6px;
      text-decoration: none;
      transition: background-color 0.15s, color 0.15s;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
    }

    .chip-link:hover {
      background: rgba(0, 240, 255, 0.15);
      color: #fff;
    }

    /* S2: SIGNATURE SEQUENCE DEMO */
    .demo-section {
      background: #0A0D14;
    }

    .section-head {
      text-align: center;
      max-width: 640px;
      margin: 0 auto 48px;
    }

    .section-title {
      font-size: clamp(26px, 4vw, 36px);
      font-weight: 900;
      margin-bottom: 12px;
    }

    .section-desc {
      color: var(--text-secondary);
      font-size: 15px;
      line-height: 1.6;
    }

    .demo-stage {
      max-width: 680px;
      margin: 0 auto;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* 16-Pose Sprite Frame Container — Lazy background loading on intersection */
    .sprite-viewport {
      width: 256px;
      height: 256px;
      position: relative;
      background: radial-gradient(circle at 50% 60%, rgba(0, 240, 255, 0.15), transparent 70%);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 0 32px rgba(0, 240, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .landing16-player {
      width: 256px;
      height: 256px;
      background-repeat: no-repeat;
      background-size: 4096px 256px;
      background-position: -3840px 0px; /* Default frame 16 (hero_stance) */
    }

    /* Runs forward once to frame 16 (hero_stance) and holds */
    .landing16-player.playing {
      animation: superheroLanding 1.1s steps(15) 1 forwards;
    }

    .landing16-player.slowmo {
      animation: superheroLanding 4.4s steps(15) 1 forwards;
    }

    @keyframes superheroLanding {
      from { background-position: 0px 0px; }
      to { background-position: -3840px 0px; }
    }

    .demo-controls {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .control-btn {
      background: var(--bg-surface-2);
      border: 1px solid rgba(0, 240, 255, 0.25);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
      min-height: 44px;
    }

    .control-btn:hover, .control-btn.active {
      background: var(--accent-cyan);
      color: #000;
      border-color: var(--accent-cyan);
    }

    .scrubber-container {
      width: 100%;
      max-width: 420px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .scrubber-slider {
      flex: 1;
      accent-color: var(--accent-cyan);
      cursor: pointer;
      min-height: 32px;
    }

    .pose-name-tag {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--accent-cyan);
      min-width: 160px;
      text-align: right;
    }

    .demo-caption {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* S3: HOW IT WORKS */
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }

    .step-card {
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.15);
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      position: relative;
    }

    .step-num {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 900;
      color: var(--accent-cyan);
      margin-bottom: 12px;
    }

    .step-card:nth-child(2) .step-num { color: var(--accent-magenta); }
    .step-card:nth-child(3) .step-num { color: var(--accent-amber); }
    .step-card:nth-child(4) .step-num { color: var(--accent-green); }

    .step-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 8px;
      color: #fff;
    }

    .step-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .determinism-box {
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.05), rgba(255, 42, 133, 0.05));
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 16px;
      padding: 32px;
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .determinism-icon {
      font-size: 36px;
      flex-shrink: 0;
    }

    .determinism-title {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .determinism-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    /* S4: EIGHT ELEMENTS & ODDS */
    .archetype-layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 36px;
      align-items: start;
    }

    .archetype-preview-card {
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 20px;
      padding: 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      position: sticky;
      top: 96px;
    }

    .archetypes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 16px;
    }

    /* Semantic Button Card for Accessible Tab Controls */
    .arch-card {
      background: var(--bg-surface-1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      font-family: inherit;
      width: 100%;
      display: flex;
      flex-direction: column;
    }

    .arch-card:hover, .arch-card.active {
      border-color: var(--card-color, var(--accent-cyan));
      background: var(--bg-surface-2);
      box-shadow: 0 0 16px var(--card-glow, rgba(0, 240, 255, 0.3));
      transform: translateY(-2px);
    }

    .arch-element {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      color: var(--card-color, var(--accent-cyan));
      margin-bottom: 6px;
    }

    .arch-name {
      font-size: 14px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }

    .arch-desc {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* Odds Table */
    .odds-block {
      margin-top: 48px;
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.15);
      border-radius: 16px;
      padding: 28px;
    }

    .odds-title {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .odds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
    }

    .odds-card {
      background: var(--bg-surface-2);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }

    .odds-pct {
      font-family: var(--font-mono);
      font-size: 24px;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .odds-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-secondary);
    }

    /* S5: LAUNCH STATUS (TRUST) */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 16px;
      border: 1px solid rgba(0, 240, 255, 0.15);
      background: var(--bg-surface-1);
    }

    .trust-table {
      width: 100%;
      min-width: 500px;
      border-collapse: collapse;
    }

    .trust-table th, .trust-table td {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      text-align: left;
      font-size: 14px;
    }

    .trust-table th {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      background: var(--bg-surface-2);
    }

    .trust-table tr:last-child td {
      border-bottom: none;
    }

    .trust-val {
      font-family: var(--font-mono);
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .trust-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      background: rgba(255, 168, 0, 0.1);
      color: var(--accent-amber);
      border: 1px solid rgba(255, 168, 0, 0.3);
    }

    /* S6: CREATOR */
    .creator-card {
      background: var(--bg-surface-1);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 20px;
      padding: clamp(32px, 5vw, 48px);
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 32px;
      align-items: start;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      max-width: 860px;
      margin: 0 auto;
    }

    .creator-avatar {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--accent-cyan);
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
    }

    .creator-name {
      font-size: 22px;
      font-weight: 900;
      margin-bottom: 2px;
      color: #fff;
    }

    .creator-handle {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--accent-cyan);
      margin-bottom: 12px;
    }

    .creator-quote {
      font-size: 16px;
      line-height: 1.6;
      color: var(--text-secondary);
      font-style: italic;
      margin-bottom: 16px;
      padding-left: 16px;
      border-left: 2px solid var(--accent-cyan);
    }

    .creator-byline {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    /* S7: EARLY ACCESS (100-SLOT DOT MATRIX) */
    .early-access-card {
      background: radial-gradient(circle at 50% 50%, #141B27 0%, #0D111A 100%);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 20px;
      padding: clamp(32px, 6vw, 56px);
      text-align: center;
      box-shadow: var(--glow-cyan);
    }

    .dot-matrix {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;
      max-width: 320px;
      margin: 28px auto;
    }

    .slot-dot {
      aspect-ratio: 1;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      transition: all 0.2s;
    }

    .slot-dot.claimed {
      background: var(--accent-cyan);
      box-shadow: 0 0 8px var(--accent-cyan);
      border-color: var(--accent-cyan);
    }

    /* S8: ROADMAP */
    .roadmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
    }

    .roadmap-card {
      background: var(--bg-surface-1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 28px;
      opacity: 0.85;
    }

    .roadmap-tag {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      color: var(--accent-amber);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .roadmap-title {
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .roadmap-desc {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    /* Footer */
    footer {
      background: #05070B;
      padding: 64px 0 32px;
      border-top: 1px solid rgba(0, 240, 255, 0.15);
      width: 100%;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 36px;
      margin-bottom: 48px;
    }

    .footer-col-h {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      color: var(--accent-cyan);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 16px;
    }

    .footer-links {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .footer-link {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      transition: color 0.15s;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
    }

    .footer-link:hover {
      color: var(--accent-cyan);
    }

    .footer-text {
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .credit-bar {
      text-align: center;
      padding-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
    }

    .credit-bar a {
      color: var(--accent-cyan);
      text-decoration: none;
      font-weight: 700;
    }

    .credit-bar a:hover {
      text-decoration: underline;
    }

    /* Responsive Queries */
    @media (max-width: 900px) {
      .nav-search {
        display: none;
      }
      .archetype-layout {
        grid-template-columns: 1fr;
      }
      .archetype-preview-card {
        position: static;
      }
      .creator-card {
        grid-template-columns: 1fr;
        text-align: center;
      }
      .creator-avatar {
        margin: 0 auto;
      }
      .creator-quote {
        padding-left: 0;
        border-left: none;
        border-top: 2px solid var(--accent-cyan);
        padding-top: 12px;
      }
    }

    @media (max-width: 640px) {
      .desktop-nav, .nav-search {
        display: none;
      }
      .nav-right .quota-pill {
        display: none;
      }
      .mobile-menu-btn {
        display: inline-flex;
      }
      .mobile-quota-row {
        display: flex;
        margin-top: 8px;
      }
      .mobile-quota-row .quota-pill {
        display: inline-flex;
        font-size: 10.5px;
        padding: 4px 10px;
      }
      .hero-section {
        padding-top: 24px;
        padding-bottom: 40px;
      }
      .hero-h1 {
        font-size: 26px;
        margin-bottom: 12px;
      }
      .url-morph-container {
        font-size: 11px;
        padding: 4px 12px;
        margin-bottom: 12px;
        gap: 6px;
      }
      .hero-subhead {
        font-size: 13.5px;
        line-height: 1.45;
        margin-bottom: 16px;
      }
      .hero-visual-pair {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 8px;
        margin-bottom: 20px;
        align-items: center;
      }
      .hero-egg-box, .hero-guardian-box {
        min-height: 130px;
        padding: 10px 6px;
        border-radius: 12px;
      }
      .pure-css-egg {
        width: 54px;
        height: 72px;
      }
      .hero-poster-img {
        width: 64px;
        height: 64px;
      }
      .visual-label {
        font-size: 9.5px;
        margin-top: 6px;
      }
      .hero-visual-arrow {
        font-size: 16px;
      }
      .hero-form {
        flex-direction: column;
        gap: 6px;
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
        margin-bottom: 10px;
      }
      .hero-prefix {
        display: none;
      }
      .hero-input {
        background: var(--bg-surface-1);
        border: 2px solid var(--accent-cyan);
        border-radius: 8px;
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
      }
      .hero-btn {
        width: 100%;
        padding: 12px;
        font-size: 13px;
      }
      .hero-helper {
        font-size: 11.5px;
        margin-bottom: 12px;
      }
      .determinism-box {
        flex-direction: column;
        text-align: center;
      }
      .scrubber-container {
        flex-direction: column;
        gap: 6px;
      }
      .pose-name-tag {
        min-width: 0;
        text-align: center;
      }
      .demo-stage {
        padding: 20px 16px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .landing16-player {
        animation: none !important;
        background-position: -3840px 0px !important;
      }
      .quota-dot {
        animation: none;
      }
    }
  </style>
</head>
<body>

  <!-- GLOBAL NAVBAR (Mounted in main.tsx) -->
  <header class="githoot-header">
    <div class="nav-inner">
      <div class="nav-brand-wrap">
        <a href="/" class="brand">
          <div class="brand-icon">🦉</div>
          <span>GitHoot</span>
        </a>
        <nav class="desktop-nav" aria-label="Desktop primary navigation">
          <ul class="nav-links">
            <li><a href="/" class="nav-link active">Home</a></li>
            <li><a href="/explore" class="nav-link">Explore</a></li>
            <li><a href="/design" class="nav-link">Design Studio</a></li>
            <li><a href="/docs" class="nav-link">Docs & Architecture</a></li>
          </ul>
        </nav>
      </div>

      <div class="nav-right">
        <div class="quota-pill" id="nav-quota-pill">
          <span class="quota-dot"></span>
          <span id="nav-quota-text">Early Access: 100/100 slots left</span>
        </div>

        <form class="nav-search" onsubmit="event.preventDefault(); handleLookup(document.getElementById('nav-input').value);">
          <label for="nav-input" class="sr-only">GitHub username for lookup</label>
          <input type="text" id="nav-input" placeholder="username..." aria-label="GitHub username for lookup">
          <button type="submit">Preview</button>
        </form>

        <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobile-nav-panel" onclick="toggleMobileMenu()">
          ☰
        </button>
      </div>
    </div>

    <!-- Persistent mobile quota row under brand (Contract S0) -->
    <div class="mobile-quota-row">
      <div class="quota-pill" id="mobile-persistent-quota">
        <span class="quota-dot"></span>
        <span>Early Access: 100/100 slots left</span>
      </div>
    </div>

    <!-- Mobile Drawer Disclosure Panel -->
    <div class="mobile-nav-panel" id="mobile-nav-panel">
      <nav aria-label="Mobile navigation">
        <ul class="mobile-nav-list">
          <li><a href="/" class="mobile-nav-link active" onclick="toggleMobileMenu(false)">Home</a></li>
          <li><a href="/explore" class="mobile-nav-link" onclick="toggleMobileMenu(false)">Explore Guardians</a></li>
          <li><a href="/design" class="mobile-nav-link" onclick="toggleMobileMenu(false)">Design Studio</a></li>
          <li><a href="/docs" class="mobile-nav-link" onclick="toggleMobileMenu(false)">Docs & Architecture</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main>

    <!-- S1: HERO -->
    <section class="hero-section">
      <div class="container">
        
        <div class="eyebrow">
          <span>✦</span>
          <span>PRE-LAUNCH · 100 FREE EARLY ACCESS SLOTS</span>
          <span>✦</span>
        </div>

        <h1 class="hero-h1">
          Your GitHub profile hatches a <br>
          <span class="gradient-text">Living Fantasy Guardian</span>
        </h1>

        <!-- Live URL Morph -->
        <div class="url-morph-container">
          <span class="url-from">github.com/<span class="hero-user-target">octocat</span></span>
          <span class="url-arrow">➔</span>
          <span class="url-to">githoot.com/<span class="hero-user-target">octocat</span></span>
        </div>

        <p class="hero-subhead">
          Change one word in any GitHub URL and that developer's identity becomes a persistent fantasy Guardian — hatched from an AI-crafted egg, derived from their account, theirs permanently. One GitHub account, one Guardian, no rerolls.
        </p>

        <!-- Preview Visual Pair: Pure CSS Egg ➔ Poster Still (Single above-fold image download) -->
        <div class="hero-visual-pair">
          <div class="hero-egg-box" id="hero-egg-box">
            <div class="pure-css-egg" id="hero-egg" onclick="triggerWobble(this)">
              <div class="crack"></div>
            </div>
            <span class="visual-label" id="hero-egg-label">Neon Byte Egg (CSS)</span>
          </div>

          <div class="hero-visual-arrow">➔</div>

          <div class="hero-guardian-box">
            <img src="landing-preview-assets/neonbyte-poster.webp" alt="Aether Neon Byte Hero Still" class="hero-poster-img" width="110" height="110" decoding="async">
            <span class="visual-label">Aether Neon Byte</span>
          </div>
        </div>

        <!-- Hero Form -->
        <form class="hero-form" onsubmit="event.preventDefault(); handleLookup(document.getElementById('hero-username').value);">
          <label for="hero-username" class="sr-only">GitHub username</label>
          <div class="hero-prefix">githoot.com/</div>
          <input type="text" id="hero-username" class="hero-input" placeholder="octocat" autocomplete="off" spellcheck="false" aria-label="GitHub username to preview">
          <button type="submit" class="hero-btn">Preview</button>
        </form>

        <p class="hero-helper">
          Free, no sign-in, nothing generated yet — you'll see the egg this profile would hatch.
        </p>

        <!-- Quick Dev Chips -->
        <div class="hero-chips">
          <span>Try one:</span>
          <a href="#" class="chip-link" onclick="event.preventDefault(); selectDev('octocat');">@octocat</a>
          <a href="#" class="chip-link" onclick="event.preventDefault(); selectDev('torvalds');">@torvalds</a>
          <a href="#" class="chip-link" onclick="event.preventDefault(); selectDev('yyx990803');">@yyx990803</a>
          <a href="#" class="chip-link" onclick="event.preventDefault(); selectDev('antirez');">@antirez</a>
          <a href="#" class="chip-link" onclick="event.preventDefault(); selectDev('rich-harris');">@rich-harris</a>
        </div>

      </div>
    </section>

    <!-- S2: SIGNATURE SEQUENCE DEMO -->
    <section class="demo-section" id="demo-section">
      <div class="container">
        <div class="section-head">
          <div class="eyebrow magenta">
            <span>✦</span>
            <span>SIGNATURE SEQUENCE</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">Watch a Guardian make landfall.</h2>
          <p class="section-desc">
            Sixteen frames, hover to hero stance. Aether Neon Byte comes down through the atmosphere, plants a three-point landing, and rises. Scrub it, slow it down, and look at every pose.
          </p>
        </div>

        <div class="demo-stage">
          <div class="sprite-viewport" id="sprite-viewport">
            <div class="landing16-player" id="landing-player"></div>
          </div>

          <div class="scrubber-container">
            <label for="frame-scrubber" class="sr-only">Superhero landing animation frame scrubber</label>
            <input type="range" min="1" max="16" value="16" class="scrubber-slider" id="frame-scrubber" oninput="scrubFrame(this.value)" aria-label="Superhero landing animation frame scrubber">
            <div class="pose-name-tag" id="pose-name-display">16 · hero_stance</div>
          </div>

          <div class="demo-controls">
            <button class="control-btn" id="btn-play" onclick="playSequence(1.1)">Play (1.1s)</button>
            <button class="control-btn" id="btn-slow" onclick="playSequence(4.4)">Slow-mo (4.4s)</button>
            <button class="control-btn" id="btn-pause" onclick="pauseSequence()">Reset (Hero Stance)</button>
          </div>

          <p class="demo-caption">Pre-generated sample — not your Guardian.</p>
        </div>
      </div>
    </section>

    <!-- S3: HOW IT WORKS -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">
            <span>✦</span>
            <span>HOW IT WORKS</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">How the hatch works.</h2>
          <p class="section-desc">
            Four transparent steps from public GitHub username to living companion.
          </p>
        </div>

        <div class="steps-grid">
          <div class="step-card">
            <div class="step-num">01</div>
            <h3 class="step-title">We look up the profile.</h3>
            <p class="step-desc">Your public GitHub profile resolves from an edge cache with a rotating token pool behind it, so lookups keep working when the GitHub API is throttled.</p>
          </div>

          <div class="step-card">
            <div class="step-num">02</div>
            <h3 class="step-title">You claim it with GitHub.</h3>
            <p class="step-desc">Sign in once to prove the account is yours. That reserves one Early Access slot and locks your Guardian to your GitHub numeric account id.</p>
          </div>

          <div class="step-card">
            <div class="step-num">03</div>
            <h3 class="step-title">Gemini crafts the sprite matrix.</h3>
            <p class="step-desc">One hero portrait plus a 4x2 pose matrix — idle, happy, sleepy, proud, angry, work, celebrate — contour-sliced, green background removed, stored on object storage.</p>
          </div>

          <div class="step-card">
            <div class="step-num">04</div>
            <h3 class="step-title">The egg cracks open.</h3>
            <p class="step-desc">A Gacha reveal, an animated Open Graph card, and an SVG badge you can drop into your README — one click to share on X or LinkedIn.</p>
          </div>
        </div>

        <div class="determinism-box">
          <div class="determinism-icon">🔒</div>
          <div>
            <h3 class="determinism-title">Your Guardian is derived, not rolled.</h3>
            <p class="determinism-desc">
              Archetype, rarity, markings, silhouette and temperament all come from a SHA-256 hash of your GitHub account id. Same account, same Guardian, every time. There is no reroll button, and there never will be.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- S4: ARCHETYPES & PUBLISHED ODDS -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="eyebrow amber">
            <span>✦</span>
            <span>EIGHT ELEMENTS</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">An element for every stack.</h2>
          <p class="section-desc">
            Fire for Rust and Go, cyber for TypeScript and the web, water for Python and AI, and five more. Eight archetypes, drawn entirely in pure CSS.
          </p>
        </div>

        <div class="archetype-layout">
          <!-- Active Archetype Showcase -->
          <div class="archetype-preview-card">
            <div class="pure-css-egg" id="arch-preview-egg" style="--egg-primary: #00F0FF; --egg-glow: rgba(0,240,255,0.45); width: 110px; height: 145px;">
              <div class="crack"></div>
            </div>
            <div style="margin-top: 20px;">
              <div class="mono" style="font-size: 11px; font-weight: 800; color: var(--accent-cyan);" id="arch-preview-element">CYBER / TYPESCRIPT & WEB</div>
              <h3 style="font-size: 20px; font-weight: 800; margin: 4px 0 8px;" id="arch-preview-name">Neon Byte Egg</h3>
              <p style="font-size: 13px; color: var(--text-secondary);" id="arch-preview-desc">Pulsing with holographic TypeScript and React frontend energy.</p>
            </div>
          </div>

          <!-- Archetypes Selector Grid (Semantic Tab Buttons) -->
          <div class="archetypes-grid" id="archetypes-grid" role="tablist" aria-label="Guardian archetype selection">
            <!-- Rendered dynamically by JS as <button> -->
          </div>
        </div>

        <!-- Published Odds -->
        <div class="odds-block">
          <div class="odds-title">
            <span>Published odds, stated up front.</span>
            <span class="eyebrow" style="margin-bottom: 0;">Fixed Genesis Distribution</span>
          </div>
          <div class="odds-grid">
            <div class="odds-card">
              <div class="odds-pct" style="color: var(--accent-green);">60%</div>
              <div class="odds-name">Common</div>
            </div>
            <div class="odds-card">
              <div class="odds-pct" style="color: var(--accent-cyan);">25%</div>
              <div class="odds-name">Rare</div>
            </div>
            <div class="odds-card">
              <div class="odds-pct" style="color: #7928CA;">10%</div>
              <div class="odds-name">Epic</div>
            </div>
            <div class="odds-card">
              <div class="odds-pct" style="color: var(--accent-magenta);">4%</div>
              <div class="odds-name">Legendary</div>
            </div>
            <div class="odds-card">
              <div class="odds-pct" style="color: #E2B340;">1%</div>
              <div class="odds-name">Mythic</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- S5: LAUNCH STATUS (TRUST) -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="eyebrow green">
            <span>✦</span>
            <span>LAUNCH STATUS</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">Where GitHoot actually stands today.</h2>
          <p class="section-desc">
            GitHoot has not launched. Nobody has hatched a Guardian yet, and we are not going to print invented numbers to make this page look busier than the product is. Here is every number we can honestly show.
          </p>
        </div>

        <div class="table-wrapper">
          <table class="trust-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Status at Launch</th>
                <th>Data Source & Semantics</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Early Access Slots</td>
                <td><span class="trust-val">100 / 100 Free</span></td>
                <td>D1 Database query (<code>early_access_slots</code>). Claimed slots only.</td>
              </tr>
              <tr>
                <td>Guardians Hatched</td>
                <td><span class="trust-badge">None yet (0)</span></td>
                <td>Will reflect live completed Gacha reveals once claimed.</td>
              </tr>
              <tr>
                <td>Developers with Guardian</td>
                <td><span class="trust-badge">None yet (0)</span></td>
                <td>Unique GitHub accounts with claimed guardians in D1.</td>
              </tr>
              <tr>
                <td>Page Visits</td>
                <td><span class="trust-badge">Not measured yet</span></td>
                <td>No analytics tracking key configured. Zero tracking cookies.</td>
              </tr>
              <tr>
                <td>Edge Profile Latency</td>
                <td><span class="trust-val">&lt; 150ms P95</span> <span class="mono" style="font-size: 11px; color: var(--text-muted);">(Design Target)</span></td>
                <td>Cloudflare Workers + KV Cache SWR architecture goal.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- S6: CREATOR -->
    <section>
      <div class="container">
        <div class="creator-card">
          <img src="landing-preview-assets/zuey-avatar-96.webp" alt="Zuey Avatar" class="creator-avatar" width="96" height="96" loading="lazy" decoding="async">
          <div>
            <div class="eyebrow" style="margin-bottom: 8px;">CREATOR ATTRIBUTION</div>
            <h3 class="creator-name">Zuey</h3>
            <div class="creator-handle">@goon_nguyen</div>
            <blockquote class="creator-quote">
              "I wanted the thing developers already share — their GitHub profile — to be worth looking at twice. A Guardian you didn't choose, that came out of your own account and stays yours, is a better souvenir than a follower count."
            </blockquote>
            <p class="creator-byline">
              From the creator of <a href="https://agentkit.best" target="_blank" rel="noopener" style="color: var(--accent-cyan); text-decoration: none; font-weight: 700;">AgentKit.best</a>, NextLevelBuilder.io, GoClaw.sh & <a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill" target="_blank" rel="noopener" style="color: var(--accent-cyan); text-decoration: none; font-weight: 700;">UI UX Pro Max Skill</a>.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- S7: EARLY ACCESS & 100-SLOT MATRIX -->
    <section>
      <div class="container">
        <div class="early-access-card">
          <div class="eyebrow amber">
            <span>✦</span>
            <span>GENESIS COHORT</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">The first 100 developers hatch free.</h2>
          <p class="section-desc" style="max-width: 600px; margin: 0 auto;">
            One hundred free slots, one per GitHub account. After slot 100, a hatch costs $0.99 — that covers the Gemini model call, nothing more. We would rather tell you the price now than surprise you at the reveal.
          </p>

          <!-- 10x10 Dot Matrix -->
          <div class="dot-matrix" id="genesis-dot-matrix">
            <!-- 100 dots rendered dynamically -->
          </div>

          <form class="hero-form" style="margin: 0 auto 16px;" onsubmit="event.preventDefault(); handleLookup(document.getElementById('ea-username').value);">
            <label for="ea-username" class="sr-only">GitHub username for Early Access</label>
            <div class="hero-prefix">githoot.com/</div>
            <input type="text" id="ea-username" class="hero-input" placeholder="octocat" aria-label="GitHub username for Early Access">
            <button type="submit" class="hero-btn">Preview</button>
          </form>

          <p class="hero-helper" style="margin-bottom: 0;">
            Previewing is always free and never signs you in.
          </p>
        </div>
      </div>
    </section>

    <!-- S8: ROADMAP -->
    <section>
      <div class="container">
        <div class="section-head">
          <div class="eyebrow">
            <span>✦</span>
            <span>FUTURE HORIZONS</span>
            <span>✦</span>
          </div>
          <h2 class="section-title">After the hatch.</h2>
          <p class="section-desc">
            Not in the first release — but this is the long-term direction of the companion network.
          </p>
        </div>

        <div class="roadmap-grid">
          <div class="roadmap-card">
            <div class="roadmap-tag">Phase 9 · Narrative Vision</div>
            <h3 class="roadmap-title">Evolution & Legacy Forms</h3>
            <p class="roadmap-desc">Guardians that evolve alongside commit milestones and project longevity, leaving behind immutable legacy badges.</p>
          </div>

          <div class="roadmap-card">
            <div class="roadmap-tag">Phase 10 · Narrative Vision</div>
            <h3 class="roadmap-title">Discovery Arena</h3>
            <p class="roadmap-desc">A deterministic auto-battler and social spotlighting surface where developers discover each other through companion encounters.</p>
          </div>

          <div class="roadmap-card">
            <div class="roadmap-tag">Phase 11 · Narrative Vision</div>
            <h3 class="roadmap-title">Creator Ecosystem</h3>
            <p class="roadmap-desc">Community organizations and artists designing seasonal companion archetypes and verified repository raids.</p>
          </div>
        </div>
      </div>
    </section>

  </main>

  <!-- GLOBAL FOOTER -->
  <footer>
    <div class="container">
      <div class="footer-grid">
        
        <!-- Col 1: GitHoot -->
        <div>
          <div class="footer-col-h">GitHoot</div>
          <ul class="footer-links">
            <li><a href="/" class="footer-link">Home</a></li>
            <li><a href="/explore" class="footer-link">Explore Guardians</a></li>
            <li><a href="/design" class="footer-link">Design Studio</a></li>
            <li><a href="/docs" class="footer-link">Docs & Architecture</a></li>
          </ul>
        </div>

        <!-- Col 2: For Developers -->
        <div>
          <div class="footer-col-h">For Developers</div>
          <ul class="footer-links">
            <li><a href="/design.html" class="footer-link">Design System Overview <span class="mono" style="font-size: 10px; color: var(--text-muted);">(large static page)</span></a></li>
            <li><a href="/health" class="footer-link">Service Health</a></li>
            <li><a href="/octocat" class="footer-link">Example Profile (@octocat)</a></li>
            <li><a href="/badge/octocat.svg" class="footer-link">README Badge (Example)</a></li>
            <li><a href="/og/octocat.png" class="footer-link">Share Card (Example)</a></li>
          </ul>
        </div>

        <!-- Col 3: From the Creator -->
        <div>
          <div class="footer-col-h">From the Creator</div>
          <ul class="footer-links">
            <li><a href="https://agentkit.best" target="_blank" rel="noopener" class="footer-link">AgentKit.best</a></li>
            <li><a href="https://nextlevelbuilder.io" target="_blank" rel="noopener" class="footer-link">NextLevelBuilder.io</a></li>
            <li><a href="https://goclaw.sh" target="_blank" rel="noopener" class="footer-link">GoClaw.sh</a></li>
            <li><a href="https://github.com/nextlevelbuilder/ui-ux-pro-max-skill" target="_blank" rel="noopener" class="footer-link">UI UX Pro Max Skill</a></li>
            <li><a href="https://github.com/bestagentkits/githatch" target="_blank" rel="noopener" class="footer-link">Source on GitHub</a></li>
          </ul>
        </div>

        <!-- Col 4: Status -->
        <div>
          <div class="footer-col-h">Status & Privacy</div>
          <p class="footer-text" style="margin-bottom: 8px;">
            Pre-launch. No Guardians hatched yet.
          </p>
          <p class="footer-text" style="margin-bottom: 8px;">
            Early Access: 100/100 slots left.
          </p>
          <p class="footer-text">
            No analytics key configured — this page sets no tracking cookies and contacts no telemetry hosts.
          </p>
        </div>

      </div>

      <div class="credit-bar">
        Made with ❤️ by <a href="https://agentkit.best" target="_blank" rel="noopener">AgentKit.best</a>
      </div>
    </div>
  </footer>

  <!-- Interactive Client Script -->
  <script>
    const MANIFEST = [
      { id: 'neon-byte', name: 'Neon Byte Egg', element: 'CYBER / TYPESCRIPT & WEB', color: '#00F0FF', glow: 'rgba(0,240,255,0.45)', desc: 'Pulsing with holographic TypeScript and React frontend energy.' },
      { id: 'ember-core', name: 'Ember Core Egg', element: 'FIRE / RUST & GO', color: '#FF4500', glow: 'rgba(255,69,0,0.45)', desc: 'Forged in high-performance Rust and Go compiler flames.' },
      { id: 'abyssal-pearl', name: 'Abyssal Pearl Egg', element: 'WATER / PYTHON & AI', color: '#0070F3', glow: 'rgba(0,112,243,0.45)', desc: 'Infused with deep learning neural networks and Python data pipelines.' },
      { id: 'verdant-spore', name: 'Verdant Spore Egg', element: 'NATURE / OPEN SOURCE', color: '#00DF71', glow: 'rgba(0,223,113,0.45)', desc: 'Rooted in enduring open-source maintenance and community care.' },
      { id: 'solar-flare', name: 'Solar Flare Egg', element: 'LIGHT / VELOCITY SHIPPER', color: '#F5A623', glow: 'rgba(245,166,35,0.45)', desc: 'Blazing with high-velocity product shipping and bold execution.' },
      { id: 'void-shard', name: 'Void Shard Egg', element: 'VOID / SECURITY & DEVOPS', color: '#7928CA', glow: 'rgba(121,40,202,0.45)', desc: 'Shrouded in mysterious kernel architecture and security exploits.' },
      { id: 'rust-dynamo', name: 'Rust Dynamo Egg', element: 'MECH / LOW-LEVEL C/C++', color: '#A0AEC0', glow: 'rgba(160,174,192,0.45)', desc: 'Armored in zero-cost abstractions and memory-safe mechanisms.' },
      { id: 'celestial-echo', name: 'Celestial Echo Egg', element: 'MYTHIC / 10X POLYGLOT', color: '#E2B340', glow: 'rgba(226,179,64,0.45)', desc: 'Radiating rare polyglot mastery across every domain layer.' }
    ];

    const POSES = [
      '01 · hover', '02 · dive_start', '03 · dive_steep', '04 · plunge',
      '05 · approach', '06 · pre_impact', '07 · three_point_landing', '08 · impact_crouch',
      '09 · shockwave', '10 · recoil', '11 · rise_knee', '12 · rise_aura',
      '13 · stand_up', '14 · aura_flare', '15 · settle', '16 · hero_stance'
    ];

    // Mobile Drawer Navigation Toggle
    function toggleMobileMenu(forceState) {
      const btn = document.getElementById('mobile-menu-btn');
      const panel = document.getElementById('mobile-nav-panel');
      const isOpen = forceState !== undefined ? forceState : !panel.classList.contains('open');
      
      panel.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.textContent = isOpen ? '✕' : '☰';
    }

    // Initialize 8-Archetypes Grid as Accessible Buttons (<button type="button" role="tab">)
    const archGrid = document.getElementById('archetypes-grid');
    MANIFEST.forEach((arch, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'arch-card' + (idx === 0 ? ' active' : '');
      card.setAttribute('role', 'tab');
      card.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      card.setAttribute('aria-label', arch.name + ' — ' + arch.element);
      card.style.setProperty('--card-color', arch.color);
      card.style.setProperty('--card-glow', arch.glow);
      card.innerHTML = \`
        <span class="arch-element">\${arch.element}</span>
        <span class="arch-name">\${arch.name}</span>
        <span class="arch-desc">\${arch.desc}</span>
      \`;
      card.onclick = () => selectArchetype(arch, card);
      archGrid.appendChild(card);
    });

    function selectArchetype(arch, cardEl) {
      document.querySelectorAll('.arch-card').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      if (cardEl) {
        cardEl.classList.add('active');
        cardEl.setAttribute('aria-selected', 'true');
      }

      const previewEgg = document.getElementById('arch-preview-egg');
      previewEgg.style.setProperty('--egg-primary', arch.color);
      previewEgg.style.setProperty('--egg-glow', arch.glow);

      document.getElementById('arch-preview-name').textContent = arch.name;
      document.getElementById('arch-preview-element').textContent = arch.element;
      document.getElementById('arch-preview-desc').textContent = arch.desc;

      // Update hero egg color too!
      const heroEgg = document.getElementById('hero-egg');
      heroEgg.style.setProperty('--egg-primary', arch.color);
      heroEgg.style.setProperty('--egg-glow', arch.glow);
      document.getElementById('hero-egg-label').textContent = arch.name + ' (CSS)';
    }

    // Initialize 100 Genesis Dot Matrix
    const dotMatrix = document.getElementById('genesis-dot-matrix');
    for (let i = 0; i < 100; i++) {
      const dot = document.createElement('div');
      dot.className = 'slot-dot';
      dot.title = 'Genesis Slot #' + (i + 1) + ' (Available)';
      dotMatrix.appendChild(dot);
    }

    // 16-Pose Player Controls & Lazy Intersection Loading
    const player = document.getElementById('landing-player');
    const scrubber = document.getElementById('frame-scrubber');
    const poseDisplay = document.getElementById('pose-name-display');
    const btnPlay = document.getElementById('btn-play');
    const btnSlow = document.getElementById('btn-slow');
    const btnPause = document.getElementById('btn-pause');
    const demoSection = document.getElementById('demo-section');

    let isStripLoaded = false;

    // IntersectionObserver: Load the 286 KB strip only when demo section is in view
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !isStripLoaded) {
            isStripLoaded = true;
            player.style.backgroundImage = "url('landing-preview-assets/neonbyte-landing16-strip.webp')";
            observer.disconnect();
          }
        });
      }, { rootMargin: '200px' });
      observer.observe(demoSection);
    } else {
      player.style.backgroundImage = "url('landing-preview-assets/neonbyte-landing16-strip.webp')";
    }

    function playSequence(duration) {
      if (!isStripLoaded) {
        player.style.backgroundImage = "url('landing-preview-assets/neonbyte-landing16-strip.webp')";
        isStripLoaded = true;
      }
      player.classList.remove('playing', 'slowmo');
      void player.offsetWidth; // trigger reflow
      
      btnPlay.classList.toggle('active', duration === 1.1);
      btnSlow.classList.toggle('active', duration === 4.4);
      btnPause.classList.remove('active');

      if (duration === 1.1) {
        player.classList.add('playing');
      } else {
        player.classList.add('slowmo');
      }

      // Update scrubber & pose display when animation completes
      setTimeout(() => {
        scrubber.value = 16;
        poseDisplay.textContent = POSES[15];
      }, duration * 1000);
    }

    function pauseSequence() {
      player.classList.remove('playing', 'slowmo');
      btnPlay.classList.remove('active');
      btnSlow.classList.remove('active');
      btnPause.classList.add('active');
      scrubFrame(16);
      scrubber.value = 16;
    }

    function scrubFrame(val) {
      if (!isStripLoaded) {
        player.style.backgroundImage = "url('landing-preview-assets/neonbyte-landing16-strip.webp')";
        isStripLoaded = true;
      }
      player.classList.remove('playing', 'slowmo');
      btnPlay.classList.remove('active');
      btnSlow.classList.remove('active');
      
      const frameIdx = parseInt(val, 10) - 1;
      const offset = -(frameIdx * 256);
      player.style.backgroundPosition = offset + 'px 0px';
      poseDisplay.textContent = POSES[frameIdx];
    }

    function triggerWobble(eggEl) {
      eggEl.style.transform = 'scale(1.1) rotate(10deg)';
      setTimeout(() => {
        eggEl.style.transform = 'scale(1) rotate(-8deg)';
        setTimeout(() => { eggEl.style.transform = 'scale(1) rotate(0deg)'; }, 150);
      }, 150);
    }

    function selectDev(username) {
      document.getElementById('hero-username').value = username;
      document.querySelectorAll('.hero-user-target').forEach(el => el.textContent = username);
    }

    function handleLookup(username) {
      const clean = (username || '').trim().replace(/^@/, '');
      if (clean) {
        window.location.href = '/' + encodeURIComponent(clean);
      }
    }

    document.getElementById('hero-username').addEventListener('input', function(e) {
      const v = e.target.value.trim() || 'octocat';
      document.querySelectorAll('.hero-user-target').forEach(el => el.textContent = v);
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('Website preview generated: ' + OUT);
console.log('Byte size: ' + Buffer.byteLength(html, 'utf8') + ' bytes');
