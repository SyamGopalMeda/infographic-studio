// Build an editable PowerPoint deck (.pptx) from a deck JSON file.
//
//   node scripts/deck.mjs decks/my-talk.json      -> out/my-talk/presentation.pptx
//
// Slide types: title, section, bullets, two-column, stats, process, cards, table, image,
// infographic (animated video rendered by make.mjs), quote, closing. Every slide may have "notes".
// The format is documented in .claude/skills/presentation/SKILL.md

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import PptxGenJS from 'pptxgenjs';
import { checkFile } from './check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outOpt = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;
const deckArg = argv.find((a, i) => a.endsWith('.json') && argv[i - 1] !== '--out');
if (!deckArg) { console.error('Usage: node scripts/deck.mjs decks/<name>.json [--out <dir>]'); process.exit(1); }

const deckPath = resolve(process.cwd(), deckArg);
const deck = argv.includes('--no-check') ? JSON.parse(readFileSync(deckPath, 'utf8')) : await checkFile(deckPath, 'deck');
const name = basename(deckPath, '.json');
// Inside the studio repo: out/<name>/. Used from another project (plugin): next to the JSON, <dir>/<name>/.
const inStudio = deckPath.toLowerCase().startsWith(root.toLowerCase());
const outDir = resolve(outOpt || (inStudio ? join(root, 'out', name) : join(dirname(deckPath), name)));
mkdirSync(outDir, { recursive: true });

// ---------- theme ----------
const hex = c => String(c || '').replace('#', '').toUpperCase();
const T = {
  primary: hex(deck.theme?.primary || '#1B7A1B'),
  secondary: hex(deck.theme?.secondary || '#5552C9'),
  ink: hex(deck.theme?.ink || '#1D1D2B'),
  muted: '6B6F7B',
  light: hex(deck.theme?.light || '#F4F5FA'),
  white: 'FFFFFF',
  font: deck.theme?.font || 'Segoe UI',
};
const SW = 13.333, SH = 7.5, M = 0.6; // slide size (in) and margin

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = deck.author || 'Tech Drona';
pptx.title = deck.title || name;

// A relative path in a deck: next to the deck file, then the current folder, then the studio folder.
const rel = p => {
  if (isAbsolute(p)) return p;
  return [join(dirname(deckPath), p), resolve(process.cwd(), p), join(root, p)].find(existsSync) || join(root, p);
};

function render(dataFile, out) {
  return new Promise((ok, fail) => {
    const c = spawn(process.execPath, [join(root, 'scripts', 'make.mjs'), dataFile, '--format', 'landscape', '--no-gif', '--out', out],
      { cwd: root, stdio: 'inherit' });
    c.on('close', code => (code === 0 ? ok() : fail(new Error(`render failed (${code})`))));
  });
}

// ---------- building blocks ----------
let pageNo = 0;
function base(s, title) {
  pageNo++;
  s.background = { color: T.white };
  if (title) {
    s.addShape(pptx.ShapeType.rect, { x: M, y: 0.55, w: 0.12, h: 0.62, fill: { color: T.primary }, line: { color: T.primary } });
    s.addText(title, { x: M + 0.25, y: 0.45, w: SW - 2 * M - 0.25, h: 0.8, fontFace: T.font, fontSize: 28, bold: true, color: T.secondary, fit: 'shrink', margin: 0 });
  }
  s.addText(deck.author || 'Tech Drona', { x: M, y: SH - 0.45, w: 6, h: 0.3, fontFace: T.font, fontSize: 10, color: T.muted, margin: 0 });
  s.addText(String(pageNo), { x: SW - M - 1, y: SH - 0.45, w: 1, h: 0.3, fontFace: T.font, fontSize: 10, color: T.muted, align: 'right', margin: 0 });
}
const BODY = { x: M, y: 1.5, w: SW - 2 * M, h: SH - 1.5 - 0.7 }; // content area under a title

