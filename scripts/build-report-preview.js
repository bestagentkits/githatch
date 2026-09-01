// ============================================================================
// Report Preview Builder (scripts/build-report-preview.js)
// Renders an accepted brainstorm/verification report as a self-contained
// industrial-register HTML dossier.
//
// Design register deviation is approved as a one-off in AGENTS.md invariant 8
// for the single output file named below. Not a product surface.
//
// Usage: node scripts/build-report-preview.js [input.md] [output.html]
// ============================================================================

import fs from 'fs';
import path from 'path';

const IN = process.argv[2] || 'plans/reports/brainstorm-260830-marketing-website-redesign-ACCEPTED.md';
const OUT = process.argv[3] || IN.replace(/\.md$/, '.html');

// ---------------------------------------------------------------------------
// Verifier score matrix. Real values from the ultra verifier verdict.
// ---------------------------------------------------------------------------
const CRITERIA = [
  'Faithfulness',
  'Evidence grounding',
  'Acceptance sharpness',
  'Honesty about unknowns',
  'Conversion clarity / CTA truth',
  'Trust / data-state integrity',
  'Demo fidelity / payload discipline',
  'Responsive / accessible proof',
  'Shared-surface / route integrity',
  'Measurement usefulness',
  'Narrative discrimination'
];
const SCORES = {
  A: [19, 19, 18, 20, 19, 20, 18, 20, 19, 20, 19],
  B: [18, 15, 16, 17, 16, 17, 16, 18, 13, 19, 18],
  C: [12, 12, 13, 9, 16, 11, 14, 17, 18, 18, 13],
  D: [15, 15, 13, 16, 14, 15, 12, 15, 14, 18, 16],
  E: [13, 14, 14, 16, 19, 14, 17, 17, 13, 18, 19]
};
const WINNER = 'A';
const TRUTH = {
  A: { status: 'PASS', note: 'No hard-rule violation. Repository link ships only after a recorded HTTP 200, otherwise omitted.' },
  B: { status: 'FAIL', note: 'Rule 7. Footer links the configured git origin, which is not in the verified-200 set, while admitting visibility is unknown.' },
  C: { status: 'PASS', note: 'No hard-rule violation. Separately loses heavily on honesty: copy asserts "We launched yesterday" against the binding pre-launch state.' },
  D: { status: 'PASS', note: 'No hard-rule violation. Quality defects only: steps(16) instead of the packet-backed steps(15), and a fear-based CTA.' },
  E: { status: 'FAIL', note: 'Rule 7. Unconditionally links the configured git origin, excluded by its own verified-external set. Also omits the requested author quote.' }
};

// ---------------------------------------------------------------------------
// Measured byte ledger. Every figure controller-measured this session.
// ---------------------------------------------------------------------------
const LEDGER = [
  { group: 'Client entry (what every visitor downloads)', rows: [
    ['index.html', 847, 'raw'],
    ['assets/index-*.css', 2741, 'raw'],
    ['assets/index-*.js', 260803, 'raw'],
    ['Critical entry total', 264391, 'raw'],
    ['Critical entry total', 77897, 'gzip']
  ]},
  { group: 'Shipped weight', rows: [
    ['dist/ total (58 files)', 34835846, 'raw'],
    ['design.html', 8870252, 'raw'],
    ['_worker.js (server, not client)', 118128, 'raw']
  ]},
  { group: 'Dead weight referenced by nothing', rows: [
    ['-gemini-raw.jpg x8', 6648896, 'raw'],
    ['landing16-frames/ x16', 1365519, 'raw'],
    ['landing16 PNGs x2', 2802548, 'raw'],
    ['Removable subtotal', 10816963, 'raw']
  ]},
  { group: 'Demo and remote assets', rows: [
    ['neonbyte-landing16-strip.webp', 286362, 'raw'],
    ['emotion sheets x8 (eager-load hazard)', 6539997, 'raw'],
    ['Zuey avatar source (remote; contract lazy-loads a local 96x96 WebP)', 282949, 'raw']
  ]}
];

