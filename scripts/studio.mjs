// Entry point the skills call from ANY folder. Output is kept to a few short lines (it costs Claude tokens).
//
//   node "<studio>/scripts/studio.mjs" prep  <image> [--max 1024]   shrink an input image before Claude reads it
//   node "<studio>/scripts/studio.mjs" check <file.json>             validate + auto-fix, print problems only
//   node "<studio>/scripts/studio.mjs" make  <file.json> [options]   animated infographic (MP4/GIF/PPTX)
//   node "<studio>/scripts/studio.mjs" deck  <file.json>             PowerPoint deck
//   node "<studio>/scripts/studio.mjs" install                       install packages only (setup uses this)
//
// On first use it installs the studio's packages into the studio folder (log: install.log).

import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);
const USAGE = 'Usage: node studio.mjs prep <image> | check <file.json> | make <file.json> [options] | deck <file.json> | install';

function sh(command, logFd) {
  return new Promise(r => {
    const c = spawn(command, { cwd: root, shell: true, stdio: ['ignore', logFd ?? 'inherit', logFd ?? 'inherit'] });
    c.on('close', code => r(code ?? 1));
  });
}

async function ensureDeps() {
  const nm = join(root, 'node_modules');
  const ok = ['playwright/package.json', 'pptxgenjs/package.json', 'ffmpeg-static/package.json'].every(p => existsSync(join(nm, p)))
    && existsSync(join(nm, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));
  if (ok) return 0;
  console.log('First run: installing studio packages (1-2 min, log: install.log)...');
  const log = openSync(join(root, 'install.log'), 'a');
  let code = await sh(existsSync(join(root, 'package-lock.json')) ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund', log);
  if (code === 0) code = await sh('npx playwright install chromium', log);
  closeSync(log);
  if (code !== 0) console.log(`Install failed (see ${join(root, 'install.log')}). Check internet and Node.js 18+.`);
  return code;
}

// Shrink an image so Claude reads fewer tokens: tokens ~= ceil(w/28) * ceil(h/28).
async function prep(img, max) {
  const ffmpeg = (await import('ffmpeg-static')).default;
  const src = resolve(img);
  if (!existsSync(src)) { console.log(`ERROR no such image: ${src}`); return 1; }
  const inStudio = process.cwd().toLowerCase().startsWith(root.toLowerCase());
  const dir = inStudio ? join(root, 'input') : join(process.cwd(), 'infographics', '_input');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${basename(src, extname(src)).replace(/[^\w-]+/g, '-')}-${max}.png`);
  const vf = `scale='min(${max},iw)':'min(${max},ih)':force_original_aspect_ratio=decrease`;
  const c = spawn(ffmpeg, ['-y', '-i', src, '-vf', vf, '-frames:v', '1', out], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; c.stderr.on('data', d => { err += d; });
  const code = await new Promise(r => c.on('close', r));
  if (code !== 0) { console.log(`ERROR could not read image: ${err.split('\n').filter(Boolean).at(-1)}`); return 1; }
  const dims = [...err.matchAll(/, (\d{2,5})x(\d{2,5})[, ]/g)].map(m => [+m[1], +m[2]]);
  const [a, b] = [dims[0], dims.at(-1)];
  const tok = d => (d ? Math.ceil(d[0] / 28) * Math.ceil(d[1] / 28) : '?');
  console.log(`${out}  (${a ? a.join('x') : '?'} -> ${b ? b.join('x') : '?'}, ~${tok(a)} -> ~${tok(b)} image tokens)`);
  return 0;
}

const scripts = { make: 'make.mjs', deck: 'deck.mjs', check: 'check.mjs' };
if (!cmd || !(cmd in scripts || cmd === 'install' || cmd === 'prep')) { console.log(USAGE); process.exit(1); }

const dep = await ensureDeps();
if (dep !== 0) process.exit(dep);
if (cmd === 'install') { console.log(`Ready: ${root}`); process.exit(0); }
if (cmd === 'prep') {
  const i = rest.indexOf('--max');
  const max = i >= 0 ? Number(rest[i + 1]) || 1024 : 1024;
  process.exit(await prep(rest.find((a, k) => !a.startsWith('--') && rest[k - 1] !== '--max'), max));
}

const child = spawn(process.execPath, [join(root, 'scripts', scripts[cmd]), ...rest], { stdio: 'inherit' });
child.on('close', code => process.exit(code ?? 1));