function bulletRuns(items, size = 20) {
  const runs = [];
  for (const it of items || []) {
    const text = typeof it === 'string' ? it : it.text;
    runs.push({ text, options: { bullet: { indent: 18 }, fontSize: size, color: T.ink, paraSpaceAfter: 8, breakLine: true } });
    for (const sub of (typeof it === 'object' && it.sub) || []) {
      runs.push({ text: sub, options: { bullet: { indent: 18 }, indentLevel: 1, fontSize: size - 4, color: T.muted, paraSpaceAfter: 4, breakLine: true } });
    }
  }
  return runs;
}

function card(s, x, y, w, h, accent) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: T.light }, line: { color: accent, width: 1.25 } });
}

// ---------- slide types ----------
const builders = {
  title(s, d) {
    pageNo++;
    s.background = { color: T.secondary };
    s.addShape(pptx.ShapeType.rect, { x: M, y: 2.55, w: 1.2, h: 0.12, fill: { color: T.primary }, line: { color: T.primary } });
    s.addText(d.title || deck.title || '', { x: M, y: 2.8, w: SW - 2 * M, h: 1.5, fontFace: T.font, fontSize: 44, bold: true, color: T.white, fit: 'shrink', valign: 'top', margin: 0 });
    if (d.subtitle) s.addText(d.subtitle, { x: M, y: 4.35, w: SW - 2 * M, h: 0.9, fontFace: T.font, fontSize: 22, color: 'E6E6FA', valign: 'top', margin: 0 });
    s.addText(d.by || deck.author || 'Tech Drona', { x: M, y: SH - 1.0, w: 8, h: 0.4, fontFace: T.font, fontSize: 14, bold: true, color: T.white, margin: 0 });
  },
  section(s, d) {
    pageNo++;
    s.background = { color: T.primary };
    s.addText(d.title || '', { x: M, y: 2.6, w: SW - 2 * M, h: 1.3, fontFace: T.font, fontSize: 40, bold: true, color: T.white, fit: 'shrink', margin: 0 });
    if (d.subtitle) s.addText(d.subtitle, { x: M, y: 3.9, w: SW - 2 * M, h: 0.8, fontFace: T.font, fontSize: 20, color: 'E8F5E9', margin: 0 });
  },
  closing(s, d) {
    pageNo++;
    s.background = { color: T.secondary };
    s.addText(d.title || 'Thank you', { x: M, y: 2.5, w: SW - 2 * M, h: 1.4, fontFace: T.font, fontSize: 48, bold: true, color: T.white, align: 'center', fit: 'shrink', margin: 0 });
    if (d.subtitle) s.addText(d.subtitle, { x: M, y: 4.0, w: SW - 2 * M, h: 0.9, fontFace: T.font, fontSize: 20, color: 'E6E6FA', align: 'center', margin: 0 });
  },
  bullets(s, d) {
    base(s, d.title);
    s.addText(bulletRuns(d.bullets), { ...BODY, fontFace: T.font, valign: 'top', fit: 'shrink', margin: 4 });
  },
  'two-column'(s, d) {
    base(s, d.title);
    const colW = (BODY.w - 0.4) / 2;
    const lines = Math.max(...[d.left, d.right].map(c => (c?.bullets || []).reduce((a, b) => a + 1 + ((b && b.sub) || []).length, 0)));
    const ch = Math.min(BODY.h, 1.6 + lines * 0.55);
    [d.left, d.right].forEach((c, i) => {
      if (!c) return;
      const x = BODY.x + i * (colW + 0.4), accent = i ? T.secondary : T.primary;
      card(s, x, BODY.y, colW, ch, accent);
      s.addText(c.heading || '', { x: x + 0.3, y: BODY.y + 0.2, w: colW - 0.6, h: 0.6, fontFace: T.font, fontSize: 22, bold: true, color: accent, margin: 0 });
      s.addText(bulletRuns(c.bullets, 18), { x: x + 0.3, y: BODY.y + 0.9, w: colW - 0.6, h: ch - 1.1, fontFace: T.font, valign: 'top', fit: 'shrink', margin: 2 });
    });
  },
  stats(s, d) {
    base(s, d.title);
    const items = (d.stats || []).slice(0, 4), n = items.length || 1, gap = 0.35;
    const w = (BODY.w - gap * (n - 1)) / n, h = 2.6, y = BODY.y + 0.6;
    items.forEach((st, i) => {
      const x = BODY.x + i * (w + gap), accent = i % 2 ? T.secondary : T.primary;
      card(s, x, y, w, h, accent);
      s.addText(st.value, { x, y: y + 0.35, w, h: 1.2, fontFace: T.font, fontSize: 48, bold: true, color: accent, align: 'center', fit: 'shrink', margin: 0 });
      s.addText(st.label, { x: x + 0.2, y: y + 1.6, w: w - 0.4, h: 0.8, fontFace: T.font, fontSize: 16, color: T.ink, align: 'center', valign: 'top', fit: 'shrink', margin: 0 });
    });
    if (d.note) s.addText(d.note, { x: BODY.x, y: y + h + 0.4, w: BODY.w, h: 0.6, fontFace: T.font, fontSize: 14, color: T.muted, margin: 0 });
  },
  process(s, d) {
    base(s, d.title);
    const steps = (d.steps || []).slice(0, 6), n = steps.length || 1, gap = 0.45;
    const w = (BODY.w - gap * (n - 1)) / n, h = 2.7, y = BODY.y + 0.7;
    steps.forEach((st, i) => {
      const x = BODY.x + i * (w + gap), accent = i % 2 ? T.secondary : T.primary;
      card(s, x, y, w, h, accent);
      s.addShape(pptx.ShapeType.ellipse, { x: x + w / 2 - 0.35, y: y - 0.35, w: 0.7, h: 0.7, fill: { color: accent }, line: { color: T.white, width: 2 } });
      s.addText(String(i + 1), { x: x + w / 2 - 0.35, y: y - 0.35, w: 0.7, h: 0.7, fontFace: T.font, fontSize: 18, bold: true, color: T.white, align: 'center', valign: 'middle', margin: 0 });
      s.addText(st.title || '', { x: x + 0.15, y: y + 0.5, w: w - 0.3, h: 0.8, fontFace: T.font, fontSize: 17, bold: true, color: T.ink, align: 'center', valign: 'top', fit: 'shrink', margin: 0 });
      if (st.text) s.addText(st.text, { x: x + 0.15, y: y + 1.35, w: w - 0.3, h: h - 1.5, fontFace: T.font, fontSize: 13, color: T.muted, align: 'center', valign: 'top', fit: 'shrink', margin: 0 });
      if (i < n - 1) s.addShape(pptx.ShapeType.line, { x: x + w + 0.05, y: y + h / 2, w: gap - 0.1, h: 0, line: { color: T.ink, width: 1.5, endArrowType: 'triangle' } });
    });
  },
  cards(s, d) {
    base(s, d.title);
    const items = (d.cards || []).slice(0, 6), n = items.length || 1;
    const cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), gap = 0.3;
    const w = (BODY.w - gap * (cols - 1)) / cols, h = (BODY.h - gap * (rows - 1)) / rows;
    items.forEach((c, i) => {
      const x = BODY.x + (i % cols) * (w + gap), y = BODY.y + Math.floor(i / cols) * (h + gap), accent = i % 2 ? T.secondary : T.primary;
      card(s, x, y, w, h, accent);
      let ty = y + 0.25;
      if (c.icon) { s.addText(c.icon, { x: x + 0.25, y: ty, w: 0.8, h: 0.7, fontSize: 30, margin: 0 }); ty += 0.75; }
      s.addText(c.title || '', { x: x + 0.25, y: ty, w: w - 0.5, h: 0.55, fontFace: T.font, fontSize: 18, bold: true, color: accent, fit: 'shrink', margin: 0 });
      if (c.text) s.addText(c.text, { x: x + 0.25, y: ty + 0.6, w: w - 0.5, h: Math.max(0.4, y + h - ty - 0.8), fontFace: T.font, fontSize: 13, color: T.ink, valign: 'top', fit: 'shrink', margin: 0 });
    });
  },
  table(s, d) {
    base(s, d.title);
    const head = (d.columns || []).map(c => ({ text: String(c), options: { bold: true, color: T.white, fill: { color: T.secondary } } }));
    const body = (d.rows || []).map((r, ri) => r.map(c => ({ text: String(c), options: { color: T.ink, fill: { color: ri % 2 ? T.white : T.light } } })));
    s.addTable([head, ...body], { x: BODY.x, y: BODY.y, w: BODY.w, fontFace: T.font, fontSize: 16, rowH: 0.55, border: { type: 'solid', color: 'D0D3DC', pt: 0.75 }, valign: 'middle', autoPage: false });
  },
  image(s, d) {
    base(s, d.title);
    const p = rel(d.image || '');
    if (!existsSync(p)) { s.addText(`Image not found: ${d.image}`, { ...BODY, color: 'C62828', fontSize: 16 }); return; }
    const h = d.caption ? BODY.h - 0.6 : BODY.h;
    s.addImage({ path: p, x: BODY.x, y: BODY.y, w: BODY.w, h, sizing: { type: 'contain', w: BODY.w, h } });
    if (d.caption) s.addText(d.caption, { x: BODY.x, y: BODY.y + h + 0.1, w: BODY.w, h: 0.45, fontFace: T.font, fontSize: 13, color: T.muted, align: 'center', margin: 0 });
  },
  quote(s, d) {
    base(s, null);
    s.addText('“', { x: M, y: 1.0, w: 1.5, h: 1.5, fontFace: 'Georgia', fontSize: 120, color: T.primary, margin: 0 });
    s.addText(d.quote || '', { x: M + 0.8, y: 2.0, w: SW - 2 * M - 1.6, h: 2.8, fontFace: T.font, fontSize: 30, italic: true, color: T.ink, valign: 'middle', fit: 'shrink', margin: 0 });
    if (d.by) s.addText(`— ${d.by}`, { x: M + 0.8, y: 5.0, w: SW - 2 * M - 1.6, h: 0.6, fontFace: T.font, fontSize: 18, bold: true, color: T.secondary, margin: 0 });
  },
};