const RISKS = [
  ['Motion-token inconsistency', 'The contract claims only the 100-150 / 200-300 / 800-1200ms bands while also specifying 4,400ms slow motion and an existing 1,500ms quota pulse. Treat these as declared ambient exceptions or the duration gate contradicts the design.'],
  ['Estimated transfer lines are gates, not facts', 'Poster 40,000 B, fonts 90,000 B, avatar 12,000 B are labelled caps. They must be measured post-build, and the network manifest must include the Google Fonts stylesheet and the quota response.'],
  ['Nullable quota cutover', 'Setting claimed and remaining to null on degradation requires updating EarlyAccessStatus and every consumer. Today the client catch leaves quota === null silently at main.tsx:31.'],
  ['375x812 feasibility is prose, not proof', 'Sticky navbar plus four above-fold comprehension elements plus the poster must pass the contract\u2019s own screenshot and rect checks before acceptance.'],
  ['Creator quote needs owner approval', 'Zuey is correctly framed as creator attribution, but the first-person quote is proposed copy. Confirm before publishing.'],
  ['Intentional language seam', 'The explore, design, docs and profile surfaces stay Vietnamese and are marked lang="vi". Preserve that boundary; do not imply they were translated.']
];

// ---------------------------------------------------------------------------
// Minimal, deterministic Markdown to HTML
// ---------------------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return t;
}

function splitFrontmatter(md) {
  if (!md.startsWith('---')) return { meta: {}, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { meta: {}, body: md };
  const meta = {};
  for (const line of md.slice(4, end).split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body: md.slice(end + 4) };
}

function renderTable(lines) {
  const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(lines[0]);
  const align = cells(lines[1]).map((a) => (a.endsWith(':') ? (a.startsWith(':') ? 'center' : 'right') : 'left'));
  let out = '<div class="tw"><table><thead><tr>';
  head.forEach((h, i) => { out += `<th style="text-align:${align[i] || 'left'}">${inline(h)}</th>`; });
  out += '</tr></thead><tbody>';
  for (const l of lines.slice(2)) {
    const row = cells(l);
    out += '<tr>';
    row.forEach((c, i) => { out += `<td style="text-align:${align[i] || 'left'}">${inline(c)}</td>`; });
    out += '</tr>';
  }
  return out + '</tbody></table></div>';
}

// Returns [{ id, title, html }] split on top-level `# ` headings.
function renderSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let cur = null;
  let buf = [];
  let i = 0;

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const flushList = (stack) => { let o = ''; while (stack.length) o += stack.pop() === 'ol' ? '</ol>' : '</ul>'; return o; };

  const renderBlock = (blk) => {
    let out = '';
    const listStack = [];
    let para = [];
    const flushPara = () => {
      if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para = []; }
    };
    for (let j = 0; j < blk.length; j++) {
      const raw = blk[j];
      const line = raw.trimEnd();

      if (/^\s*$/.test(line)) { flushPara(); out += flushList(listStack); continue; }

      if (/^\|/.test(line) && blk[j + 1] && /^\|[\s:|-]+\|?$/.test(blk[j + 1].trim())) {
        flushPara(); out += flushList(listStack);
        const t = [];
        while (j < blk.length && /^\|/.test(blk[j].trim())) { t.push(blk[j].trim()); j++; }
        j--;
        out += renderTable(t);
        continue;
      }

      const h = line.match(/^(#{2,6})\s+(.*)$/);
      if (h) {
        flushPara(); out += flushList(listStack);
        const lvl = Math.min(h[1].length + 1, 6);
        out += `<h${lvl} id="${slug(h[2])}">${inline(h[2])}</h${lvl}>`;
        continue;
      }

      if (/^(---|\*\*\*)\s*$/.test(line)) { flushPara(); out += flushList(listStack); out += '<hr>'; continue; }

      if (/^>\s?/.test(line)) {
        flushPara(); out += flushList(listStack);
        const q = [];
        while (j < blk.length && /^>\s?/.test(blk[j])) { q.push(blk[j].replace(/^>\s?/, '')); j++; }
        j--;
        out += `<blockquote>${inline(q.join(' '))}</blockquote>`;
        continue;
      }

      const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      const ul = line.match(/^(\s*)[-*]\s+(.*)$/);
      if (ol || ul) {
        flushPara();
        const want = ol ? 'ol' : 'ul';
        if (!listStack.length || listStack[listStack.length - 1] !== want) {
          out += flushList(listStack);
          out += want === 'ol' ? '<ol>' : '<ul>';
          listStack.push(want);
        }
        out += `<li>${inline(ol ? ol[3] : ul[2])}</li>`;
        continue;
      }

      para.push(line.trim());
    }
    flushPara();
    out += flushList(listStack);
    return out;
  };

  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.*)$/);
    if (m) {
      if (cur) sections.push({ ...cur, html: renderBlock(buf) });
      cur = { id: slug(m[1]), title: m[1] };
      buf = [];
    } else if (cur) buf.push(lines[i]);
  }
  if (cur) sections.push({ ...cur, html: renderBlock(buf) });
  return sections;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
