// Entry point the skills call from ANY folder:
//
//   node "<studio>/scripts/studio.mjs" make <file.json> [make options]   animated infographic
//   node "<studio>/scripts/studio.mjs" deck <file.json>                  PowerPoint deck
//   node "<studio>/scripts/studio.mjs" check                             install/verify packages only
//
// On first use (for example a fresh plugin install) it installs the studio's own packages
// into the studio folder and downloads the headless browser. Later runs skip that.

import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);

const sh = command => new Promise(r => {
  const c = spawn(command, { cwd: root, shell: true, stdio: 'inherit' });
  c.on('close', code => r(code ?? 1));
});

async function ensureDeps() {
  const nm = join(root, 'node_modules');
  const ok = ['playwright/package.json', 'pptxgenjs/package.json', 'ffmpeg-static/package.json']
    .every(p => existsSync(join(nm, p)));
  const ffmpeg = existsSync(join(nm, 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));
  if (ok && ffmpeg) return 0;
  console.log('First run: installing Infographic Studio packages (about 1–2 minutes)…');
  let code = await sh(existsSync(join(root, 'package-lock.json')) ? 'npm ci --no-audit --no-fund' : 'npm install --no-audit --no-fund');
  if (code !== 0) return code;
  code = await sh('npx playwright install chromium');
  return code;
}

const scripts = { make: 'make.mjs', deck: 'deck.mjs' };
if (!cmd || !(cmd in scripts || cmd === 'check')) {
  console.error('Usage: node studio.mjs make|deck <file.json> [options]   |   node studio.mjs check');
  process.exit(1);
}

const dep = await ensureDeps();
if (dep !== 0) { console.error('Package install failed. Check your internet connection and that Node.js 18+ is installed.'); process.exit(dep); }
if (cmd === 'check') { console.log(`Infographic Studio ready at ${root}`); process.exit(0); }

const child = spawn(process.execPath, [join(root, 'scripts', scripts[cmd]), ...rest], { stdio: 'inherit' });
child.on('close', code => process.exit(code ?? 1));