// infographic slides are async (they render a video first)
async function infographic(s, d, i) {
  base(s, d.title);
  const media = join(outDir, 'media', `slide${i + 1}`);
  mkdirSync(media, { recursive: true });
  let dataFile;
  if (d.dataFile) dataFile = rel(d.dataFile);
  else { dataFile = join(media, 'data.json'); writeFileSync(dataFile, JSON.stringify(d.data || {}, null, 2)); }
  await render(dataFile, media);
  const area = d.title ? BODY : { x: 0, y: 0, w: SW, h: SH };
  const k = Math.min(area.w / 16, area.h / 9), w = 16 * k, h = 9 * k;
  const x = area.x + (area.w - w) / 2, y = area.y + (area.h - h) / 2;
  const cover = 'data:image/png;base64,' + readFileSync(join(media, 'poster.png')).toString('base64');
  s.addMedia({ type: 'video', path: join(media, 'infographic.mp4'), x, y, w, h, cover });
}

// ---------- build ----------
const slides = deck.slides || [];
for (const [i, d] of slides.entries()) {
  const s = pptx.addSlide();
  const type = d.type || (d.bullets ? 'bullets' : 'bullets');
  if (type === 'infographic') await infographic(s, d, i);
  else (builders[type] || builders.bullets)(s, d);
  if (d.notes) s.addNotes(d.notes);
}
const pptxPath = join(outDir, 'presentation.pptx');
await pptx.writeFile({ fileName: pptxPath });
console.log(`Done: ${pptxPath} (${slides.length} slides)`);