const fmt = (n) => n.toLocaleString('en-US');

function scoreMatrix() {
  const cols = Object.keys(SCORES);
  let out = '<div class="tw"><table class="matrix"><thead><tr><th class="crit">Rubric criterion</th>';
  for (const c of cols) {
    out += `<th class="num${c === WINNER ? ' win' : ''}">${c === WINNER ? 'Winner' : c}</th>`;
  }
  out += '</tr></thead><tbody>';
  CRITERIA.forEach((name, i) => {
    out += `<tr><td class="crit"><span class="cn">${String(i + 1).padStart(2, '0')}</span>${name}</td>`;
    for (const c of cols) {
      const v = SCORES[c][i];
      const pct = (v / 20) * 100;
      out += `<td class="num${c === WINNER ? ' win' : ''}"><span class="bar"><i style="width:${pct}%"></i></span><b>${v}</b></td>`;
    }
    out += '</tr>';
  });
  out += '<tr class="tot"><td class="crit">Total <span class="dim">/ 220</span></td>';
  for (const c of cols) {
    const t = SCORES[c].reduce((a, b) => a + b, 0);
    out += `<td class="num${c === WINNER ? ' win' : ''}"><b>${t}</b></td>`;
  }
  return out + '</tr></tbody></table></div>';
}

function truthRows() {
  return Object.entries(TRUTH).map(([k, v]) => `
    <div class="tr-row${k === WINNER ? ' is-win' : ''}">
      <span class="tr-id">${k === WINNER ? 'Winner' : 'Cand ' + k}</span>
      <span class="tr-st ${v.status === 'PASS' ? 'ok' : 'no'}">${v.status}</span>
      <p class="tr-note">${esc(v.note)}</p>
    </div>`).join('');
}

function ledger() {
  return LEDGER.map((g) => `
    <section class="lg-group">
      <h3 class="lg-h">${esc(g.group)}</h3>
      <dl class="lg-dl">
        ${g.rows.map(([label, bytes, basis]) => `
          <div class="lg-r">
            <dt>${esc(label)}</dt>
            <dd><b>${fmt(bytes)}</b><span class="u">B ${basis}</span></dd>
          </div>`).join('')}
      </dl>
    </section>`).join('');
}

