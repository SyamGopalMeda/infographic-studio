// Turn an image OR a written scenario into an animated infographic, using Claude Code headless.
//
//   node scripts/create.mjs C:\path\to\image.png        image input
//   node scripts/create.mjs "how a student joins a course"   scenario text
//   node scripts/create.mjs                               asks you
//   node scripts/create.mjs --watch                       auto-convert anything dropped into inbox/

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, renameSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'post';

function newestDataFile(since) {
  const dir = join(root, 'data');
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter(n => n.endsWith('.json')).map(n => join(dir, n))
    .filter(p => statSync(p).mtimeMs >= since)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || null;
}

function render(dataFile) {
  return new Promise(r => {
    const c = spawn(process.execPath, [join(root, 'scripts', 'make.mjs'), dataFile], { cwd: root, stdio: 'inherit' });
    c.on('close', code => r(code ?? 1));
  });
}

const HEADLESS_NOTE = '\n\nYou are running headless from scripts/create.mjs: do NOT run make.mjs yourself — ' +
  'just write the data file (valid JSON) and reply with one line describing it plus the LinkedIn caption. ' +
  'The caller renders the video right after you finish.';

// Runs Claude Code non-interactively. The prompt goes through stdin so no shell quoting problems.
function runClaude(prompt) {
  return new Promise((resolveP) => {
    // Permissions are passed as flags (project settings are ignored until a folder is "trusted",
    // which a fresh clone never is). Only the render script may run; edits are limited to this folder.
    // Claude only designs (writes data/*.json); this script renders the video itself afterwards.
    const allowed = ['Read', 'Edit', 'Write', 'Glob', 'Grep'];
    const child = spawn('claude', ['-p', '--permission-mode', 'acceptEdits',
      '--allowedTools', ...allowed.map(a => `"${a}"`)], {
      cwd: root, shell: true, stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', e => { console.error('Could not start Claude Code:', e.message, '\nRun setup.bat first.'); resolveP(1); });
    child.on('close', code => resolveP(code ?? 1));
    child.stdin.end(prompt);
  });
}

async function create(input, { open = !process.env.NO_OPEN } = {}) {
  input = input.trim().replace(/^"(.*)"$/, '$1');
  const started = Date.now() - 1000;
  let prompt;

  const asPath = resolve(input);
  if (existsSync(asPath) && statSync(asPath).isFile()) {
    const ext = extname(asPath).toLowerCase();
    if (ext === '.txt' || ext === '.md') {
      return create(readFileSync(asPath, 'utf8'), { open });
    }
    if (!IMG.has(ext)) { console.error(`Not an image: ${asPath}`); return 1; }
    mkdirSync(join(root, 'input'), { recursive: true });
    const local = join('input', `${stamp()}-${slug(basename(asPath, ext))}${ext}`);
    copyFileSync(asPath, join(root, local));
    console.log(`Image: ${local}`);
    prompt = `Use the animated-infographic skill. The input is an IMAGE at ${local.replace(/\\/g, '/')}. ` +
      `Read it, then create the animated infographic. Use data/${slug(basename(asPath, ext))}.json as the data file name.`;
  } else {
    if (input.length < 3) { console.error('Please give an image path or describe a scenario.'); return 1; }
    console.log(`Scenario: ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`);
    prompt = `Use the animated-infographic skill. The input is a written SCENARIO (no image):\n\n"""\n${input}\n"""\n\n` +
      `Design the best layered flow for it, then create the animated infographic. ` +
      `Use data/${slug(input.split(/\s+/).slice(0, 6).join(' '))}.json as the data file name.`;
  }

  console.log('Step 1/2  Claude is designing the infographic… (about 1–2 minutes)\n');
  const code = await runClaude(prompt + HEADLESS_NOTE);
  const dataFile = newestDataFile(started);
  if (code !== 0 || !dataFile) {
    console.error('\nClaude did not produce a data file. Read the messages above (is Claude Code signed in? run: claude).');
    return code || 1;
  }
  try { JSON.parse(readFileSync(dataFile, 'utf8')); } catch (e) { console.error(`\nInvalid JSON in ${dataFile}: ${e.message}`); return 1; }

  console.log(`\nStep 2/2  Rendering video from ${basename(dataFile)}…`);
  const rc = await render(dataFile);
  const out = join(root, 'out', basename(dataFile, '.json'));
  if (rc !== 0) { console.error('\nRendering failed (see above).'); return rc; }
  console.log(`\nDone → ${out}`);
  if (open && process.platform === 'win32') spawn('explorer', [out], { detached: true, stdio: 'ignore' }).unref();
  else if (open && process.platform === 'darwin') spawn('open', [out], { detached: true, stdio: 'ignore' }).unref();
  return 0;
}

async function watch() {
  const inbox = join(root, 'inbox');
  const done = join(inbox, 'done');
  mkdirSync(done, { recursive: true });
  console.log(`Watching ${inbox}\nDrop images (.png/.jpg/.webp) or scenario text files (.txt) here. Ctrl+C to stop.\n`);
  const busy = new Set();
  const queue = [];
  let running = false;
  const pump = async () => {
    if (running) return;
    running = true;
    while (queue.length) {
      const f = queue.shift();
      console.log(`\n=== ${basename(f)} ===`);
      await create(f, { open: false });
      try { renameSync(f, join(done, `${stamp()}-${basename(f)}`)); } catch { /* file in use; leave it */ }
      busy.delete(f);
    }
    running = false;
  };
  const scan = () => {
    for (const n of readdirSync(inbox)) {
      const f = join(inbox, n);
      const ext = extname(n).toLowerCase();
      if (busy.has(f) || !statSync(f).isFile() || !(IMG.has(ext) || ext === '.txt' || ext === '.md')) continue;
      // wait until the file has finished copying (size stable for 1s)
      const s1 = statSync(f).size;
      setTimeout(() => {
        if (!existsSync(f) || busy.has(f) || statSync(f).size !== s1) return;
        busy.add(f); queue.push(f); pump();
      }, 1000);
    }
  };
  scan();
  setInterval(scan, 2000);
}

const args = process.argv.slice(2);
if (args.includes('--watch')) {
  await watch();
} else {
  let input = args.join(' ');
  if (!input) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    input = await rl.question('Drag an image here (or paste its path), or type a scenario, then press Enter:\n> ');
    rl.close();
  }
  process.exitCode = await create(input);
}
