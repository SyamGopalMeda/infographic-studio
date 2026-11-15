// Validate and auto-fix infographic / deck JSON before rendering, so Claude rarely needs a second try.
//
//   node scripts/check.mjs <file.json>          (also run automatically by make.mjs and deck.mjs)
//
// Fixes what is safe (comments, trailing commas, duplicate ids, links to the wrong row, bad logo names),
// writes the file back if it changed, and prints one short line per problem. Exit 1 only if unusable.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// JSON with // or /* */ comments and trailing commas -> strict JSON (string-aware).
export function lenientParse(text) {
  try { return { data: JSON.parse(text), fixed: false }; } catch { /* repair below */ }
  let out = '', i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inStr) { out += c; if (c === '\\') { out += n ?? ''; i += 2; continue; } if (c === '"') inStr = false; i++; continue; }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = text.indexOf('*/', i + 2); i = i < 0 ? text.length : i + 2; continue; }
    out += c; i++;
  }
  out = out.replace(/,(\s*[}\]])/g, '$1'); // safe: strings were copied verbatim and contain no bare ",}" patterns that matter
  return { data: JSON.parse(out), fixed: true };
}

const slugCache = new Map();
async function slugExists(slug) {
  if (slugCache.has(slug)) return slugCache.get(slug);
  const p = fetch(`https://cdn.simpleicons.org/${encodeURIComponent(slug)}`, { method: 'GET', signal: AbortSignal.timeout(6000) })
    .then(r => r.ok).catch(() => null); // null = could not check (offline)
  slugCache.set(slug, p);
  return p;
}
const slugGuesses = s => {
  const base = String(s).toLowerCase().trim();
  const norm = base.replace(/\+/g, 'plus').replace(/\./g, 'dot').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  return [...new Set([base, norm, norm.replace(/dot(js)$/, '$1'), base.replace(/[^a-z0-9]/g, '')])].filter(Boolean);
};

// Check every {logo} in a list of objects; fix to a working slug or drop it (the template then shows a letter).
async function fixLogos(objs, warn) {
  let offline = false;
  await Promise.all(objs.filter(o => o && o.logo).map(async o => {
    for (const g of slugGuesses(o.logo)) {
      const ok = await slugExists(g);
      if (ok === null) { offline = true; return; }
      if (ok) { if (g !== o.logo) { warn(`logo "${o.logo}" -> "${g}"`); o.logo = g; } return; }
    }
    warn(`logo "${o.logo}" not found (${o.name || o.label || 'item'}): shows a letter; use "icon": "<emoji>" or a correct slug`);
    delete o.logo;
  }));
  if (offline) warn('offline: logo names not checked');
}

const LIMITS = { rows: 8, items: 6, tools: 4, label: 32 };

export async function checkInfographic(d, warn) {
  if (!d || !Array.isArray(d.rows) || !d.rows.length) throw new Error('needs a non-empty "rows" array');
  if (d.rows.length > LIMITS.rows) warn(`${d.rows.length} rows (max ~${LIMITS.rows}): text will be small`);
  const seen = new Set(), rowOf = {};
  d.rows.forEach((row, ri) => {
    if (!Array.isArray(row.items) || !row.items.length) throw new Error(`row ${ri + 1} has no "items"`);
    if (row.items.length > LIMITS.items) warn(`row ${ri + 1}: ${row.items.length} items (max ${LIMITS.items})`);
    row.items.forEach((it, ii) => {
      if (!it.id) it.id = `r${ri}i${ii}`;
      if (seen.has(it.id)) { const nid = `${it.id}-${ri}${ii}`; warn(`duplicate id "${it.id}" -> "${nid}"`); it.id = nid; }
      seen.add(it.id); rowOf[it.id] = ri;
      if ((it.label || '').length > LIMITS.label) warn(`long label (${it.label.length} chars): "${it.label.slice(0, 40)}"`);
      if ((it.tools || []).length > LIMITS.tools) warn(`"${it.label || it.id}": ${it.tools.length} tools (max ${LIMITS.tools})`);
    });
  });
  d.rows.forEach((row, ri) => row.items.forEach(it => {
    if (!it.from) return;
    const ok = it.from.filter(f => rowOf[f] === ri - 1);
    if (ok.length !== it.from.length) {
      warn(`"${it.id}": removed links not from the row directly above (${it.from.filter(f => !ok.includes(f)).join(', ')})`);
      if (ok.length) it.from = ok; else delete it.from;
    }
  }));
  await fixLogos(d.rows.flatMap(r => r.items.flatMap(it => [it, ...(it.tools || [])])), warn);
  return d;
}

const SLIDE_TYPES = ['title', 'section', 'bullets', 'two-column', 'stats', 'process', 'cards', 'table', 'image', 'infographic', 'quote', 'closing'];
export async function checkDeck(d, warn) {
  if (!d || !Array.isArray(d.slides) || !d.slides.length) throw new Error('needs a non-empty "slides" array');
  for (const [i, s] of d.slides.entries()) {
    const n = `slide ${i + 1}`;
    if (!SLIDE_TYPES.includes(s.type)) { warn(`${n}: unknown type "${s.type}" -> "bullets"`); s.type = 'bullets'; }
    if (s.type === 'bullets' && (s.bullets || []).length > 6) warn(`${n}: ${s.bullets.length} bullets (max 5)`);
    if (s.type === 'stats' && (s.stats || []).length > 4) warn(`${n}: only the first 4 stats are shown`);
    if (s.type === 'process' && (s.steps || []).length > 6) warn(`${n}: only the first 6 steps are shown`);
    if (s.type === 'cards' && (s.cards || []).length > 6) warn(`${n}: only the first 6 cards are shown`);
    if (s.type === 'infographic' && s.data) await checkInfographic(s.data, m => warn(`${n}: ${m}`));
  }
  return d;
}

// Load + check + write back. Returns the fixed data. Prints problems (short) to stdout.
export async function checkFile(path, kind) {
  const text = readFileSync(path, 'utf8');
  let parsed;
  try { parsed = lenientParse(text); } catch (e) { console.log(`ERROR invalid JSON in ${path}: ${e.message}`); process.exit(1); }
  const warnings = [];
  const warn = m => warnings.push(m);
  if (parsed.fixed) warn('removed comments / trailing commas');
  const d = parsed.data;
  const type = kind || (Array.isArray(d.slides) ? 'deck' : 'infographic');
  try { await (type === 'deck' ? checkDeck(d, warn) : checkInfographic(d, warn)); } catch (e) { console.log(`ERROR ${e.message}`); process.exit(1); }
  const changed = parsed.fixed || JSON.stringify(d) !== JSON.stringify(JSON.parse(text));
  if (changed) writeFileSync(path, JSON.stringify(d, null, 2) + '\n');
  for (const w of warnings) console.log(`check: ${w}`);
  return d;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const f = process.argv[2];
  if (!f) { console.log('Usage: node scripts/check.mjs <file.json>'); process.exit(1); }
  await checkFile(resolve(f));
  console.log('check: OK');
}