function risks() {
  return RISKS.map(([t, d], i) => `
    <div class="rk">
      <span class="rk-n">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>
    </div>`).join('');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const md = fs.readFileSync(IN, 'utf8');
const { meta, body } = splitFrontmatter(md);
// Derived, never hard-coded: the source document grows as corrections land.
const srcLines = md.split('\n').filter((l, i, a) => i < a.length - 1 || l.length > 0).length;
// The source document's own title heading duplicates the masthead; drop it so it
// does not appear as a contract section in the index or the accordion.
const sections = renderSections(body).filter((s) => !/^githoot marketing website redesign/i.test(s.title));

const NAV = [
  { id: 'verdict', title: 'Verdict' },
  { id: 'matrix', title: 'Score matrix' },
  { id: 'truth', title: 'Truth-rule audit' },
  { id: 'ledger', title: 'Measured ledger' },
  { id: 'risks', title: 'Residual risks' },
  ...sections.map((s) => ({ id: 'doc-' + s.id, title: s.title }))
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.subject || 'Accepted report')} — verification dossier</title>
<meta name="description" content="Verification dossier for the accepted GitHoot marketing website brainstorm contract.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{
  /* Neutral ramp: concrete, tinted toward the project hue (220) per AGENTS.md 8(b) */
  --bg:oklch(0.964 0.004 220);
  --surface:oklch(0.988 0.003 220);
  --sunk:oklch(0.930 0.006 220);
  --ink:oklch(0.220 0.012 235);
  --ink-2:oklch(0.400 0.010 235);
  --ink-3:oklch(0.455 0.010 235);
  --rule:oklch(0.858 0.007 220);
  --rule-2:oklch(0.795 0.009 220);
  /* Single accent: safety amber. Rules, brackets, bar fills, winner marker. */
  --amber:oklch(0.760 0.150 72);
  --amber-ink:oklch(0.500 0.130 62);
  --amber-wash:oklch(0.960 0.030 78);
  --ok:oklch(0.480 0.115 152);
  --no:oklch(0.485 0.160 26);
  /* 4pt scale, retained per AGENTS.md 8(a) */
  --s1:4px;--s2:8px;--s3:12px;--s4:16px;--s6:24px;--s8:32px;--s12:48px;--s16:64px;--s24:96px;
  --display:"Barlow Condensed","Arial Narrow",system-ui,sans-serif;
  --body:"Source Sans 3",system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --ease:cubic-bezier(0.25,1,0.5,1);
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font-family:var(--body);font-size:16px;line-height:1.62;
  font-variant-numeric:tabular-nums;
  text-underline-offset:3px;
}
h1,h2,h3,h4{font-family:var(--display);font-weight:700;line-height:1.08;margin:0;text-wrap:balance;letter-spacing:0.002em}
p,li{text-wrap:pretty}
code{font-family:var(--mono);font-size:0.855em;background:var(--sunk);padding:1px 5px;border:1px solid var(--rule);color:var(--ink)}
a{color:var(--amber-ink);text-decoration:underline;text-decoration-thickness:1px}
a:hover{background:var(--amber-wash)}
a:focus-visible,summary:focus-visible,.nav a:focus-visible{outline:2px solid var(--amber-ink);outline-offset:2px}
hr{border:0;border-top:1px solid var(--rule);margin:var(--s8) 0}
blockquote{margin:var(--s4) 0;padding-left:var(--s4);border-left:2px solid var(--amber);color:var(--ink-2)}

