import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePetsDir = path.join(__dirname, '..', 'assets', 'sample-pets');

function b64(filename) {
  const p = path.join(samplePetsDir, filename);
  if (!fs.existsSync(p)) return '';
  const data = fs.readFileSync(p);
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${data.toString('base64')}`;
}

// REAL Gemini Nano Banana 2 (nano-banana-pro-preview) output:
// 16 single-pose frames, each identity-conditioned on the committed Guardian art,
// contour-centered, composited into a deterministic 4x4 sheet + 16-frame strip.
const strip16 = b64('neonbyte-landing16-strip.webp'); // 4096x256 transparent
const sheet16 = b64('neonbyte-landing16-sheet.webp'); // 1024x1024 4x4
const neonbyteHero = b64('neonbyte-hero.png');
const neonbyteSheet = b64('neonbyte-spritesheet.png');
const emberfoxHero = b64('emberfox-hero.png');

console.log('✦ Assets embedded:');
console.log('  16-frame strip:', strip16 ? Math.round(strip16.length / 1024) + ' KB' : 'MISSING');
console.log('  4x4 sheet:', sheet16 ? Math.round(sheet16.length / 1024) + ' KB' : 'MISSING');

const N = 16, FW = 256, FH = 256;
const SHEET_W = FW * N;
const LAST = (N - 1) * FW;

const html = `<!DOCTYPE html>
<html lang="vi" data-theme="cyber">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHoot — 16-Frame Superhero Landing (Nano Banana 2) cho @mrgoonie</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{
      --bg-base:#07090E;--bg-1:#0D111A;--bg-2:#141B27;--bg-3:#1C2637;
      --border:rgba(0,240,255,.14);--border-strong:rgba(0,240,255,.35);
      --txt:#F0F6FC;--txt-2:#8B9BB4;--txt-3:#53627A;
      --cyan:#00F0FF;--magenta:#FF2A85;--amber:#FFA800;--green:#00FF88;--purple:#9945FF;
      --glow-cyan:0 0 24px rgba(0,240,255,.35);--glow-mag:0 0 24px rgba(255,42,133,.35);
      --card:0 12px 40px rgba(0,0,0,.75),0 0 0 1px var(--border);
      --f-disp:'Archivo',sans-serif;--f-body:'Schibsted Grotesk',sans-serif;--f-mono:'JetBrains Mono',monospace;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg-base);color:var(--txt);font-family:var(--f-body);line-height:1.6;
      background-image:radial-gradient(circle at 15% 15%,rgba(0,240,255,.07)0,transparent 45%),radial-gradient(circle at 85% 30%,rgba(255,42,133,.06)0,transparent 50%),radial-gradient(circle at 50% 85%,rgba(153,69,255,.07)0,transparent 50%);
      background-attachment:fixed;padding:32px 20px 100px}
    .wrap{max-width:1320px;margin:0 auto}
    .nav{display:flex;justify-content:space-between;align-items:center;padding-bottom:24px;border-bottom:1px solid var(--border);margin-bottom:36px;flex-wrap:wrap;gap:12px}
    .logo{display:flex;align-items:center;gap:12px;color:#FFF;font-family:var(--f-disp);font-size:22px;font-weight:900;text-decoration:none}
    .logo .ic{width:36px;height:36px;background:linear-gradient(135deg,var(--cyan),var(--magenta));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:var(--glow-cyan)}
    .tags{display:flex;gap:8px;flex-wrap:wrap}
    .tag{font-family:var(--f-mono);font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:.05em}
    .t-cyan{background:rgba(0,240,255,.1);color:var(--cyan);border:1px solid rgba(0,240,255,.3)}
    .t-mag{background:rgba(255,42,133,.1);color:var(--magenta);border:1px solid rgba(255,42,133,.3)}
    .t-amber{background:rgba(255,168,0,.1);color:var(--amber);border:1px solid rgba(255,168,0,.3)}
    .t-green{background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.3)}
    .banner{background:linear-gradient(135deg,var(--bg-1),var(--bg-2));border:1px solid var(--border);border-radius:12px;padding:34px 30px;margin-bottom:26px;box-shadow:var(--card);position:relative;overflow:hidden}
    .banner::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--cyan),var(--magenta),transparent)}
    .banner h1{font-family:var(--f-disp);font-size:clamp(26px,4vw,38px);font-weight:900;line-height:1.15;margin-bottom:10px;text-wrap:balance;background:linear-gradient(135deg,#FFF 20%,var(--cyan)70%,var(--magenta)100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .banner p{color:var(--txt-2);font-size:15px;max-width:980px;text-wrap:pretty}
    .status-card{background:rgba(0,255,136,.06);border:1px solid var(--green);border-radius:10px;padding:16px 20px;margin-bottom:26px;display:flex;gap:16px;align-items:flex-start}
    .status-card .icn{font-size:24px;line-height:1}
    .status-card h3{font-family:var(--f-disp);font-size:14px;color:var(--green);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
    .status-card p{font-size:13px;color:var(--txt-2);margin-bottom:5px}
    .status-card code{font-family:var(--f-mono);color:var(--cyan);background:rgba(0,0,0,.4);padding:1px 6px;border-radius:4px;font-size:12px}
    .steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:32px}
    .step{background:var(--bg-2);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px;cursor:pointer;transition:all .2s}
    .step:hover,.step.on{border-color:var(--cyan);background:var(--bg-3);box-shadow:var(--glow-cyan);transform:translateY(-2px)}
    .step .n{font-family:var(--f-mono);font-size:11px;color:var(--cyan);font-weight:700;margin-bottom:4px}
    .step .t{font-family:var(--f-disp);font-weight:700;font-size:14px;color:#FFF}
    .card{background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:32px;margin-bottom:40px;box-shadow:var(--card)}
    .card h2{font-family:var(--f-disp);font-size:22px;font-weight:800;color:#FFF;display:flex;align-items:center;gap:12px;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:14px}
    .pill{font-family:var(--f-mono);color:var(--cyan);font-size:13px;background:rgba(0,240,255,.1);padding:3px 10px;border-radius:4px;border:1px solid rgba(0,240,255,.25)}
    .view{background:#05070B;border:2px solid var(--border-strong);border-radius:10px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.9);margin:18px 0;position:relative}
    .bar{background:var(--bg-2);padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px}
    .dots{display:flex;gap:6px}.d{width:10px;height:10px;border-radius:50%}.dr{background:#FF5F56}.dy{background:#FFBD2E}.dg{background:#27C93F}
    .url{flex:1;background:var(--bg-base);border:1px solid rgba(0,240,255,.2);border-radius:4px;padding:4px 12px;font-family:var(--f-mono);font-size:12px;color:var(--cyan)}
    .content{padding:28px 24px;min-height:520px;background:radial-gradient(circle at center,rgba(13,17,26,.9)0,#07090E 100%);position:relative;overflow:hidden}
    .s4grid{display:grid;grid-template-columns:320px 1fr;gap:28px;align-items:start}
    @media(max-width:900px){.s4grid{grid-template-columns:1fr}}
    .player-col{display:flex;flex-direction:column;align-items:center;min-width:0}
    .frame-view{width:${FW}px;height:${FH}px;border:2px solid var(--cyan);border-radius:8px;box-shadow:var(--glow-cyan);background-color:var(--bg-2);
      background-image:radial-gradient(circle at 50% 82%,rgba(0,240,255,.14),transparent 62%)}
    .frame-sprite{width:${FW}px;height:${FH}px;
      background-image:url('${strip16}');background-repeat:no-repeat;background-size:${SHEET_W}px ${FH}px;background-position:0 0;
      image-rendering:pixelated;filter:drop-shadow(0 0 14px rgba(0,240,255,.45))}
    .frame-sprite.play{animation:runFrames var(--dur,1.1s) steps(${N - 1}) forwards}
    @keyframes runFrames{from{background-position:0 0}to{background-position:-${LAST}px 0}}
    .shake.on{animation:shk .55s cubic-bezier(.36,.07,.19,.97) both}
    @keyframes shk{10%,90%{transform:translate3d(-4px,5px,0) rotate(-.6deg)}20%,80%{transform:translate3d(6px,-6px,0) rotate(.8deg)}30%,50%,70%{transform:translate3d(-8px,7px,0) rotate(-1deg)}40%,60%{transform:translate3d(8px,-5px,0) rotate(.8deg)}100%{transform:none}}
    #vfx{position:absolute;inset:0;pointer-events:none;z-index:15}
    .fstatus{font-family:var(--f-mono);font-size:12px;color:var(--cyan);font-weight:700;margin-top:10px;text-align:center;min-height:30px}
    .ctrls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px}
    .btn{background:linear-gradient(135deg,var(--cyan),var(--magenta));color:#000;font-family:var(--f-disp);font-weight:900;font-size:13px;padding:9px 18px;border-radius:6px;border:none;cursor:pointer;text-transform:uppercase;letter-spacing:.04em;box-shadow:0 4px 20px rgba(0,240,255,.4);transition:all .15s}
    .btn:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(255,42,133,.5)}
    .btn:focus-visible{outline:3px solid var(--amber);outline-offset:2px}
    .pillbtn{background:var(--bg-3);border:1px solid rgba(255,255,255,.15);color:var(--txt);font-family:var(--f-mono);font-size:12px;padding:6px 14px;border-radius:20px;cursor:pointer;transition:all .15s}
    .pillbtn:hover,.pillbtn.on{background:var(--cyan);color:#000;font-weight:700;border-color:var(--cyan);box-shadow:var(--glow-cyan)}
    .pillbtn:focus-visible{outline:3px solid var(--amber);outline-offset:2px}
    .scrub-box{background:#040508;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:14px 16px;margin-top:18px;min-width:0}
    .scrub-h{display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:12px;color:var(--txt-2);margin-bottom:8px}
    .scrub{width:100%;height:8px;border-radius:4px;background:var(--bg-3);accent-color:var(--cyan);cursor:pointer}
    .strip{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin-top:14px}
    .cellthumb{border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:3px;cursor:pointer;transition:all .15s;background:var(--bg-2)}
    .cellthumb:hover,.cellthumb.on{border-color:var(--cyan);box-shadow:0 0 10px rgba(0,240,255,.4)}
    .cellthumb .th{width:100%;height:46px;background-image:url('${strip16}');background-repeat:no-repeat;background-size:1600% 100%;border-radius:2px;image-rendering:pixelated}
    .cellthumb .lb{font-family:var(--f-mono);font-size:9px;color:var(--txt-3);margin-top:3px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sheet-box{border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-2)}
    .sheet-box .hd{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);font-family:var(--f-mono);font-size:11px;color:var(--txt-2)}
    .sheet-box img{width:100%;display:block;image-rendering:pixelated}
    pre{background:#040508;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:14px;font-family:var(--f-mono);font-size:12px;color:var(--txt-2);overflow-x:auto;line-height:1.5;margin-top:10px}
    .note{color:var(--amber);font-size:12px;margin-top:8px}
    .foot{text-align:center;margin-top:56px;color:var(--txt-3);font-size:13px;font-family:var(--f-mono);border-top:1px solid var(--border);padding-top:24px}
    @media (prefers-reduced-motion: reduce){.shake.on{animation:none}.frame-sprite.play{animation:none}}
  </style>
</head>
<body>
<div class="wrap">
  <nav class="nav">
    <a href="/" class="logo"><span class="ic">🦉</span><span>GitHoot</span></a>
    <div class="tags">
      <span class="tag t-cyan">Profile: @mrgoonie</span>
      <span class="tag t-green">Nano Banana 2 · nano-banana-pro-preview</span>
      <span class="tag t-mag">16 pose · 4x4 sheet</span>
      <span class="tag t-amber">Identity-conditioned</span>
    </div>
  </nav>

  <header class="banner">
    <h1>16-Frame Superhero Landing Reveal cho @mrgoonie</h1>
    <p>Spritesheet 16 pose (4x4, frame ${FW}x${FH}) cho màn hatch Guardian <strong>Aether Neonbyte</strong> — animation mượt hơn hẳn mức 8 pose. Mỗi frame được sinh <strong>riêng lẻ</strong> bằng Gemini <strong>Nano Banana 2</strong> với ảnh Guardian đã commit làm reference, nên nhân vật giữ đúng danh tính (immutable Guardian DNA).</p>
  </header>

  <div class="status-card">
    <div class="icn">✅</div>
    <div>
      <h3>Render thật · Nano Banana 2 · giữ nguyên danh tính Guardian</h3>
      <p>16 lần gọi riêng, mỗi lần 1 pose, model <code>nano-banana-pro-preview</code> (allowlist Nano Banana 2/Pro, không fallback model cũ). Reference identity = <code>neonbyte-gemini-raw.jpg</code> đã commit ⇒ nhân vật không bị đổi.</p>
      <p>Mỗi ảnh tách nền chroma <code>#00FF00</code>, dò <strong>contour toàn ảnh</strong> rồi căn giữa vào frame ${FW}x${FH} — không cắt theo offset lưới cố định. Cổng kiểm duyệt loại bỏ ảnh collage/nhiều nhân vật và tự render lại; frame cache cũng được kiểm lại mỗi lần chạy.</p>
      <p>Key <code>GEMINI_API_KEY</code> đọc out-of-band từ <code>.env</code> local (không in ra session, không commit).</p>
    </div>
  </div>

  <div class="steps">
    <div class="step" onclick="show(1,this)"><div class="n">MÀN HÌNH 01</div><div class="t">Khách vãng lai & Trứng</div></div>
    <div class="step" onclick="show(2,this)"><div class="n">MÀN HÌNH 02</div><div class="t">OAuth & DNA Seed</div></div>
    <div class="step" onclick="show(3,this)"><div class="n">MÀN HÌNH 03</div><div class="t">Hàng đợi AI</div></div>
    <div class="step on" onclick="show(4,this)"><div class="n">MÀN HÌNH 04 ⚡</div><div class="t">16-Frame Landing Player</div></div>
    <div class="step" onclick="show(5,this)"><div class="n">MÀN HÌNH 05</div><div class="t">Profile & Pet Live</div></div>
    <div class="step" onclick="show(6,this)"><div class="n">MÀN HÌNH 06</div><div class="t">Dev Chemistry</div></div>
  </div>

  <section id="s4" class="screen">
    <div class="card">
      <h2><span class="pill">SCREEN 04 ⚡</span> Frame-by-Frame Superhero Landing (16 khung)</h2>
      <p style="color:var(--txt-2);margin-bottom:8px;">Phát mượt qua <code style="font-family:var(--f-mono);color:var(--cyan)">steps(${N - 1})</code>: bay lơ lửng → lao xuống → bổ nhào → tiếp cận → <strong>tiếp đất 3 điểm (F7)</strong> → khựng nứt sàn (F8) → sóng xung kích (F9) → bật lại &amp; đứng dậy → bừng hào quang (F14) → thế đứng anh hùng (F16). Kéo thanh trượt hoặc bấm ô filmstrip để soi từng khung.</p>

      <div class="view">
        <div class="bar"><div class="dots"><span class="d dr"></span><span class="d dy"></span><span class="d dg"></span></div><div class="url">🔒 https://githoot.com/hatch/reveal/mrgoonie</div></div>
        <div class="content" id="stage">
          <canvas id="vfx"></canvas>
          <div class="s4grid">
            <div class="player-col">
              <div class="shake" id="shake">
                <div class="frame-view"><div class="frame-sprite play" id="sprite"></div></div>
              </div>
              <div class="fstatus" id="fstatus">⚡ Frame ${N}/${N} · Thế đứng anh hùng</div>
              <div class="ctrls">
                <button class="btn" onclick="play(1.1)">▶ Replay (1.1s)</button>
                <button class="pillbtn" onclick="play(4.4)">🐌 Slow-Mo</button>
              </div>
            </div>
            <div class="sheet-box">
              <div class="hd"><span>Spritesheet 4x4 · 16 pose · Nano Banana 2</span><span style="color:var(--green)">1024x1024 · alpha</span></div>
              <img src="${sheet16}" alt="Spritesheet 4x4 gồm 16 pose superhero landing của Aether Neonbyte, nền trong suốt">
              <div style="padding:10px 14px;font-size:12px;color:var(--txt-2)">Asset production: <code style="font-family:var(--f-mono);color:var(--cyan)">neonbyte-landing16-sheet.png</code> (4x4, ${FW}² mỗi frame) + <code style="font-family:var(--f-mono);color:var(--cyan)">neonbyte-landing16-strip.png</code> (${SHEET_W}x${FH}) cho CSS steps player.</div>
              <div style="padding:0 14px 12px" class="note">⚠️ Muốn render lại 1 frame: xoá <code style="font-family:var(--f-mono);color:var(--cyan)">assets/sample-pets/landing16-frames/fNN.png</code> rồi chạy <code style="font-family:var(--f-mono);color:var(--cyan)">RESUME=1 node scripts/gen-landing16.mjs neonbyte</code>.</div>
            </div>
          </div>

          <!-- Scrubber + filmstrip: full width below the grid so all 16 thumbs fit -->
          <div class="scrub-box">
            <div class="scrub-h"><span>TUA KHUNG (1–${N})</span><span id="scrubLbl" style="color:var(--amber);font-weight:700">Frame ${N}</span></div>
            <input type="range" min="1" max="${N}" value="${N}" step="1" class="scrub" id="slider" oninput="goto(this.value)">
            <div class="strip" id="strip"></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="s1" class="screen" style="display:none"><div class="card"><h2><span class="pill">SCREEN 01</span> Khách vãng lai & Trứng (0 AI cost)</h2><p style="color:var(--txt-2);margin-bottom:16px">Trứng Canvas/SVG Neon Byte Core rung theo 1,420 commits của @mrgoonie, không tốn chi phí AI.</p><button class="btn" onclick="show(2)">🥚 Claim & Hatch</button></div></section>
  <section id="s2" class="screen" style="display:none"><div class="card"><h2><span class="pill">SCREEN 02</span> OAuth & DNA Seed bất biến</h2><pre>seed  = SHA-256("githoot:dna:v1:11829471")
species = "Aether Neonbyte"   element = "Cyber / Fire"
rarity  = "Epic" (top 13%)    archetype = "The Midnight Forgemaster"</pre><button class="btn" onclick="show(3)" style="margin-top:14px">⚡ Khởi động hàng đợi AI</button></div></section>
  <section id="s3" class="screen" style="display:none"><div class="card"><h2><span class="pill">SCREEN 03</span> Hàng đợi Gemini (16 frame)</h2><pre>[.] GitHub telemetry snapshot (48 repos, 1.4k commits)
[.] 16 prompt pose + reference identity (neonbyte-gemini-raw.jpg)
[.] Nano Banana 2 (nano-banana-pro-preview) x16 frame
[.] Chroma #00FF00 de-spill + contour centering (${FW}²)
[.] Composite 4x4 sheet + 16-frame strip -> cdn.githoot.com</pre><p class="note">⚠️ 16 lần gọi mất ~6 phút ở batch đầu (không phù hợp hatch realtime; production nên chạy async qua Cloudflare Queue rồi thông báo khi asset sẵn sàng).</p><button class="btn" onclick="show(4)" style="margin-top:14px">⚡ Xem 16-Frame Landing</button></div></section>
  <section id="s5" class="screen" style="display:none"><div class="card"><h2><span class="pill">SCREEN 05</span> Profile đã claim & Pet live</h2>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:28px;align-items:center">
      <div style="background:var(--bg-2);border:2px solid var(--cyan);border-radius:12px;padding:22px;text-align:center;box-shadow:var(--glow-cyan)">
        <img id="livePet" src="${neonbyteHero}" alt="Aether Neonbyte hero portrait" style="width:220px;height:220px;object-fit:contain;filter:drop-shadow(0 0 20px rgba(0,240,255,.4))">
        <div style="margin-top:10px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
          <button class="pillbtn on" onclick="live('hero',this)">Hero</button>
          <button class="pillbtn" onclick="live('sheet',this)">Emotion sheet</button>
          <button class="pillbtn" onclick="live('ember',this)">Emberfox</button>
        </div>
      </div>
      <div>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><span class="tag t-mag">EPIC</span><span class="tag t-green">STAGE I</span><span class="tag t-amber">LV.14 · 4,280 EXP</span></div>
        <h3 style="font-family:var(--f-disp);font-size:28px;color:#FFF">Aether Neonbyte</h3>
        <div style="font-family:var(--f-mono);color:var(--cyan);font-size:13px;margin-bottom:14px">Guardian của @mrgoonie · Hệ Cyber/Fire</div>
        <div style="background:var(--bg-3);padding:14px;border-radius:8px;border:1px solid rgba(255,255,255,.06)">
          <div style="display:flex;justify-content:space-between;font-family:var(--f-mono);font-size:11px;margin-bottom:6px"><span style="color:var(--cyan)">⚡ VITALITY</span><span style="color:var(--green)">100% Nocturnal Peak</span></div>
          <div style="background:rgba(0,0,0,.5);height:6px;border-radius:9999px;overflow:hidden"><div style="width:100%;height:100%;background:var(--green);box-shadow:0 0 8px var(--green)"></div></div>
          <div style="font-size:11px;color:var(--txt-3);margin-top:6px">💡 Pet không bao giờ chết. Không commit &gt;30 ngày → 💤 Ngủ đông.</div>
        </div>
        <pre>[![GitHoot](https://cdn.githoot.com/badge/mrgoonie.svg)](https://githoot.com/mrgoonie)</pre>
      </div>
    </div></div></section>
  <section id="s6" class="screen" style="display:none"><div class="card"><h2><span class="pill">SCREEN 06</span> Dev Chemistry (/chem/mrgoonie/octocat)</h2>
    <div style="display:flex;justify-content:space-around;align-items:center;gap:20px;flex-wrap:wrap;text-align:center">
      <div style="background:var(--bg-2);border:1px solid var(--cyan);border-radius:10px;padding:18px;width:200px"><img src="${neonbyteHero}" style="width:120px;height:120px;object-fit:contain" alt="Neonbyte"><h4 style="color:#FFF;font-family:var(--f-disp);margin-top:6px">@mrgoonie</h4><div style="color:var(--cyan);font-family:var(--f-mono);font-size:11px">Neonbyte · Epic</div></div>
      <div><div style="font-family:var(--f-disp);font-size:44px;font-weight:900;color:var(--magenta);text-shadow:var(--glow-mag)">94%</div><div style="font-family:var(--f-mono);font-size:11px;color:var(--amber);font-weight:700">DUYÊN TIỀN ĐỊNH</div></div>
      <div style="background:var(--bg-2);border:1px solid var(--magenta);border-radius:10px;padding:18px;width:200px"><img src="${emberfoxHero}" style="width:120px;height:120px;object-fit:contain" alt="Emberfox"><h4 style="color:#FFF;font-family:var(--f-disp);margin-top:6px">@octocat</h4><div style="color:var(--magenta);font-family:var(--f-mono);font-size:11px">Emberfox · Legendary</div></div>
    </div>
    <button class="btn" onclick="show(4)" style="margin-top:20px">⚡ Về 16-Frame Landing</button></div></section>

  <footer class="foot">GitHoot Engine v2.0 · 16-Frame Landing · Gemini Nano Banana 2 (nano-banana-pro-preview) · identity-conditioned</footer>
</div>

<script>
  var N=${N}, FW=${FW};
  var labels=['Bay lơ lửng','Lao xuống','Dive dốc','Bổ nhào','Tiếp cận','Trước va chạm','Tiếp đất 3 điểm','Khựng nứt sàn','Sóng xung kích','Bật lại','Nhấc gối','Vươn lên','Đứng dậy','Bừng hào quang','Ưỡn ngực','Thế anh hùng'];
  var timer=null;
  function show(n,el){
    for(var i=1;i<=6;i++){var s=document.getElementById('s'+i);if(s)s.style.display=(i===n)?'block':'none';}
    document.querySelectorAll('.step').forEach(function(s,idx){s.classList.toggle('on',idx===(n-1));});
    if(n===4) setTimeout(function(){play(1.1);},80);
    window.scrollTo({top:120,behavior:'smooth'});
  }
  function mark(k){
    document.getElementById('slider').value=k+1;
    document.getElementById('scrubLbl').textContent='Frame '+(k+1);
    document.getElementById('fstatus').textContent='Frame '+(k+1)+'/'+N+' · '+labels[k];
    document.querySelectorAll('.cellthumb').forEach(function(c,i){c.classList.toggle('on',i===k);});
  }
  function setFrame(k){ document.getElementById('sprite').style.backgroundPosition=(-k*FW)+'px 0'; mark(k); }
  function goto(v){ if(timer){clearInterval(timer);timer=null;} var s=document.getElementById('sprite'); s.classList.remove('play'); var k=parseInt(v)-1; setFrame(k); if(k===6||k===7||k===8) impact(); }
  function play(sec){
    var s=document.getElementById('sprite'), shake=document.getElementById('shake');
    if(timer){clearInterval(timer);timer=null;}
    s.classList.remove('play'); void s.offsetWidth;
    s.style.setProperty('--dur',sec+'s'); s.style.backgroundPosition='0 0'; mark(0); s.classList.add('play');
    var k=0, per=(sec*1000)/N;
    timer=setInterval(function(){
      k++;
      if(k>N-1){clearInterval(timer);timer=null;mark(N-1);return;}
      mark(k);
      if(k===7){ shake.classList.add('on'); impact(); setTimeout(function(){shake.classList.remove('on');},560); }
    },per);
  }
  function live(t,btn){
    var img=document.getElementById('livePet');
    btn.parentElement.querySelectorAll('.pillbtn').forEach(function(b){b.classList.remove('on');});
    btn.classList.add('on');
    if(t==='hero')img.src='${neonbyteHero}'; else if(t==='sheet')img.src='${neonbyteSheet}'; else if(t==='ember')img.src='${emberfoxHero}';
  }
  function impact(){
    var c=document.getElementById('vfx'); if(!c)return;
    var stage=document.getElementById('stage'); c.width=stage.offsetWidth; c.height=stage.offsetHeight;
    var ctx=c.getContext('2d'), ox=c.width*0.22, oy=c.height*0.55, P=[], col=['#00F0FF','#FF2A85','#FFA800','#FFF','#9945FF'];
    for(var i=0;i<80;i++){var a=Math.random()*Math.PI*2,sp=Math.random()*8+3;
      P.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp*.7-Math.random()*3,s:Math.random()*3.5+1.5,c:col[i%5],al:1,dc:Math.random()*.025+.02,g:.2});}
    function r(){ctx.clearRect(0,0,c.width,c.height);var alive=false;
      for(var i=0;i<P.length;i++){var p=P[i];if(p.al>0){alive=true;ctx.save();ctx.globalAlpha=p.al;ctx.fillStyle=p.c;ctx.shadowBlur=8;ctx.shadowColor=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,7);ctx.fill();ctx.restore();p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.al-=p.dc;}}
      if(alive)requestAnimationFrame(r);else ctx.clearRect(0,0,c.width,c.height);}
    requestAnimationFrame(r);
  }
  (function(){
    var strip=document.getElementById('strip');
    for(var k=0;k<N;k++){
      var cell=document.createElement('div');cell.className='cellthumb'+(k===N-1?' on':'');
      cell.onclick=(function(kk){return function(){goto(kk+1);};})(k);
      var th=document.createElement('div');th.className='th';
      th.style.backgroundPosition=(k*(100/(N-1)))+'% 0';
      var lb=document.createElement('div');lb.className='lb';lb.textContent='F'+(k+1)+' '+labels[k];
      if(k===6)lb.style.color='var(--magenta)'; if(k===N-1)lb.style.color='var(--cyan)';
      cell.appendChild(th);cell.appendChild(lb);strip.appendChild(cell);
    }
  })();
  window.addEventListener('DOMContentLoaded',function(){setTimeout(function(){play(1.1);},400);});
</script>
</body>
</html>
`;

const out = path.join(__dirname, '..', 'plans', 'reports', 'brainstorm-pet-generation-pipeline.html');
fs.writeFileSync(out, html);
console.log('✓ wrote', out);
const root = path.join(__dirname, '..', 'brainstorm.html');
fs.writeFileSync(root, html);
console.log('✓ wrote', root);
