import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const planDir = path.join(__dirname, '..', 'plans', '260830-1535-hatch-eggs-pipeline');

const planMd = fs.readFileSync(path.join(planDir, 'plan.md'), 'utf8');
const phaseFiles = [
  'phase-01-deterministic-identity-engine.md',
  'phase-02-bootstrap-reference-minting.md',
  'phase-03-nano-banana-async-queue.md',
  'phase-04-gacha-reveal-and-player-ui.md',
  'phase-05-production-hardening-and-qa.md'
];

const phaseContents = {};
for (const file of phaseFiles) {
  const p = path.join(planDir, file);
  if (fs.existsSync(p)) {
    phaseContents[file] = fs.readFileSync(p, 'utf8');
  }
}

const htmlContent = `<!DOCTYPE html>
<html lang="vi" data-theme="cyber">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHoot Plan — Triển Khai Hatch Eggs & Pet Pipeline (Gemini Nano Banana 2)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=JetBrains+Mono:wght@400;600;700;800&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #07090E;
      --bg-surface-1: #0D111A;
      --bg-surface-2: #141B27;
      --bg-surface-3: #1C2637;
      --border-subtle: rgba(0, 240, 255, 0.14);
      --border-strong: rgba(0, 240, 255, 0.35);
      
      --text-primary: #F0F6FC;
      --text-secondary: #8B9BB4;
      --text-muted: #53627A;
      
      --accent-cyan: #00F0FF;
      --accent-magenta: #FF2A85;
      --accent-amber: #FFA800;
      --accent-green: #00FF88;
      --accent-purple: #9945FF;
      
      --glow-cyan: 0 0 24px rgba(0, 240, 255, 0.35);
      --glow-magenta: 0 0 24px rgba(255, 42, 133, 0.35);
      --glow-amber: 0 0 24px rgba(255, 168, 0, 0.35);
      --card-shadow: 0 12px 40px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--border-subtle);
      
      --font-display: 'Archivo', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-body: 'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-body);
      line-height: 1.6;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 240, 255, 0.07) 0%, transparent 45%),
        radial-gradient(circle at 85% 30%, rgba(255, 42, 133, 0.06) 0%, transparent 50%),
        radial-gradient(circle at 50% 85%, rgba(153, 69, 255, 0.07) 0%, transparent 50%);
      background-attachment: fixed;
      padding: 32px 20px 100px;
    }

    .container {
      max-width: 1320px;
      margin: 0 auto;
    }

    /* Top Nav */
    .site-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-subtle);
      margin-bottom: 40px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: #FFF;
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 900;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-magenta));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: var(--glow-cyan);
    }
    .nav-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .tag {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tag-cyan { background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3); }
    .tag-magenta { background: rgba(255, 42, 133, 0.1); color: var(--accent-magenta); border: 1px solid rgba(255, 42, 133, 0.3); }
    .tag-amber { background: rgba(255, 168, 0, 0.1); color: var(--accent-amber); border: 1px solid rgba(255, 168, 0, 0.3); }
    .tag-green { background: rgba(0, 255, 136, 0.1); color: var(--accent-green); border: 1px solid rgba(0, 255, 136, 0.3); }

    /* Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, var(--bg-surface-1) 0%, var(--bg-surface-2) 100%);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 36px 32px;
      margin-bottom: 36px;
      box-shadow: var(--card-shadow);
      position: relative;
      overflow: hidden;
    }
    .hero-banner::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, var(--accent-cyan), var(--accent-magenta), transparent);
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #FFFFFF 20%, var(--accent-cyan) 70%, var(--accent-magenta) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-desc {
      color: var(--text-secondary);
      font-size: 15px;
      max-width: 980px;
      line-height: 1.6;
    }

    /* KPI Cards Row (AntV Infographic Style) */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }
    .kpi-card {
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 20px;
      box-shadow: var(--card-shadow);
      position: relative;
      overflow: hidden;
    }
    .kpi-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 4px; height: 100%;
      background: var(--accent-cyan);
    }
    .kpi-card.amber::after { background: var(--accent-amber); }
    .kpi-card.magenta::after { background: var(--accent-magenta); }
    .kpi-card.green::after { background: var(--accent-green); }
    .kpi-title {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kpi-val {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 900;
      color: #FFF;
      margin: 4px 0 2px;
    }
    .kpi-desc {
      font-size: 12.5px;
      color: var(--text-secondary);
    }

    /* Section Cards */
    .section-card {
      background: var(--bg-surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 40px;
      box-shadow: var(--card-shadow);
    }
    .section-heading {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      color: #FFF;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 14px;
    }
    .step-pill {
      font-family: var(--font-mono);
      color: var(--accent-cyan);
      font-size: 13px;
      background: rgba(0, 240, 255, 0.1);
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 240, 255, 0.25);
    }

    /* Phase Cards Grid */
    .phases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .phase-card {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
    }
    .phase-card:hover {
      border-color: var(--accent-cyan);
      box-shadow: var(--glow-cyan);
      transform: translateY(-3px);
    }
    .phase-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .phase-num {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .phase-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 800;
      color: #FFF;
      margin: 8px 0 6px;
    }
    .phase-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 16px;
      flex-grow: 1;
    }
    .phase-bullets {
      list-style: none;
      margin-bottom: 16px;
    }
    .phase-bullets li {
      font-size: 12.5px;
      color: var(--text-secondary);
      margin-bottom: 6px;
      position: relative;
      padding-left: 14px;
    }
    .phase-bullets li::before {
      content: '▹';
      position: absolute;
      left: 0;
      color: var(--accent-magenta);
    }
    .phase-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 12px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
    }
    .btn-view-modal {
      background: var(--bg-surface-3);
      color: var(--accent-cyan);
      border: 1px solid rgba(0, 240, 255, 0.3);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-view-modal:hover {
      background: var(--accent-cyan);
      color: #000;
    }

    /* Diagram Area */
    .diagram-box {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      padding: 24px;
      margin: 20px 0;
      overflow-x: auto;
    }
    svg.arch-diagram {
      width: 100%;
      min-width: 860px;
      height: auto;
    }

    /* Modal for Phase Markdown */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(7, 9, 14, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-card {
      background: var(--bg-surface-1);
      border: 2px solid var(--accent-cyan);
      border-radius: 12px;
      max-width: 900px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      padding: 32px;
      box-shadow: 0 20px 60px rgba(0, 240, 255, 0.3);
      position: relative;
    }
    .modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: var(--bg-surface-3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #FFF;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-close:hover {
      background: var(--accent-magenta);
      color: #FFF;
    }
    .modal-markdown {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .modal-markdown h1, .modal-markdown h2, .modal-markdown h3 {
      color: #FFF;
      font-family: var(--font-display);
      margin: 16px 0 8px;
    }
    .modal-markdown code {
      font-family: var(--font-mono);
      color: var(--accent-cyan);
      background: rgba(0,0,0,0.5);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .modal-markdown pre {
      background: #040508;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 14px;
      overflow-x: auto;
      margin: 12px 0;
    }
    .modal-markdown pre code {
      background: none;
      padding: 0;
      color: #8B9BB4;
    }
    .modal-markdown ul {
      padding-left: 20px;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>

  <div class="container">

    <!-- Top Nav -->
    <nav class="site-nav">
      <a href="/" class="brand-logo">
        <div class="brand-icon">🦉</div>
        <span>GitHoot Plan</span>
      </a>
      <div class="nav-tags">
        <span class="tag tag-cyan">Target: Gemini Nano Banana 2</span>
        <span class="tag tag-magenta">16-Pose Superhero Landing</span>
        <span class="tag tag-green">Cloudflare D1 & R2</span>
        <span class="tag tag-amber">Kongming Supervised</span>
      </div>
    </nav>

    <!-- Hero Banner -->
    <header class="hero-banner">
      <h1 class="hero-title">Kế Hoạch Triển Khai Hatch Eggs & Pet Pipeline</h1>
      <p class="hero-desc">
        Bản kế hoạch kỹ thuật 5 phase hoàn chỉnh để đưa quy trình Hatch Eggs & Sinh Linh Thú (Guardian) lên môi trường production. 
        Kế hoạch giải quyết trọn vẹn từ di trú cơ sở dữ liệu D1, hàng đợi Cloudflare Queue DAG 16 poses độc lập, 
        cổng duyệt ngữ nghĩa reference candidate, đến trình phát Superhero Landing 16 frames trên frontend.
      </p>
    </header>

    <!-- KPI Panels (AntV CompactCard Style) -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-title">TỔNG THỜI GIAN THỰC THI</div>
        <div class="kpi-val">4.0 Ngày</div>
        <div class="kpi-desc">Chia đều thành 5 phases độc lập</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-title">SỐ PHASES THỰC THI</div>
        <div class="kpi-val">5 Phases</div>
        <div class="kpi-desc">Từ D1 Schema đến UI & Production QA</div>
      </div>
      <div class="kpi-card magenta">
        <div class="kpi-title">MÔ HÌNH SPRITESHEET</div>
        <div class="kpi-val">16 Poses</div>
        <div class="kpi-desc">1 pose / 1 call, ghép lưới local 4x4</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-title">BẢO HIỂM BẤT BIẾN DNA</div>
        <div class="kpi-val">100% Khóa</div>
        <div class="kpi-desc">1 GitHub ID = 1 Immutable DNA Seed</div>
      </div>
    </div>

    <!-- System Architecture Workflow Diagram -->
    <section class="section-card">
      <h2 class="section-heading">
        <span class="step-pill">KIẾN TRÚC</span>
        Sơ Đồ Luồng Dữ Liệu & Quy Trình Triển Khai 5 Phases
      </h2>
      
      <div class="diagram-box">
        <svg class="arch-diagram" viewBox="0 0 960 260" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="flowGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00F0FF"/>
              <stop offset="100%" stop-color="#FF2A85"/>
            </linearGradient>
          </defs>

          <!-- Phase 1 -->
          <rect x="20" y="70" width="160" height="110" rx="8" fill="#0D111A" stroke="#00F0FF" stroke-width="2"/>
          <text x="100" y="95" fill="#00F0FF" font-family="JetBrains Mono" font-weight="bold" font-size="11" text-anchor="middle">PHASE 1 (1.0d)</text>
          <text x="100" y="120" fill="#FFF" font-family="Archivo" font-weight="bold" font-size="13" text-anchor="middle">D1 Migration v2</text>
          <text x="100" y="140" fill="#8B9BB4" font-family="JetBrains Mono" font-size="10" text-anchor="middle">IdentitySpec Compiler</text>
          <text x="100" y="155" fill="#00FF88" font-family="JetBrains Mono" font-size="9" text-anchor="middle">Species Phenotypes</text>

          <!-- Arrow 1->2 -->
          <line x1="180" y1="125" x2="215" y2="125" stroke="url(#flowGlow)" stroke-width="3"/>

          <!-- Phase 2 -->
          <rect x="215" y="70" width="160" height="110" rx="8" fill="#0D111A" stroke="#FF2A85" stroke-width="2"/>
          <text x="295" y="95" fill="#FF2A85" font-family="JetBrains Mono" font-weight="bold" font-size="11" text-anchor="middle">PHASE 2 (0.8d)</text>
          <text x="295" y="120" fill="#FFF" font-family="Archivo" font-weight="bold" font-size="13" text-anchor="middle">Reference Bootstrap</text>
          <text x="295" y="140" fill="#8B9BB4" font-family="JetBrains Mono" font-size="10" text-anchor="middle">Candidate → CAS Approve</text>
          <text x="295" y="155" fill="#FFA800" font-family="JetBrains Mono" font-size="9" text-anchor="middle">Immutable Lock</text>

          <!-- Arrow 2->3 -->
          <line x1="375" y1="125" x2="410" y2="125" stroke="url(#flowGlow)" stroke-width="3"/>

          <!-- Phase 3 -->
          <rect x="410" y="70" width="160" height="110" rx="8" fill="#141B27" stroke="#00FF88" stroke-width="2"/>
          <text x="490" y="95" fill="#00FF88" font-family="JetBrains Mono" font-weight="bold" font-size="11" text-anchor="middle">PHASE 3 (1.0d)</text>
          <text x="490" y="120" fill="#FFF" font-family="Archivo" font-weight="bold" font-size="13" text-anchor="middle">Async Queue Worker</text>
          <text x="490" y="140" fill="#8B9BB4" font-family="JetBrains Mono" font-size="10" text-anchor="middle">16 Poses (1 call/pose)</text>
          <text x="490" y="155" fill="#00F0FF" font-family="JetBrains Mono" font-size="9" text-anchor="middle">Contour Slicer + WebP</text>

          <!-- Arrow 3->4 -->
          <line x1="570" y1="125" x2="605" y2="125" stroke="url(#flowGlow)" stroke-width="3"/>

          <!-- Phase 4 -->
          <rect x="605" y="70" width="160" height="110" rx="8" fill="#0D111A" stroke="#FFA800" stroke-width="2"/>
          <text x="685" y="95" fill="#FFA800" font-family="JetBrains Mono" font-weight="bold" font-size="11" text-anchor="middle">PHASE 4 (0.8d)</text>
          <text x="685" y="120" fill="#FFF" font-family="Archivo" font-weight="bold" font-size="13" text-anchor="middle">Gacha Reveal UI</text>
          <text x="685" y="140" fill="#8B9BB4" font-family="JetBrains Mono" font-size="10" text-anchor="middle">16-Frame Steps Player</text>
          <text x="685" y="155" fill="#FF2A85" font-family="JetBrains Mono" font-size="9" text-anchor="middle">F7/F8 Shake & VFX</text>

          <!-- Arrow 4->5 -->
          <line x1="765" y1="125" x2="800" y2="125" stroke="url(#flowGlow)" stroke-width="3"/>

          <!-- Phase 5 -->
          <rect x="800" y="70" width="140" height="110" rx="8" fill="#0D111A" stroke="#9945FF" stroke-width="2"/>
          <text x="870" y="95" fill="#9945FF" font-family="JetBrains Mono" font-weight="bold" font-size="11" text-anchor="middle">PHASE 5 (0.4d)</text>
          <text x="870" y="120" fill="#FFF" font-family="Archivo" font-weight="bold" font-size="13" text-anchor="middle">Preflight & QA</text>
          <text x="870" y="140" fill="#8B9BB4" font-family="JetBrains Mono" font-size="10" text-anchor="middle">Manifest Signoff</text>
          <text x="870" y="155" fill="#00FF88" font-family="JetBrains Mono" font-size="9" text-anchor="middle">Kongming GO Sign</text>
        </svg>
      </div>
    </section>

    <!-- Phase Outlines Grid -->
    <section class="section-card">
      <h2 class="section-heading">
        <span class="step-pill">PHASES ROADMAP</span>
        Chi Tiết 5 Giai Đoạn Triển Khai
      </h2>

      <div class="phases-grid">
        <!-- Card Phase 1 -->
        <div class="phase-card" onclick="openPhaseModal('phase-01-deterministic-identity-engine.md')">
          <div>
            <div class="phase-header">
              <span class="phase-num">PHASE 01</span>
              <span class="tag tag-cyan">IN-PROGRESS</span>
            </div>
            <div class="phase-title">Contracts, D1 Schema & Identity Engine</div>
            <p class="phase-desc">Di trú D1 Schema Migration v2, thiết lập Queue Consumer Binding, R2 Key Scheme và tích hợp compiler IdentitySpec thuần enum.</p>
            <ul class="phase-bullets">
              <li>Mở rộng D1 <code>guardians</code> & tạo bảng <code>guardian_reference_candidates</code></li>
              <li>Tạo <code>contracts.ts</code> và <code>compiler.ts</code> (8 loài, kiểu hình tương thích)</li>
              <li>Chạy 35+ unit tests kiểm chứng tính tất định</li>
            </ul>
          </div>
          <div class="phase-footer">
            <span>Thời lượng: 1.0d • P1</span>
            <button class="btn-view-modal">Xem Chi Tiết ↗</button>
          </div>
        </div>

        <!-- Card Phase 2 -->
        <div class="phase-card" onclick="openPhaseModal('phase-02-bootstrap-reference-minting.md')">
          <div>
            <div class="phase-header">
              <span class="phase-num">PHASE 02</span>
              <span class="tag tag-amber">PENDING</span>
            </div>
            <div class="phase-title">Durable Reference Bootstrap & Approval</div>
            <p class="phase-desc">Quy trình sinh reference candidate cho user mới, kiểm tra hình học và cơ chế Compare-and-Set (CAS) phê duyệt ngữ nghĩa có gắn mã băm.</p>
            <ul class="phase-bullets">
              <li>Tách riêng claim HTTP và enqueue job (phản hồi &lt;100ms)</li>
              <li>Lưu candidate trên R2/D1 ở trạng thái <code>VERIFYING</code></li>
              <li>CAS Approval thăng cấp thành <code>references/{sha256}.png</code> bất biến</li>
            </ul>
          </div>
          <div class="phase-footer">
            <span>Thời lượng: 0.8d • P1</span>
            <button class="btn-view-modal">Xem Chi Tiết ↗</button>
          </div>
        </div>

        <!-- Card Phase 3 -->
        <div class="phase-card" onclick="openPhaseModal('phase-03-nano-banana-async-queue.md')">
          <div>
            <div class="phase-header">
              <span class="phase-num">PHASE 03</span>
              <span class="tag tag-amber">PENDING</span>
            </div>
            <div class="phase-title">Nano Banana 2 Async Queue (16 Poses)</div>
            <p class="phase-desc">Hàng đợi Cloudflare Queue xử lý 16 poses đơn lẻ có reference conditioning, kiểm duyệt 4 cổng và ghép 4x4 sheet + strip trong suốt.</p>
            <ul class="phase-bullets">
              <li>16 single-pose calls tới <code>nano-banana-pro-preview</code> (1 call / pose)</li>
              <li>Khử viền xanh $g=\min(g,(r+b)/2)$ &amp; căn giữa contour 256²</li>
              <li>Ghép server-side thành 4x4 Sheet (1024²) và Strip (4096x256) PNG + WebP</li>
            </ul>
          </div>
          <div class="phase-footer">
            <span>Thời lượng: 1.0d • P1</span>
            <button class="btn-view-modal">Xem Chi Tiết ↗</button>
          </div>
        </div>

        <!-- Card Phase 4 -->
        <div class="phase-card" onclick="openPhaseModal('phase-04-gacha-reveal-and-player-ui.md')">
          <div>
            <div class="phase-header">
              <span class="phase-num">PHASE 04</span>
              <span class="tag tag-amber">PENDING</span>
            </div>
            <div class="phase-title">Gacha Reveal & 16-Frame Player UI</div>
            <p class="phase-desc">Nâng cấp Gacha Reveal Modal với trình phát 16-Frame Steps(15), hiệu ứng chấn động camera shake, nứt sàn F7/F8 và thanh tua Scrubber.</p>
            <ul class="phase-bullets">
              <li>Polling status thực tế từ backend (xoá bỏ fake timeout)</li>
              <li>Trình phát 16-Frame Steps(15) với công thức offset <code>-(k-1)*256px</code></li>
              <li>Đồng bộ Camera Shake &amp; Particle Blast tại Frame 7 Tiếp Đất 3 Điểm</li>
            </ul>
          </div>
          <div class="phase-footer">
            <span>Thời lượng: 0.8d • P1</span>
            <button class="btn-view-modal">Xem Chi Tiết ↗</button>
          </div>
        </div>

        <!-- Card Phase 5 -->
        <div class="phase-card" onclick="openPhaseModal('phase-05-production-hardening-and-qa.md')">
          <div>
            <div class="phase-header">
              <span class="phase-num">PHASE 05</span>
              <span class="tag tag-amber">PENDING</span>
            </div>
            <div class="phase-title">Publication Preflight & Autonomous QA</div>
            <p class="phase-desc">Thiết lập cổng kiểm tra trước xuất bản bắt buộc (Publication Preflight), CI/CD fail-closed và kiểm thử tự động toàn diện.</p>
            <ul class="phase-bullets">
              <li>Publication Preflight Gate chặn 100% xuất bản nếu thiếu WebP/Reference</li>
              <li>CI/CD fail-closed trên GitHub Actions (không dùng <code>|| true</code>)</li>
              <li>Autonomous QA Loop kiểm thử ứng dụng thực tế và đệ trình Kongming ký duyệt</li>
            </ul>
          </div>
          <div class="phase-footer">
            <span>Thời lượng: 0.4d • P1</span>
            <button class="btn-view-modal">Xem Chi Tiết ↗</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer style="text-align: center; margin-top: 60px; color: var(--text-muted); font-size: 13px; font-family: var(--font-mono); border-top: 1px solid var(--border-subtle); padding-top: 24px;">
      GitHoot Implementation Plan • Supervised by Kongming • Edge-First Cloudflare & Gemini Nano Banana 2
    </footer>

  </div>

  <!-- Detail Modal -->
  <div class="modal-overlay" id="phaseModalOverlay" onclick="closePhaseModal(event)">
    <div class="modal-card" id="phaseModalCard">
      <button class="modal-close" onclick="closePhaseModal(event, true)">✕</button>
      <div class="modal-markdown" id="modalMarkdownContent">
        <!-- Content injected dynamically -->
      </div>
    </div>
  </div>

  <script>
    const phaseFilesData = ${JSON.stringify(phaseContents)};

    function openPhaseModal(filename) {
      const rawMd = phaseFilesData[filename] || "Không tìm thấy nội dung.";
      document.getElementById('modalMarkdownContent').innerHTML = renderSimpleMarkdown(rawMd);
      document.getElementById('phaseModalOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closePhaseModal(e, force = false) {
      if (force || e.target.id === 'phaseModalOverlay') {
        document.getElementById('phaseModalOverlay').classList.remove('active');
        document.body.style.overflow = 'auto';
      }
    }

    // Lightweight markdown formatter for self-contained viewing
    function renderSimpleMarkdown(md) {
      return md
        .replace(/^---[\\s\\S]*?---/m, '') // Strip frontmatter
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\\*\\*(.*)\\*\\*/gim, '<strong>$1</strong>')
        .replace(/\\*(.*)\\*/gim, '<em>$1</em>')
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/gim, '<pre><code>$1</code></pre>')
        .replace(/\`([^\`]+)\`/gim, '<code>$1</code>')
        .replace(/^\\- \\[ \\] (.*$)/gim, '<ul><li><input type="checkbox" disabled> $1</li></ul>')
        .replace(/^\\- \\[x\\] (.*$)/gim, '<ul><li><input type="checkbox" checked disabled> $1</li></ul>')
        .replace(/^\\- (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/\\n/gim, '<br>');
    }
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(planDir, 'plan.html'), htmlContent);
console.log('✓ Successfully generated self-contained plan.html in:', planDir);