/* ---- shell: flush-left ledger grid ---- */
.shell{display:grid;grid-template-columns:minmax(0,1fr);max-width:1400px;margin:0 auto}
.shell > *{min-width:0}
@media(min-width:1040px){
  .shell{grid-template-columns:246px minmax(0,1fr);gap:var(--s12)}
}
.rail{border-bottom:1px solid var(--rule);padding:var(--s4) var(--s6)}
@media(min-width:1040px){
  .rail{position:sticky;top:0;align-self:start;height:100dvh;overflow-y:auto;
        border-bottom:0;border-right:1px solid var(--rule);padding:var(--s12) var(--s6) var(--s12) var(--s8)}
}
.rail .brandline{font-family:var(--display);font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:var(--s4)}
.meta{display:none}
@media(min-width:1040px){.meta{display:block;margin-bottom:var(--s8)}}
.meta div{display:flex;justify-content:space-between;gap:var(--s2);padding:var(--s1) 0;border-bottom:1px dotted var(--rule);font-size:13px}
.meta dt,.meta .k{color:var(--ink-3)}
.meta .v{color:var(--ink);font-weight:600}
.nav{margin:0;padding:0;list-style:none;display:flex;gap:var(--s1);max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
@media(min-width:1040px){.nav{display:block;overflow:visible}}
.nav a{display:block;min-height:44px;display:flex;align-items:center;padding:var(--s2) var(--s3);
  font-size:13.5px;color:var(--ink-2);text-decoration:none;white-space:nowrap;
  border-left:2px solid transparent;transition:color .14s var(--ease),background-color .14s var(--ease),border-color .14s var(--ease)}
@media(min-width:1040px){.nav a{white-space:normal;min-height:0;padding:7px var(--s3)}}
.nav a:hover{color:var(--ink);background:var(--surface)}
.nav a[aria-current="true"]{color:var(--ink);border-left-color:var(--amber);background:var(--surface);font-weight:600}
.main{min-width:0;padding:0 var(--s6) var(--s24)}
.rail{min-width:0}
@media(min-width:1040px){.main{padding:var(--s12) var(--s8) var(--s24) 0}}

/* ---- masthead: full-bleed band with corner brackets ---- */
.mast{position:relative;background:var(--surface);border:1px solid var(--rule);padding:var(--s8) var(--s6);margin:var(--s6) 0 var(--s12)}
@media(min-width:760px){.mast{padding:var(--s12)}}
.mast::before,.mast::after{content:"";position:absolute;width:18px;height:18px;pointer-events:none}
.mast::before{top:-1px;left:-1px;border-top:3px solid var(--amber);border-left:3px solid var(--amber)}
.mast::after{bottom:-1px;right:-1px;border-bottom:3px solid var(--amber);border-right:3px solid var(--amber)}
.mast .status{font-family:var(--display);font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink);background:var(--amber);display:inline-block;padding:3px var(--s2)}
.mast h1{font-size:clamp(1.85rem,7.2vw,4.1rem);margin:var(--s4) 0 var(--s3)}
@media(min-width:760px){.mast h1{max-width:22ch}}
.mast .sub{color:var(--ink-2);max-width:62ch;margin:0}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:1px;background:var(--rule);border:1px solid var(--rule);margin-top:var(--s8)}
/* 5 figures in a 2-col layout would leave a blank filler cell; span the last */
@media(max-width:600px){.figs .fig:last-child{grid-column:1/-1}}
.fig{background:var(--surface);padding:var(--s4)}
.fig b{display:block;font-family:var(--display);font-size:clamp(1.6rem,3vw,2.1rem);line-height:1;color:var(--ink)}
.fig span{display:block;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink-3);margin-top:var(--s2)}
.fig.hi b{color:var(--amber-ink)}

/* ---- section frame ---- */
.sec{padding-top:var(--s16);scroll-margin-top:var(--s6)}
@media(min-width:1040px){.sec{scroll-margin-top:var(--s12)}}
.sec > h2{font-size:clamp(1.5rem,2.4vw,2rem);padding-bottom:var(--s3);border-bottom:1px solid var(--rule-2);margin-bottom:var(--s6)}
.lede{color:var(--ink-2);max-width:68ch;margin:0 0 var(--s6)}

/* ---- verdict: asymmetric 7/5 split ---- */
.verdict{display:grid;gap:var(--s8)}
@media(min-width:900px){.verdict{grid-template-columns:7fr 5fr;gap:var(--s12)}}
.verdict p{margin:0 0 var(--s4);max-width:60ch}
.callout{border:1px solid var(--rule);background:var(--surface);padding:var(--s6);align-self:start}
.callout .big{font-family:var(--display);font-size:clamp(3rem,7vw,4.6rem);line-height:0.92;color:var(--amber-ink)}
.callout .big i{font-style:normal;font-size:0.36em;color:var(--ink-3);letter-spacing:0.04em}
.callout dl{margin:var(--s4) 0 0;font-size:14px}
.callout dl div{display:flex;justify-content:space-between;gap:var(--s3);padding:var(--s2) 0;border-top:1px solid var(--rule)}
.callout dt{color:var(--ink-3)}
.callout dd{margin:0;font-weight:600;text-align:right}

/* ---- data tables ---- */
.tw{overflow-x:auto;border:1px solid var(--rule);background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{padding:var(--s3);border-bottom:1px solid var(--rule);vertical-align:top}
thead th{font-family:var(--display);font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-2);background:var(--sunk);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}
tbody tr{transition:background-color .14s var(--ease)}
tbody tr:hover{background:var(--bg)}

