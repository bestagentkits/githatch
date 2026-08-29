const fs = require('fs');
const path = require('path');

const samplePetsDir = path.join(__dirname, '..', 'assets', 'sample-pets');
const pets = ['emberfox', 'neonbyte', 'abyssal', 'verdant'];
const petImages = {};

for (const pet of pets) {
  const p = path.join(samplePetsDir, `${pet}.jpg`);
  if (fs.existsSync(p)) {
    const data = fs.readFileSync(p);
    petImages[pet] = `data:image/jpeg;base64,${data.toString('base64')}`;
  }
}

const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="cyber">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHoot.com - Design System, Screen Mockups & Interactive Spritesheet Showcase</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=JetBrains+Mono:wght@400;500;700&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Schibsted+Grotesk:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet">
  <style>
    /* ==========================================================================
       1. CSS DESIGN SYSTEMS & THEMES
       ========================================================================== */
    :root {
      --sp-1: 4px;
      --sp-2: 8px;
      --sp-3: 12px;
      --sp-4: 16px;
      --sp-6: 24px;
      --sp-8: 32px;
      --sp-12: 48px;
      --sp-16: 64px;
      --sp-24: 96px;

      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
      --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    /* THEME 1: CYBER-ARCADE / DARK TERMINAL FANTASY (Default) */
    html[data-theme="cyber"] {
      --font-display: 'Archivo', sans-serif;
      --font-body: 'Schibsted Grotesk', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      --bg-base: #07090e;
      --bg-surface-1: #0d111a;
      --bg-surface-2: #141b27;
      --bg-surface-3: #1c2637;
      
      --border-subtle: rgba(0, 240, 255, 0.12);
      --border-strong: rgba(0, 240, 255, 0.35);
      
      --text-primary: #f0f6fc;
      --text-secondary: #8b9bb4;
      --text-muted: #53627a;

      --accent-cyan: #00f0ff;
      --accent-magenta: #ff2a85;
      --accent-amber: #ffa800;
      --accent-green: #00ff88;
      --accent-primary: var(--accent-cyan);

      --glow-cyan: 0 0 24px rgba(0, 240, 255, 0.35);
      --glow-magenta: 0 0 24px rgba(255, 42, 133, 0.35);
      
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 9999px;
      
      --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border-subtle);
    }

    /* THEME 2: RETRO PIXEL / GACHA TAMAGOTCHI */
    html[data-theme="pixel"] {
      --font-display: 'Silkscreen', cursive;
      --font-body: 'Bricolage Grotesque', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      --bg-base: #181425;
      --bg-surface-1: #26203a;
      --bg-surface-2: #392f52;
      --bg-surface-3: #4d3f6d;
      
      --border-subtle: #5a497d;
      --border-strong: #ffcd75;
      
      --text-primary: #fee761;
      --text-secondary: #fef1b8;
      --text-muted: #9b8ebb;

      --accent-cyan: #63c74d;
      --accent-magenta: #ff0044;
      --accent-amber: #feae34;
      --accent-green: #38b764;
      --accent-primary: #feae34;

      --glow-cyan: none;
      --glow-magenta: none;
      
      --radius-sm: 0px;
      --radius-md: 0px;
      --radius-lg: 4px;
      --radius-full: 0px;
      
      --card-shadow: 4px 4px 0px #000000;
    }

    /* THEME 3: MINIMAL EDITORIAL / PRESTIGE */
    html[data-theme="editorial"] {
      --font-display: 'Schibsted Grotesk', sans-serif;
      --font-body: 'Schibsted Grotesk', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;

      --bg-base: #0a0b0d;
      --bg-surface-1: #12141a;
      --bg-surface-2: #1a1e27;
      --bg-surface-3: #242a36;
      
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.2);
      
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;

      --accent-cyan: #38bdf8;
      --accent-magenta: #f43f5e;
      --accent-amber: #fbbf24;
      --accent-green: #34d399;
      --accent-primary: #f43f5e;

      --glow-cyan: none;
      --glow-magenta: none;
      
      --radius-sm: 2px;
      --radius-md: 6px;
      --radius-lg: 10px;
      --radius-full: 9999px;
      
      --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-subtle);
    }

    /* Global Resets */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 15px;
      line-height: 1.6;
      overflow-x: hidden;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    /* Layout Utilities */
    .container {
      max-width: 1360px;
      margin: 0 auto;
      padding: 0 var(--sp-6);
    }
    
    /* Navigation Bar */
    header.site-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(7, 9, 14, 0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      padding: var(--sp-4) 0;
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-4);
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: var(--text-primary);
      text-decoration: none;
    }
    .brand-logo .owl-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta));
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: var(--glow-cyan);
    }
    .header-nav {
      display: flex;
      align-items: center;
      gap: var(--sp-6);
    }
    .header-nav a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: color 0.2s;
    }
    .header-nav a:hover {
      color: var(--accent-primary);
    }
    .theme-selector {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      background: var(--bg-surface-2);
      padding: 4px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-subtle);
    }
    .theme-btn {
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: var(--radius-full);
      cursor: pointer;
      transition: all 0.2s;
    }
    .theme-btn.active {
      background: var(--accent-primary);
      color: #000;
    }

    /* Section Styles */
    section.doc-section {
      padding: var(--sp-16) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .section-eyebrow {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--accent-cyan);
      margin-bottom: var(--sp-2);
    }
    .section-title {
      font-family: var(--font-display);
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: var(--sp-3);
    }
    .section-desc {
      color: var(--text-secondary);
      font-size: 16px;
      max-width: 780px;
      margin-bottom: var(--sp-12);
    }

    /* Section 1: Design Systems Cards */
    .theme-compare-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: var(--sp-6);
      margin-bottom: var(--sp-12);
    }
    .theme-card {
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-6);
      transition: transform 0.2s, border-color 0.2s;
      box-shadow: var(--card-shadow);
      position: relative;
    }
    .theme-card.recommended {
      border-color: var(--accent-cyan);
      box-shadow: var(--glow-cyan);
    }
    .theme-badge {
      position: absolute;
      top: -12px;
      right: var(--sp-6);
      background: var(--accent-cyan);
      color: #000;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      padding: 2px 10px;
      border-radius: var(--radius-full);
    }
    .theme-card h3 {
      font-family: var(--font-display);
      font-size: 20px;
      margin-bottom: var(--sp-2);
    }
    .palette-swatches {
      display: flex;
      gap: var(--sp-2);
      margin: var(--sp-4) 0;
    }
    .swatch {
      height: 36px;
      flex: 1;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: flex-end;
      padding: 4px;
      font-family: var(--font-mono);
      font-size: 9px;
      font-weight: 700;
    }

    /* Section 2: Interactive Simulator */
    .simulator-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-8);
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-8);
      box-shadow: var(--card-shadow);
    }
    @media (max-width: 960px) {
      .simulator-container { grid-template-columns: 1fr; }
    }
    .sim-panel {
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
    }
    .canvas-stage {
      background: radial-gradient(circle at center, var(--bg-surface-2) 0%, var(--bg-surface-3) 100%);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      height: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .egg-graphic {
      width: 160px;
      height: 210px;
      background: radial-gradient(circle at 35% 35%, #00f0ff, #004488 70%, #001122);
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      box-shadow: 0 0 40px rgba(0, 240, 255, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: transform 0.15s var(--ease-spring);
      position: relative;
    }
    .egg-graphic:hover {
      transform: scale(1.05);
    }
    .egg-graphic.wobble {
      animation: eggWobble 0.6s infinite ease-in-out;
    }
    .egg-graphic.crack {
      animation: eggCrack 0.4s infinite ease-in-out;
    }
    .egg-graphic.hatch {
      animation: eggHatch 0.8s forwards ease-out;
    }
    @keyframes eggWobble {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-12deg) scale(1.02); }
      75% { transform: rotate(12deg) scale(1.02); }
    }
    @keyframes eggCrack {
      0%, 100% { transform: rotate(0deg) scale(1); }
      20% { transform: rotate(-8deg) scale(1.08); filter: brightness(1.4); }
      40% { transform: rotate(8deg) scale(1.08); }
      60% { transform: rotate(-5deg) scale(1.12); filter: brightness(1.8); }
      80% { transform: rotate(5deg) scale(1.15); }
    }
    @keyframes eggHatch {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.5); filter: brightness(3); opacity: 0.9; }
      100% { transform: scale(2); filter: brightness(5); opacity: 0; }
    }

    .sim-controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 700;
      padding: 10px 20px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
      text-decoration: none;
    }
    .btn-primary {
      background: var(--accent-cyan);
      color: #000;
      box-shadow: var(--glow-cyan);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 0 32px var(--accent-cyan);
    }
    .btn-secondary {
      background: var(--bg-surface-2);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }
    .btn-secondary:hover {
      background: var(--bg-surface-3);
      border-color: var(--border-strong);
    }
    .btn-magenta {
      background: var(--accent-magenta);
      color: #fff;
      box-shadow: var(--glow-magenta);
    }

    /* Live Pet Viewer */
    .pet-gallery {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .pet-thumb {
      border: 2px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 4px;
      background: var(--bg-surface-2);
      cursor: pointer;
      transition: all 0.2s;
    }
    .pet-thumb.active {
      border-color: var(--accent-cyan);
      box-shadow: var(--glow-cyan);
    }
    .pet-thumb img {
      width: 100%;
      aspect-ratio: 1/1;
      object-fit: cover;
      border-radius: var(--radius-sm);
    }
    .pet-thumb-name {
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      text-align: center;
      margin-top: 4px;
      color: var(--text-secondary);
    }

    /* Section 3: Screen Mockups with Annotations */
    .mockup-wrapper {
      margin-bottom: var(--sp-16);
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-8);
      position: relative;
    }
    .mockup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--sp-6);
      padding-bottom: var(--sp-4);
      border-bottom: 1px solid var(--border-subtle);
    }
    .mockup-header h3 {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 800;
    }
    .mockup-screen {
      background: #040508;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-md);
      padding: var(--sp-8);
      min-height: 520px;
      position: relative;
      overflow: hidden;
    }
    
    /* Mockup Annotation Callouts */
    .annotation-pin {
      position: absolute;
      width: 28px;
      height: 28px;
      background: var(--accent-magenta);
      color: #fff;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 900;
      box-shadow: var(--glow-magenta);
      cursor: pointer;
      z-index: 50;
      transition: transform 0.2s;
    }
    .annotation-pin:hover {
      transform: scale(1.25);
    }
    .annotation-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--sp-4);
      margin-top: var(--sp-6);
      background: var(--bg-surface-2);
      padding: var(--sp-6);
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }
    .annotation-item {
      display: flex;
      gap: var(--sp-3);
      font-size: 13px;
    }
    .annotation-num {
      width: 22px;
      height: 22px;
      background: var(--accent-magenta);
      color: #fff;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }

    /* Mockup UI Elements */
    .mockup-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--sp-8);
      padding-bottom: var(--sp-4);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .early-access-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid var(--accent-cyan);
      color: var(--accent-cyan);
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-cyan);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--accent-cyan);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Profile UI Mockup Grid */
    .profile-hero-grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: var(--sp-8);
      align-items: center;
    }
    @media (max-width: 800px) {
      .profile-hero-grid { grid-template-columns: 1fr; }
    }
    .profile-card-dev {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-6);
    }
    .dev-avatar-row {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .dev-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid var(--accent-cyan);
      background: #1e293b;
    }
    .dev-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .dev-stat-box {
      background: var(--bg-surface-1);
      padding: var(--sp-3);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255,255,255,0.05);
    }
    .dev-stat-val {
      font-family: var(--font-mono);
      font-size: 18px;
      font-weight: 800;
      color: var(--accent-cyan);
    }
    .dev-stat-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    /* Section 4: Diagrams */
    .diagram-container {
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--sp-8);
      margin-bottom: var(--sp-8);
      overflow-x: auto;
    }
    .diagram-svg {
      width: 100%;
      min-width: 780px;
      height: auto;
    }

    /* Footer */
    footer.site-footer {
      padding: var(--sp-12) 0;
      border-top: 1px solid var(--border-subtle);
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
      font-family: var(--font-mono);
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header class="site-header">
    <div class="container header-inner">
      <a href="#" class="brand-logo">
        <div class="owl-icon">🦉</div>
        <span>GitHoot.com</span>
      </a>
      <nav class="header-nav">
        <a href="#systems">Design Systems</a>
        <a href="#simulator">Live Spritesheet Simulator</a>
        <a href="#mockups">Screen Mockups</a>
        <a href="#diagrams">Architecture & Diagrams</a>
      </nav>
      <div class="theme-selector">
        <button class="theme-btn active" onclick="setTheme(event, 'cyber')">Cyber (Default)</button>
        <button class="theme-btn" onclick="setTheme(event, 'pixel')">Pixel 8-Bit</button>
        <button class="theme-btn" onclick="setTheme(event, 'editorial')">Editorial</button>
      </div>
    </div>
  </header>

  <!-- HERO BANNER -->
  <section class="doc-section" style="padding-top: var(--sp-12);">
    <div class="container">
      <div class="section-eyebrow">Project Overview & Frontend Architecture</div>
      <h1 class="section-title">GitHoot: Gamified Developer Identity & Viral Gacha Hatch</h1>
      <p class="section-desc">
        Bản thiết kế giao diện toàn diện, hệ thống Design Systems (3 options), mô hình màn hình (Mockups có Annotations), sơ đồ kiến trúc Edge-first và trình mô phỏng tương tác Spritesheet sinh ra từ mô hình AI <strong>Gemini Nano Banana 2</strong>.
      </p>
    </div>
  </section>

  <!-- SECTION 1: 3 DESIGN SYSTEM OPTIONS -->
  <section id="systems" class="doc-section">
    <div class="container">
      <div class="section-eyebrow">Aesthetic Exploration</div>
      <h2 class="section-title">3 Tùy Chọn Phong Cách Thiết Kế (Design Systems)</h2>
      <p class="section-desc">
        So sánh chi tiết 3 hướng tiếp cận mỹ thuật cho GitHoot. Tùy chọn 1 (Cyber-Arcade Fantasy) được đề xuất là hướng đi chính vì tính hiện đại, thu hút dev và kích thích viral mạng xã hội.
      </p>

      <div class="theme-compare-grid">
        <!-- Option 1 -->
        <div class="theme-card recommended">
          <div class="theme-badge">RECOMMENDED (CHỌN)</div>
          <h3>Option 1: Cyber-Arcade Fantasy</h3>
          <p style="font-size: 13px; color: var(--text-secondary);">
            Nền đen sâu vũ trụ kết hợp ánh sáng Neon Cyan, Hot Magenta và Amber. Thẻ bo góc sắc sảo, đường viền phát sáng 1px, typography hiện đại (Archivo + JetBrains Mono).
          </p>
          <div class="palette-swatches">
            <div class="swatch" style="background: #07090e; color: #fff;">#07090E</div>
            <div class="swatch" style="background: #00f0ff; color: #000;">#00F0FF</div>
            <div class="swatch" style="background: #ff2a85; color: #fff;">#FF2A85</div>
            <div class="swatch" style="background: #ffa800; color: #000;">#FFA800</div>
          </div>
          <button class="btn btn-primary" style="width: 100%; margin-top: var(--sp-4);" onclick="setTheme(event, 'cyber')">Áp dụng Theme này</button>
        </div>

        <!-- Option 2 -->
        <div class="theme-card">
          <h3>Option 2: Retro Pixel / Tamagotchi</h3>
          <p style="font-size: 13px; color: var(--text-secondary);">
            Phong cách GameBoy / Tamagotchi hoài niệm những năm 90s. Nền tím sẫm, màu vàng chanh, nút 3D chunky đổ bóng cứng 4px 4px, font Silkscreen + Bricolage.
          </p>
          <div class="palette-swatches">
            <div class="swatch" style="background: #181425; color: #fff;">#181425</div>
            <div class="swatch" style="background: #fee761; color: #000;">#FEE761</div>
            <div class="swatch" style="background: #ff0044; color: #fff;">#FF0044</div>
            <div class="swatch" style="background: #63c74d; color: #000;">#63C74D</div>
          </div>
          <button class="btn btn-secondary" style="width: 100%; margin-top: var(--sp-4);" onclick="setTheme(event, 'pixel')">Áp dụng Theme này</button>
        </div>

        <!-- Option 3 -->
        <div class="theme-card">
          <h3>Option 3: Minimal Editorial Prestige</h3>
          <p style="font-size: 13px; color: var(--text-secondary);">
            Phong cách Tạp chí Kỹ thuật (Linear / Vercel style). Nền xám kim loại tối giản, điểm xuyết màu Crimson Rose và Sky Blue, đường kẻ hairline 1px, typography Schibsted Grotesk.
          </p>
          <div class="palette-swatches">
            <div class="swatch" style="background: #0a0b0d; color: #fff;">#0A0B0D</div>
            <div class="swatch" style="background: #ffffff; color: #000;">#FFFFFF</div>
            <div class="swatch" style="background: #f43f5e; color: #fff;">#F43F5E</div>
            <div class="swatch" style="background: #38bdf8; color: #000;">#38BDF8</div>
          </div>
          <button class="btn btn-secondary" style="width: 100%; margin-top: var(--sp-4);" onclick="setTheme(event, 'editorial')">Áp dụng Theme này</button>
        </div>
      </div>
    </div>
  </section>

  <!-- SECTION 2: LIVE SIMULATOR -->
  <section id="simulator" class="doc-section">
    <div class="container">
      <div class="section-eyebrow">Interactive Canvas & AI Assets</div>
      <h2 class="section-title">Trình Mô Phỏng Hoạt Ảnh Trứng & Linh Thú (Live Simulator)</h2>
      <p class="section-desc">
        Trải nghiệm trực tiếp tương tác lắc/vỡ trứng (Egg Wobble & Crack) kèm âm thanh mô phỏng, cùng 4 mẫu Linh thú thực tế được sinh từ <strong>Gemini Nano Banana 2</strong> với bộ điều khiển biểu cảm (Idle, Happy, Sleepy, Proud, Angry, Work, Celebrate).
      </p>

      <div class="simulator-container">
        <!-- Panel 1: Egg Simulator -->
        <div class="sim-panel">
          <h3 style="font-family: var(--font-display); font-size: 20px;">1. Mô phỏng Mở Trứng (Interactive Egg)</h3>
          <div class="canvas-stage" id="eggStage">
            <div class="egg-graphic" id="interactiveEgg" onclick="handleEggClick()"></div>
            <div id="eggStatusText" style="margin-top: var(--sp-4); font-family: var(--font-mono); font-size: 12px; color: var(--accent-cyan);">
              👉 Click vào trứng để lắc (Wobble) hoặc bấm nút Mở trứng
            </div>
          </div>
          <div class="sim-controls">
            <button class="btn btn-secondary" onclick="setEggState('idle')">Chế độ: Idle</button>
            <button class="btn btn-secondary" onclick="setEggState('wobble')">Chế độ: Wobble (Lắc)</button>
            <button class="btn btn-secondary" onclick="setEggState('crack')">Chế độ: Crack (Nứt)</button>
            <button class="btn btn-magenta" onclick="triggerHatchSequence()">💥 Kích hoạt Mở Trứng (Hatch)</button>
          </div>
        </div>

        <!-- Panel 2: Pet Spritesheet Viewer -->
        <div class="sim-panel">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-family: var(--font-display); font-size: 20px;">2. Pet Spritesheet & Biểu cảm</h3>
            <span class="early-access-badge" id="currentPetName">Emberfox (Lửa)</span>
          </div>
          <div class="canvas-stage" id="petStage" style="background: radial-gradient(circle at center, #1c2637 0%, #0d111a 100%);">
            <img id="activePetImg" src="${petImages['emberfox'] || ''}" alt="Pet Hero" style="max-height: 280px; border-radius: var(--radius-md); box-shadow: var(--glow-cyan); transition: all 0.3s;" />
            <div id="petPoseBadge" style="position: absolute; bottom: 16px; background: rgba(0,0,0,0.7); padding: 4px 12px; border-radius: var(--radius-full); font-family: var(--font-mono); font-size: 11px; border: 1px solid var(--accent-cyan); color: var(--accent-cyan);">
              Pose: [Hero Portrait / Idle]
            </div>
          </div>

          <!-- Pose Controls -->
          <div class="sim-controls">
            <button class="btn btn-secondary" onclick="setPetPose('Idle')">Idle</button>
            <button class="btn btn-secondary" onclick="setPetPose('Happy')">😊 Happy</button>
            <button class="btn btn-secondary" onclick="setPetPose('Sleepy')">😴 Sleepy</button>
            <button class="btn btn-secondary" onclick="setPetPose('Proud')">👑 Proud</button>
            <button class="btn btn-secondary" onclick="setPetPose('Angry')">⚔️ Combat</button>
            <button class="btn btn-secondary" onclick="setPetPose('Work')">💻 Work/Code</button>
            <button class="btn btn-primary" onclick="setPetPose('Celebrate')">🎉 Celebrate</button>
          </div>

          <!-- Pet Select Gallery -->
          <div>
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">Chọn mẫu Linh thú sinh bằng Gemini Nano Banana 2:</div>
            <div class="pet-gallery">
              <div class="pet-thumb active" onclick="selectPet(this, 'emberfox', 'Ignis Emberfox (Hệ Lửa / Rust)', '${petImages['emberfox'] || ''}')">
                <img src="${petImages['emberfox'] || ''}" alt="Emberfox" />
                <div class="pet-thumb-name">Emberfox</div>
              </div>
              <div class="pet-thumb" onclick="selectPet(this, 'neonbyte', 'Aether Neon Byte (Hệ Cyber / TS)', '${petImages['neonbyte'] || ''}')">
                <img src="${petImages['neonbyte'] || ''}" alt="Neon Byte" />
                <div class="pet-thumb-name">Neon Byte</div>
              </div>
              <div class="pet-thumb" onclick="selectPet(this, 'abyssal', 'Nox Abyssal Pearl (Hệ Thủy / AI)', '${petImages['abyssal'] || ''}')">
                <img src="${petImages['abyssal'] || ''}" alt="Abyssal" />
                <div class="pet-thumb-name">Abyssal Pearl</div>
              </div>
              <div class="pet-thumb" onclick="selectPet(this, 'verdant', 'Sylvan Verdant Golem (Hệ Mộc / OSS)', '${petImages['verdant'] || ''}')">
                <img src="${petImages['verdant'] || ''}" alt="Verdant Golem" />
                <div class="pet-thumb-name">Verdant Golem</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- SECTION 3: COMPLETE SCREEN MOCKUPS WITH ANNOTATIONS -->
  <section id="mockups" class="doc-section">
    <div class="container">
      <div class="section-eyebrow">UI/UX Blueprint & Component Annotations</div>
      <h2 class="section-title">Mockups Chi Tiết Tất Cả Màn Hình Dự Án</h2>
      <p class="section-desc">
        Từng màn hình được thiết kế tỉ mỉ kèm các ký hiệu Annotation (điểm ghim số) giải thích rõ ràng vai trò và luồng tương tác kỹ thuật.
      </p>

      <!-- MOCKUP 1: PUBLIC UNCLAIMED ROUTE -->
      <div class="mockup-wrapper">
        <div class="mockup-header">
          <h3>Màn hình 1: Trang Xem Trứng Công Khai (Public Route /:username)</h3>
          <span class="early-access-badge">URL: githoot.com/octocat</span>
        </div>
        <div class="mockup-screen">
          <!-- Annotation Pins -->
          <div class="annotation-pin" style="top: 24px; right: 24px;">1</div>
          <div class="annotation-pin" style="top: 180px; left: 160px;">2</div>
          <div class="annotation-pin" style="top: 180px; right: 220px;">3</div>
          <div class="annotation-pin" style="bottom: 40px; right: 180px;">4</div>

          <!-- Mockup UI -->
          <div class="mockup-nav">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 800;">
              <span>🦉 GitHoot</span>
            </div>
            <div class="early-access-badge">
              <span class="live-dot"></span>
              <span>Early Access: Chỉ còn 37/100 slots miễn phí</span>
            </div>
          </div>

          <div class="profile-hero-grid">
            <!-- Egg Canvas Area -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,240,255,0.03); border: 1px dashed var(--border-subtle); border-radius: var(--radius-lg); padding: var(--sp-8);">
              <div class="egg-graphic" style="width: 140px; height: 180px; animation: eggWobble 2s infinite ease-in-out;"></div>
              <div style="margin-top: var(--sp-4); font-family: var(--font-mono); font-size: 11px; color: var(--accent-cyan);">
                ✦ Hạt giống Trứng Huyền Bí #4821 ✦
              </div>
            </div>

            <!-- Dev Snapshot & CTA -->
            <div class="profile-card-dev">
              <div class="dev-avatar-row">
                <div class="dev-avatar"></div>
                <div>
                  <h4 style="font-size: 20px; font-weight: 800;">The Octocat (@octocat)</h4>
                  <p style="font-size: 12px; color: var(--text-secondary);">San Francisco, CA • Building the future of open source</p>
                </div>
              </div>

              <div class="dev-stats-grid">
                <div class="dev-stat-box">
                  <div class="dev-stat-val">142</div>
                  <div class="dev-stat-label">Public Repos</div>
                </div>
                <div class="dev-stat-box">
                  <div class="dev-stat-val">9.8k</div>
                  <div class="dev-stat-label">Followers</div>
                </div>
                <div class="dev-stat-box">
                  <div class="dev-stat-val">TypeScript</div>
                  <div class="dev-stat-label">Top Language</div>
                </div>
                <div class="dev-stat-box">
                  <div class="dev-stat-val" style="color: var(--accent-magenta);">Legendary (?)</div>
                  <div class="dev-stat-label">Độ hiếm ước tính</div>
                </div>
              </div>

              <div style="margin-top: var(--sp-6);">
                <button class="btn btn-primary" style="width: 100%; font-size: 15px; padding: 14px;">
                  🚀 Đăng Nhập GitHub để Claim & Mở Trứng Miễn Phí
                </button>
                <div style="text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 8px;">
                  ✓ Chỉ tài khoản chính chủ @octocat mới có quyền nhận nuôi Linh thú này.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Annotation Legend -->
        <div class="annotation-list">
          <div class="annotation-item">
            <div class="annotation-num">1</div>
            <div><strong>Live Slot Counter:</strong> Đồng hồ đếm ngược số lượng 100 suất mở trứng miễn phí theo thời gian thực từ Cloudflare D1/KV.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">2</div>
            <div><strong>Deterministic Egg SVG/Canvas:</strong> Trứng AI hiển thị chuyển động lắc lư mượt mà 60fps, 0đ chi phí gọi API AI cho khách xem.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">3</div>
            <div><strong>Developer Snapshot & Trait Clues:</strong> Thống kê repo, ngôn ngữ chính và phân tích độ hiếm ước tính từ mã băm GitHub numeric ID.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">4</div>
            <div><strong>One-Click OAuth CTA:</strong> Nút kích hoạt luồng GitHub OAuth 2.0 an toàn để khóa quyền sở hữu chính chủ.</div>
          </div>
        </div>
      </div>

      <!-- MOCKUP 2: GACHA REVEAL MODAL -->
      <div class="mockup-wrapper">
        <div class="mockup-header">
          <h3>Màn hình 2: Nghi thức Mở Trứng Phong Cách Gacha (Hatch Reveal Ritual Modal)</h3>
          <span class="early-access-badge">Trigger: Sau khi OAuth & Queue hoàn tất</span>
        </div>
        <div class="mockup-screen" style="display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1b0a2a 0%, #050608 100%);">
          <!-- Annotation Pins -->
          <div class="annotation-pin" style="top: 40px; right: 120px;">1</div>
          <div class="annotation-pin" style="top: 140px; left: 160px;">2</div>
          <div class="annotation-pin" style="bottom: 60px; right: 160px;">3</div>

          <div style="max-width: 680px; width: 100%; background: var(--bg-surface-1); border: 2px solid var(--accent-magenta); border-radius: var(--radius-lg); padding: var(--sp-8); box-shadow: var(--glow-magenta); text-align: center;">
            <div style="display: inline-block; background: linear-gradient(90deg, #ff2a85, #ffa800); color: #000; font-family: var(--font-mono); font-size: 12px; font-weight: 900; padding: 4px 16px; border-radius: var(--radius-full); margin-bottom: var(--sp-4);">
              ★ ★ ★ ★ ★ LEGENDARY HATCH ★ ★ ★ ★ ★
            </div>
            <h2 style="font-family: var(--font-display); font-size: 32px; font-weight: 900; color: #fff; margin-bottom: var(--sp-2);">
              Ignis Emberfox Đã Thức Tỉnh!
            </h2>
            <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: var(--sp-6);">
              Linh thú bậc Huyền Thoại hệ Lửa được tôi luyện từ <strong>1,420 commits</strong> trong các repository Rust & Go của bạn.
            </p>

            <div style="display: flex; justify-content: center; margin-bottom: var(--sp-6);">
              <img src="${petImages['emberfox'] || ''}" alt="Emberfox" style="width: 220px; height: 220px; object-fit: cover; border-radius: var(--radius-lg); border: 2px solid var(--accent-cyan); box-shadow: var(--glow-cyan);" />
            </div>

            <div style="display: flex; gap: var(--sp-4); justify-content: center;">
              <button class="btn btn-primary" style="font-size: 14px; padding: 12px 24px;">
                🎉 Xem Profile & Khoe Lên X (Twitter)
              </button>
              <button class="btn btn-secondary" style="font-size: 14px;">
                📋 Sao chép Badge GitHub
              </button>
            </div>
          </div>
        </div>

        <!-- Annotation Legend -->
        <div class="annotation-list">
          <div class="annotation-item">
            <div class="annotation-num">1</div>
            <div><strong>Hologram Rarity Banner:</strong> Hiệu ứng ánh kim chuyển màu tôn vinh bậc độ hiếm (Common -> Mythic).</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">2</div>
            <div><strong>Hero Character Reveal:</strong> Ảnh sinh từ Gemini Nano Banana 2 sắc nét, sẵn sàng chuyển động mừng chiến thắng.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">3</div>
            <div><strong>Viral Share Triggers:</strong> Nút kích hoạt cửa sổ chia sẻ lên X/LinkedIn với bài đăng mẫu soạn sẵn.</div>
          </div>
        </div>
      </div>

      <!-- MOCKUP 3: CLAIMED PROFILE V1 -->
      <div class="mockup-wrapper">
        <div class="mockup-header">
          <h3>Màn hình 3: Trang Profile Chính Thức & Giá Sách Bảo Hộ Repository</h3>
          <span class="early-access-badge">URL: githoot.com/octocat (Đã Claim)</span>
        </div>
        <div class="mockup-screen">
          <!-- Annotation Pins -->
          <div class="annotation-pin" style="top: 80px; right: 280px;">1</div>
          <div class="annotation-pin" style="top: 240px; left: 140px;">2</div>
          <div class="annotation-pin" style="bottom: 40px; right: 240px;">3</div>

          <div style="display: grid; grid-template-columns: 280px 1fr; gap: var(--sp-6);">
            <!-- Sidebar Guardian -->
            <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--sp-6); text-align: center;">
              <img src="${petImages['emberfox'] || ''}" alt="Pet" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--accent-cyan);" />
              <h4 style="font-size: 18px; margin-top: var(--sp-3);">Ignis Emberfox</h4>
              <div style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-green); margin-top: 4px;">
                ● Tâm trạng: Energetic (Vừa commit 2h trước)
              </div>
              <div style="margin-top: var(--sp-4); padding: 8px; background: var(--bg-surface-1); border-radius: var(--radius-sm); font-size: 12px;">
                Level 1 • 420 / 1000 XP
              </div>
            </div>

            <!-- Main Content Repos & Badge -->
            <div>
              <h4 style="font-size: 18px; margin-bottom: var(--sp-4); font-family: var(--font-display);">Repositories Được Bảo Hộ</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); margin-bottom: var(--sp-6);">
                <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); padding: var(--sp-4); border-radius: var(--radius-md);">
                  <div style="display: flex; justify-content: space-between; font-weight: 700;">
                    <span>⭐ Spoon-Knife</span>
                    <span style="font-family: var(--font-mono); font-size: 11px; color: var(--accent-amber);">Primary Realm</span>
                  </div>
                  <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0;">This repo is that fork demo project</p>
                  <span style="font-size: 11px; color: var(--accent-cyan);">TypeScript • 12.4k Stars</span>
                </div>
                <div style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); padding: var(--sp-4); border-radius: var(--radius-md);">
                  <div style="display: flex; justify-content: space-between; font-weight: 700;">
                    <span>Hello-World</span>
                    <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">Realm #2</span>
                  </div>
                  <p style="font-size: 12px; color: var(--text-secondary); margin: 6px 0;">My first repository on GitHub</p>
                  <span style="font-size: 11px; color: var(--accent-cyan);">Markdown • 2.1k Stars</span>
                </div>
              </div>

              <!-- README Badge Snippet -->
              <div style="background: var(--bg-surface-1); border: 1px solid var(--border-strong); padding: var(--sp-4); border-radius: var(--radius-md);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--accent-cyan);">
                    Nhúng Badge động vào GitHub README.md:
                  </span>
                  <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 11px;">Copy Markdown</button>
                </div>
                <code style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); display: block; background: #000; padding: 8px; border-radius: 4px;">
                  [![GitHoot Guardian](https://githoot.com/badge/octocat.svg)](https://githoot.com/octocat)
                </code>
              </div>
            </div>
          </div>
        </div>

        <!-- Annotation Legend -->
        <div class="annotation-list">
          <div class="annotation-item">
            <div class="annotation-num">1</div>
            <div><strong>Tamagotchi Mood Engine:</strong> Trạng thái tích cực (Energetic / Active / Resting) phản ánh tần suất commit gần nhất của lập trình viên.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">2</div>
            <div><strong>Guarded Repositories Shelf:</strong> Giá sách dự án mã nguồn mở nơi Linh thú đang canh giữ, dẫn trực tiếp về repo GitHub.</div>
          </div>
          <div class="annotation-item">
            <div class="annotation-num">3</div>
            <div><strong>Dynamic SVG README Badge:</strong> Đoạn mã nhúng tự động cập nhật Level và hình ảnh linh thú trực tiếp trên GitHub README.</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- SECTION 4: ARCHITECTURE & DIAGRAMS -->
  <section id="diagrams" class="doc-section">
    <div class="container">
      <div class="section-eyebrow">System Architecture & Technical Workflows</div>
      <h2 class="section-title">Sơ Đồ Kiến Trúc Hệ Thống & Luồng Dữ Liệu</h2>
      <p class="section-desc">
        Thiết kế kiến trúc Cloudflare Edge-first chịu tải 100k requests/giờ, phân tách rạch ròi luồng đọc ẩn danh (0đ AI) và luồng sinh ảnh AI bất đồng bộ.
      </p>

      <!-- Architecture SVG Diagram -->
      <div class="diagram-container">
        <h4 style="font-family: var(--font-display); font-size: 18px; margin-bottom: var(--sp-4); color: var(--accent-cyan);">
          1. Kiến Trúc Edge-First Kháng Nghẽn GitHub API (Anti-Throttling Architecture)
        </h4>
        <svg class="diagram-svg" viewBox="0 0 960 420" xmlns="http://www.w3.org/2000/svg">
          <!-- Background Grid -->
          <defs>
            <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00f0ff" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="#ff2a85" stop-opacity="0.2"/>
            </linearGradient>
          </defs>

          <!-- Client Box -->
          <rect x="20" y="160" width="140" height="90" rx="8" fill="#0d111a" stroke="#00f0ff" stroke-width="2"/>
          <text x="90" y="195" fill="#fff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Client Browser</text>
          <text x="90" y="215" fill="#8b9bb4" font-family="sans-serif" font-size="11" text-anchor="middle">githoot.com/:user</text>

          <!-- Arrow 1 -->
          <path d="M 160 205 L 220 205" stroke="#00f0ff" stroke-width="2"/>
          <text x="190" y="195" fill="#00f0ff" font-family="monospace" font-size="10" text-anchor="middle">GET</text>

          <!-- Edge Worker -->
          <rect x="230" y="110" width="180" height="200" rx="10" fill="#141b27" stroke="#00f0ff" stroke-width="2"/>
          <text x="320" y="140" fill="#00f0ff" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">Cloudflare Worker</text>
          
          <rect x="250" y="160" width="140" height="40" rx="4" fill="#1c2637" stroke="rgba(0,240,255,0.3)"/>
          <text x="320" y="185" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">SWR KV Resolver</text>
          
          <rect x="250" y="215" width="140" height="40" rx="4" fill="#1c2637" stroke="rgba(0,240,255,0.3)"/>
          <text x="320" y="240" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">Token Pool Manager</text>

          <rect x="250" y="265" width="140" height="30" rx="4" fill="rgba(255,42,133,0.2)" stroke="#ff2a85"/>
          <text x="320" y="285" fill="#ff2a85" font-family="monospace" font-size="10" text-anchor="middle">Degraded Seed Mode</text>

          <!-- Cache & DB -->
          <rect x="470" y="40" width="160" height="70" rx="6" fill="#0d111a" stroke="#00ff88" stroke-width="1.5"/>
          <text x="550" y="70" fill="#00ff88" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Cloudflare KV</text>
          <text x="550" y="90" fill="#8b9bb4" font-family="monospace" font-size="10" text-anchor="middle">SWR Cache (&lt;20ms)</text>

          <rect x="470" y="130" width="160" height="70" rx="6" fill="#0d111a" stroke="#ffa800" stroke-width="1.5"/>
          <text x="550" y="160" fill="#ffa800" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Cloudflare D1 (SQLite)</text>
          <text x="550" y="180" fill="#8b9bb4" font-family="monospace" font-size="10" text-anchor="middle">100 Early Access Slots</text>

          <!-- GitHub External -->
          <rect x="470" y="220" width="160" height="70" rx="6" fill="#0d111a" stroke="#8b9bb4" stroke-width="1.5"/>
          <text x="550" y="250" fill="#fff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">GitHub REST API</text>
          <text x="550" y="270" fill="#8b9bb4" font-family="monospace" font-size="10" text-anchor="middle">Rotated PAT / App Pool</text>

          <!-- AI Generation Pipeline -->
          <rect x="690" y="110" width="240" height="230" rx="10" fill="#141b27" stroke="#ff2a85" stroke-width="2"/>
          <text x="810" y="140" fill="#ff2a85" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">AI Pipeline (Post-OAuth)</text>

          <rect x="710" y="160" width="200" height="40" rx="4" fill="#1c2637" stroke="rgba(255,42,133,0.3)"/>
          <text x="810" y="185" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">Gemini Nano Banana 2</text>

          <rect x="710" y="210" width="200" height="40" rx="4" fill="#1c2637" stroke="rgba(255,42,133,0.3)"/>
          <text x="810" y="235" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle">WASM Smart Slicer + Alpha</text>

          <rect x="710" y="260" width="200" height="40" rx="4" fill="#1c2637" stroke="#00f0ff"/>
          <text x="810" y="285" fill="#00f0ff" font-family="monospace" font-size="11" text-anchor="middle">R2 CDN (cdn.githoot.com)</text>

          <!-- Connectors -->
          <path d="M 410 160 L 470 80" stroke="#00ff88" stroke-width="1.5" stroke-dasharray="4"/>
          <path d="M 410 200 L 470 170" stroke="#ffa800" stroke-width="1.5"/>
          <path d="M 410 240 L 470 250" stroke="#8b9bb4" stroke-width="1.5"/>
          <path d="M 630 170 L 690 180" stroke="#ff2a85" stroke-width="2"/>
        </svg>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="container">
      <p>🦉 GitHoot.com • Gamified Developer Identity & Viral Gacha Hatch on Cloudflare Edge</p>
      <p style="margin-top: 4px; font-size: 11px;">Powered by Gemini Nano Banana 2 • Cloudflare Pages, D1, R2, KV</p>
    </div>
  </footer>

  <!-- SCRIPT FOR INTERACTIVE DEMO -->
  <script>
    function setTheme(evt, theme) {
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
      if (evt && evt.target) {
        evt.target.classList.add('active');
      }
    }

    let eggClicks = 0;
    const eggElem = document.getElementById('interactiveEgg');
    const eggText = document.getElementById('eggStatusText');

    function handleEggClick() {
      eggClicks++;
      playAudio('wobble');
      if (eggClicks < 3) {
        setEggState('wobble');
        eggText.innerText = '✨ Trứng đang phản hồi! Click thêm để tạo vết nứt (' + eggClicks + '/3)...';
      } else if (eggClicks < 6) {
        setEggState('crack');
        eggText.innerText = '⚡ Vỏ trứng bắt đầu nứt sáng! Click tiếp để kích hoạt nở (' + eggClicks + '/6)...';
      } else {
        triggerHatchSequence();
      }
    }

    function setEggState(state) {
      eggElem.className = 'egg-graphic ' + state;
    }

    function triggerHatchSequence() {
      setEggState('hatch');
      playAudio('hatch');
      eggText.innerText = '🎉 BOOM! Trứng đã nở thành công! Linh thú thức tỉnh!';
      setTimeout(() => {
        setEggState('idle');
        eggClicks = 0;
        eggText.innerText = '👉 Click vào trứng để lắc lại từ đầu';
      }, 3000);
    }

    // Pet Controller
    function selectPet(elem, id, name, imgSrc) {
      document.querySelectorAll('.pet-thumb').forEach(t => t.classList.remove('active'));
      if (elem) {
        elem.classList.add('active');
      }
      document.getElementById('currentPetName').innerText = name;
      document.getElementById('activePetImg').src = imgSrc;
    }

    function setPetPose(poseName) {
      document.getElementById('petPoseBadge').innerText = 'Pose: [' + poseName + ' Mode]';
      const img = document.getElementById('activePetImg');
      img.style.transform = 'scale(1.08)';
      playAudio('pose');
      setTimeout(() => {
        img.style.transform = 'scale(1)';
      }, 200);
    }

    // Web Audio Synthesizer (Zero MP3 files needed)
    function playAudio(type) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'wobble') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'hatch') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
        }
      } catch(e) {}
    }
  </script>
</body>
</html>
`;

const outputPath = path.join(__dirname, '..', 'githoot-design-overview.html');
fs.writeFileSync(outputPath, htmlContent, 'utf-8');
console.log(`Successfully built ${outputPath} (${Math.round(htmlContent.length / 1024)} KB)`);

const planHtmlPath = path.join(__dirname, '..', 'plans', '260829-2354-githoot-mvp-implementation', 'plan.html');
fs.writeFileSync(planHtmlPath, htmlContent, 'utf-8');
console.log(`Successfully synced to ${planHtmlPath}`);