/* the memorable element: bar-graded audit matrix */
.matrix th,.matrix td{padding:var(--s3) var(--s2)}
.matrix .crit{white-space:normal;width:32%;min-width:186px}
.matrix .cn{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);margin-right:var(--s2)}
.matrix .num{text-align:right;white-space:nowrap;min-width:74px}
.matrix .num b{font-family:var(--display);font-size:16px;margin-left:var(--s2)}
.matrix .bar{display:inline-block;width:34px;height:7px;background:var(--sunk);vertical-align:middle;border:1px solid var(--rule)}
.matrix .bar i{display:block;height:100%;background:var(--ink-3)}
.matrix th.win,.matrix td.win{background:var(--amber-wash);border-left:1px solid var(--amber);border-right:1px solid var(--amber)}
.matrix td.win .bar i{background:var(--amber)}
.matrix td.win b{color:var(--amber-ink)}
.matrix .tot td{border-top:2px solid var(--rule-2);background:var(--sunk);font-weight:700}
.matrix .tot .dim{color:var(--ink-3);font-weight:400}

/* ---- truth-rule status rows ---- */
.tr-row{display:grid;grid-template-columns:auto auto;gap:var(--s2) var(--s3);align-items:start;
  padding:var(--s4) 0;border-top:1px solid var(--rule)}
@media(min-width:760px){.tr-row{grid-template-columns:96px 64px minmax(0,1fr);align-items:baseline;gap:var(--s4)}}
.tr-row.is-win{border-left:2px solid var(--amber);padding-left:var(--s4)}
.tr-id{font-family:var(--display);font-size:12.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-3)}
.tr-st{font-family:var(--display);font-size:13px;font-weight:700;letter-spacing:0.1em}
.tr-st.ok{color:var(--ok)}
.tr-st.no{color:var(--no)}
.tr-note{grid-column:1/-1;margin:0;color:var(--ink-2);font-size:15px;max-width:74ch}
@media(min-width:760px){.tr-note{grid-column:3}}

/* ---- measured ledger: stat groups, no cards ---- */
.ledger{display:grid;gap:var(--s8)}
@media(min-width:820px){.ledger{grid-template-columns:1fr 1fr;gap:var(--s8) var(--s12)}}
.lg-h{font-size:13px;font-weight:600;letter-spacing:0.11em;text-transform:uppercase;color:var(--ink-3);
  padding-bottom:var(--s2);border-bottom:1px solid var(--rule-2);margin-bottom:var(--s2)}
.lg-dl{margin:0}
.lg-r{display:flex;justify-content:space-between;align-items:baseline;gap:var(--s4);padding:var(--s2) 0;border-bottom:1px dotted var(--rule)}
.lg-r dt{color:var(--ink-2);font-size:14.5px;min-width:0}
.lg-r dd{margin:0;white-space:nowrap;font-family:var(--display);font-size:17px;font-weight:600}
.lg-r dd .u{font-family:var(--body);font-size:11.5px;font-weight:400;color:var(--ink-3);margin-left:6px;letter-spacing:0.04em}

/* ---- risks: numbered editorial list ---- */
.risks{display:grid;gap:var(--s6)}
@media(min-width:900px){.risks{grid-template-columns:1fr 1fr;gap:var(--s8) var(--s12)}}
.rk{display:grid;grid-template-columns:38px minmax(0,1fr);gap:var(--s3)}
.rk-n{font-family:var(--display);font-size:20px;font-weight:700;color:var(--amber-ink)}
.rk h3{font-size:17px;margin-bottom:var(--s2)}
.rk p{margin:0;color:var(--ink-2);font-size:14.5px}

/* ---- contract document ---- */
.doc{margin-top:var(--s6);border-top:1px solid var(--rule)}
.doc details{border-bottom:1px solid var(--rule)}
.doc summary{cursor:pointer;list-style:none;padding:var(--s4) 0;display:flex;align-items:baseline;gap:var(--s3);
  transition:color .14s var(--ease)}
.doc summary::-webkit-details-marker{display:none}
.doc summary:hover{color:var(--amber-ink)}
.doc summary .mk{font-family:var(--mono);font-size:12px;color:var(--ink-3);width:2ch;flex:none}
.doc summary h3{font-size:19px;font-family:var(--display)}
.doc details[open] summary{border-bottom:1px dotted var(--rule)}
.doc .bd{padding:var(--s4) 0 var(--s8);max-width:78ch;min-width:0}
.doc .bd > *:first-child{margin-top:0}
.doc .bd h3{font-size:17px;margin:var(--s6) 0 var(--s2)}
.doc .bd h4{font-size:15.5px;margin:var(--s4) 0 var(--s2);color:var(--ink-2)}
.doc .bd p,.doc .bd li{font-size:15.5px}
.doc .bd ul,.doc .bd ol{padding-left:var(--s6);margin:var(--s3) 0}
.doc .bd li{margin:var(--s1) 0}
.doc .bd .tw{margin:var(--s4) 0;font-size:13.5px}

.note{margin-top:var(--s16);padding:var(--s4) var(--s6);border:1px solid var(--rule-2);background:var(--surface);color:var(--ink-2);font-size:14px;max-width:78ch}
.note b{color:var(--ink)}
footer{margin-top:var(--s16);padding-top:var(--s6);border-top:1px solid var(--rule-2);color:var(--ink-3);font-size:13px}

@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{transition-duration:0.01ms !important;animation-duration:0.01ms !important;animation-iteration-count:1 !important;scroll-behavior:auto !important}
}
@media print{
  .rail{display:none}.shell{grid-template-columns:1fr}
  .doc details{border:0}.doc .bd{padding-top:0}
  body{background:#fff}
}
</style>
</head>
<body>
<div class="shell">

  <nav class="rail" aria-label="Document index">
    <p class="brandline">GitHoot / dossier</p>
    <div class="meta">
      <div><span class="k">Status</span><span class="v">${esc((meta.status || '').split('(')[0].trim() || 'Accepted')}</span></div>
      <div><span class="k">Date</span><span class="v">${esc(meta.date || '')}</span></div>
      <div><span class="k">Candidates</span><span class="v">5 &middot; Opus</span></div>
      <div><span class="k">Verifier</span><span class="v">kongming</span></div>
      <div><span class="k">Score</span><span class="v">211 / 220</span></div>
    </div>
    <ul class="nav">
      ${NAV.map((n) => `<li><a href="#${n.id}">${esc(n.title)}</a></li>`).join('\n      ')}
    </ul>
  </nav>

  <main class="main">

    <header class="mast">
      <span class="status">Accepted</span>
      <h1>Marketing website redesign, verified and selected</h1>
      <p class="sub">The winning brainstorm contract of five independent Opus-tier candidates, chosen by a single strongest-model verifier and materialized unchanged. Four waves were required; the first three were discarded for mechanical defects in the harness, not the design.</p>
      <div class="figs">
        <div class="fig hi"><b>211</b><span>Winner / 220</span></div>
        <div class="fig"><b>183</b><span>Runner-up</span></div>
        <div class="fig"><b>5</b><span>Candidates</span></div>
        <div class="fig"><b>11</b><span>Rubric criteria</span></div>
        <div class="fig"><b>0.94</b><span>Confidence</span></div>
      </div>
    </header>

    <section class="sec" id="verdict">
      <h2>Verdict</h2>
      <div class="verdict">
        <div>
          <p>One contract combined a feasible poster-first hero at 375&nbsp;px, a deferred single-asset demo, explicit degraded-quota semantics, a complete per-number source map, route-language boundary checks, and a repository link that ships only after a recorded HTTP&nbsp;200 rather than being assumed.</p>
          <p>It alone treated the filtered <code>dist/</code> figure as a same-source expectation plus the rewritten-entry delta, instead of an invariant ceiling. Three of five candidates passed every hard truth rule; selection came down to rubric quality, with a 28-point margin.</p>
          <p>Two candidates failed outright on link integrity, one asserted a launch that has not happened, and one departed from the measured animation frame count. Details are in the audit below.</p>
        </div>
        <div class="callout">
          <p class="big">211<i> / 220</i></p>
          <dl>
            <div><dt>Runner-up</dt><dd>183</dd></div>
            <div><dt>Margin</dt><dd>+28</dd></div>
            <div><dt>Hard-rule passes</dt><dd>3 of 5</dd></div>
            <div><dt>Verifier confidence</dt><dd>High &middot; 0.94</dd></div>
            <div><dt>Source length</dt><dd>${fmt(srcLines)} lines</dd></div>
          </dl>
        </div>
      </div>
    </section>

    <section class="sec" id="matrix">
      <h2>Score matrix</h2>
      <p class="lede">Eleven criteria, scored 1&ndash;20 each by the verifier against an anonymized, unordered candidate set. Bars are scaled to the 20-point ceiling.</p>
      ${scoreMatrix()}
    </section>

    <section class="sec" id="truth">
      <h2>Truth-rule audit</h2>
      <p class="lede">Eight hard rules governed fabrication, byte provenance, quota semantics, budget arithmetic and link integrity. A single violation disqualifies a candidate regardless of score.</p>
      ${truthRows()}
    </section>

    <section class="sec" id="ledger">
      <h2>Measured ledger</h2>
      <p class="lede">Every figure below was measured directly this session and supplied to all five candidates identically. Basis is stated per row, because raw, gzip and on-disk figures are not interchangeable.</p>
      <div class="ledger">${ledger()}</div>
    </section>

    <section class="sec" id="risks">
      <h2>Residual risks</h2>
      <p class="lede">Carried forward by the verifier. The winner is adoptable as written; these are the points to watch while implementing it.</p>
      <div class="risks">${risks()}</div>
    </section>

    <section class="sec" id="contract-document">
      <h2>Accepted contract</h2>
      <p class="lede">Rendered verbatim from the source document. Sections expand in place; the first is open by default.</p>
      <div class="doc">
        ${sections.map((s, i) => `
        <details id="doc-${s.id}"${i === 0 ? ' open' : ''}>
          <summary><span class="mk">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3></summary>
          <div class="bd">${s.html}</div>
        </details>`).join('')}
      </div>
    </section>

    <p class="note"><b>Visual register note.</b> This dossier deliberately does not use the GitHoot Option&nbsp;1 Cyber-Arcade product palette. It is an audit document about the product, not a product surface, and the neon game palette would misrepresent it as shipped UI while hurting table legibility. The deviation is a dated one-off approved in <code>AGENTS.md</code> invariant&nbsp;8 for this single file; it retains the 4&nbsp;pt spacing scale and a neutral ramp tinted toward the project hue. Contract text is reproduced verbatim, including its own punctuation.</p>

    <footer>
      <p>Generated by <code>scripts/build-report-preview.js</code> from <code>${esc(path.basename(IN))}</code>. Figures are controller-measured; no value on this page is estimated unless labelled.</p>
    </footer>

  </main>
</div>

<script>
(function(){
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var targets = links.map(function(a){ return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if (!('IntersectionObserver' in window) || !targets.length) return;
  var seen = new Map();
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ seen.set(e.target, e.intersectionRatio); });
    var best = null, bestR = 0;
    seen.forEach(function(r, el){ if (r > bestR) { bestR = r; best = el; } });
    if (!best) return;
    links.forEach(function(a){
      var on = a.getAttribute('href') === '#' + best.id;
      if (on) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current');
    });
  }, { rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.15, 0.4, 0.75, 1] });
  targets.forEach(function(t){ io.observe(t); });

  // open a collapsed contract section when linked to directly
  document.addEventListener('click', function(ev){
    var a = ev.target.closest && ev.target.closest('.nav a');
    if (!a) return;
    var el = document.querySelector(a.getAttribute('href'));
    if (el && el.tagName === 'DETAILS') el.open = true;
  });
})();
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('sections: ' + sections.length);
console.log('bytes: ' + Buffer.byteLength(html, 'utf8'));
console.log('wrote: ' + OUT);
