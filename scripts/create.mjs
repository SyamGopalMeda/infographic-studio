// Turn an image OR a written scenario into an animated infographic or a PowerPoint deck,
// using Claude Code headless (Claude designs, these scripts render).
//
//   node scripts/create.mjs C:\path\to\image.png              animated infographic (MP4 + GIF + PPTX)
//   node scripts/create.mjs "how a student joins a course"    same, from a scenario
//   node scripts/create.mjs --deck "intro to our Python course" PowerPoint deck
//   node scripts/create.mjs [--deck]                           asks you
//   node scripts/create.mjs --watch                            auto: inbox/ -> infographic, inbox/deck/ -> deck

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, renameSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const TEXT = new Set(['.txt', '.md']);
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'post';

const MODES = {
  video: {
    label: 'animated infographic',
    skill: 'animated-infographic',
    dir: 'data',
    script: 'make.mjs',
    extra: ['--pptx'],
    note: 'just write the data file (valid JSON) and reply with one line describing it plus a LinkedIn caption.',
  },
  deck: {
    label: 'presentation deck',
    skill: 'presentation',
    dir: 'decks',
    script: 'deck.mjs',
    extra: [],
    note: 'just write the deck file decks/<name>.json (valid JSON) and reply with a one-line outline of the deck.',
  },
};

function newestJson(dir, since) {
  const d = join(root, dir);
  if (!existsSync(d)) return null;
  return readdirSync(d).filter(n => n.endsWith('.json')).map(n => join(d, n))
    .filter(p => statSync(p).mtimeMs >= since)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
}

function runNode(script, args) {
  return new Promise(r => {
    const c = spawn(process.execPath, [join(root, 'scripts', script), ...args], { cwd: root, stdio: 'inherit' });
    c.on('close', code => r(code ?? 1));
  });
}

// Runs Claude Code non-interactively. The prompt goes through stdin, so there are no shell quoting problems.
// Permissions are passed as flags: project settings are ignored until a folder is "trusted", which a
// fresh clone never is. Claude may only read and write files; it never runs commands here.
// Claude Code flags that cut tokens for this one job (measured: see README "Token usage"):
//  - Sonnet at low effort: half Opus's price per token, and less thinking
//  - --strict-mcp-config: no MCP servers (their tool definitions cost thousands of tokens per request)
//  - --disable-slash-commands: no skill/plugin listing (the format is given in the prompt instead)
//  - --tools: only the 3 tools needed, so fewer tool definitions are sent
//  - --max-budget-usd: hard stop if something loops
// The prompt goes through stdin (no shell quoting of user text). No --plugin-dir: it marks this
// folder's files as protected plugin files and blocks the write.
export const CLAUDE_FLAGS = ['--model', 'sonnet', '--effort', 'low', '--max-budget-usd', '1',
  '--permission-mode', 'acceptEdits', '--strict-mcp-config', '--disable-slash-commands',
  '--tools', 'Read,Write,Edit', '--allowedTools', 'Read', 'Write', 'Edit'];

function runClaude(prompt) {
  return new Promise(resolveP => {
    const cmd = `claude -p ${CLAUDE_FLAGS.map(a => (/[\s,]/.test(a) ? `"${a}"` : a)).join(' ')}`;
    const child = spawn(cmd, { cwd: root, shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('error', e => { console.error('Could not start Claude Code:', e.message, '\nRun setup.bat first.'); resolveP(1); });
    child.on('close', code => resolveP(code ?? 1));
    child.stdin.end(prompt);
  });
}

// Shrink an input image with the studio's prep step; returns the small PNG path (relative to the studio).
function prepImage(path) {
  return new Promise(r => {
    const c = spawn(process.execPath, [join(root, 'scripts', 'studio.mjs'), 'prep', path], { cwd: root });
    let out = ''; c.stdout.on('data', d => { out += d; });
    c.on('close', () => {
      const line = out.trim().split('\n').at(-1) || '';
      console.log(`Image: ${line}`);
      const p = line.split('  (')[0];
      r(existsSync(p) ? p.slice(root.length + 1).split('\\').join('/') : null);
    });
  });
}

// The compact design-only prompt (the format comes from the skill files, so there is one source of truth).
export function buildPrompt(mode, inputLine, file) {
  if (mode === 'deck') {
    const sk = readFileSync(join(root, 'skills', 'presentation', 'SKILL.md'), 'utf8');
    const fmt = sk.slice(sk.indexOf('```json'));
    return `Design a PowerPoint deck for Tech Drona and save it as ${file} (plain JSON). ` +
      'Do not run commands or ask questions. 8-12 slides: title, then one idea per slide, then closing. Mix slide types, ' +
      'use at most 5 short bullets per slide, put detail in "notes", and never invent statistics. Use "author": "Tech Drona".\n\n' +
      `${inputLine}\n\nFormat:\n${fmt.replaceAll('${CLAUDE_PLUGIN_ROOT}/', '')}\n\nAfter writing, reply with a one-line outline only.`;
  }
  const schema = readFileSync(join(root, 'skills', 'animated-infographic', 'schema.md'), 'utf8');
  return `Design an animated infographic for Tech Drona and save it as ${file} (plain JSON). ` +
    'Do not run commands or ask questions. Make a clear top-to-bottom flow: for a process, triggers -> stages (bar) -> details (group) -> outcome (final); ' +
    'for a system, channels (card) -> categories (bar) -> tools (group) -> outcome. From a diagram image, keep its structure but reword it, ' +
    'and never use the original creator\'s name. Use real brand logos only for real technology, otherwise emoji icons.\n\n' +
    `${inputLine}\n\n${schema}\n\nAfter writing, reply with a LinkedIn caption only (a hook, 2-3 lines and 3-5 hashtags).`;
}

async function create(input, { mode = 'video', open = !process.env.NO_OPEN } = {}) {
  const M = MODES[mode];
  input = input.trim().replace(/^"(.*)"$/, '$1');
  const started = Date.now() - 1000;
  let what, name;

  const asPath = resolve(input);
  if (input && existsSync(asPath) && statSync(asPath).isFile()) {
    const ext = extname(asPath).toLowerCase();
    if (TEXT.has(ext)) return create(readFileSync(asPath, 'utf8'), { mode, open });
    if (!IMG.has(ext)) { console.error(`Not an image or text file: ${asPath}`); return 1; }
    name = slug(basename(asPath, ext));
    const small = await prepImage(asPath);
    if (!small) { console.error('Could not read that image.'); return 1; }
    what = `Input: the IMAGE at ${small} (Read it once).`;
  } else {
    if (input.length < 3) { console.error('Please give an image path or describe a scenario.'); return 1; }
    name = slug(input.split(/\s+/).slice(0, 6).join(' '));
    console.log(`Scenario: ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`);
    what = `Input scenario:\n"""\n${input}\n"""`;
  }

  const prompt = buildPrompt(mode, what, `${M.dir}/${name}.json`);

  console.log(`Step 1/2  Claude is designing the ${M.label}… (about 1–2 minutes)\n`);
  const code = await runClaude(prompt);
  const file = newestJson(M.dir, started);
  if (code !== 0 || !file) {
    console.error(`\nClaude did not write a ${M.dir}/*.json file. Read the messages above (is Claude Code signed in? run: claude).`);
    return code || 1;
  }
  console.log(`\nStep 2/2  Rendering ${basename(file)}…`);
  const rc = await runNode(M.script, [file, ...M.extra]);
  if (rc !== 0) { console.error('\nRendering failed (see above).'); return rc; }
  const out = join(root, 'out', basename(file, '.json'));
  console.log(`\nDone → ${out}`);
  if (open && process.platform === 'win32') spawn('explorer', [out], { detached: true, stdio: 'ignore' }).unref();
  else if (open && process.platform === 'darwin') spawn('open', [out], { detached: true, stdio: 'ignore' }).unref();
  return 0;
}

async function watch() {
  const folders = [
    { dir: join(root, 'inbox'), mode: 'video' },
    { dir: join(root, 'inbox', 'deck'), mode: 'deck' },
  ];
  for (const f of folders) mkdirSync(join(f.dir, 'done'), { recursive: true });
  console.log('Watching:\n' +
    `  ${folders[0].dir}  -> animated infographic\n` +
    `  ${folders[1].dir}  -> PowerPoint deck\n` +
    'Drop images (.png/.jpg/.webp) or scenario text files (.txt). Ctrl+C to stop.\n');
  const busy = new Set();
  const queue = [];
  let running = false;
  const pump = async () => {
    if (running) return;
    running = true;
    while (queue.length) {
      const { file, mode, dir } = queue.shift();
      console.log(`\n=== ${basename(file)} (${MODES[mode].label}) ===`);
      await create(file, { mode, open: false });
      try { renameSync(file, join(dir, 'done', `${stamp()}-${basename(file)}`)); } catch { /* in use; leave it */ }
      busy.delete(file);
    }
    running = false;
  };
  const scan = () => {
    for (const { dir, mode } of folders) {
      for (const n of readdirSync(dir)) {
        const file = join(dir, n);
        const ext = extname(n).toLowerCase();
        if (busy.has(file) || !statSync(file).isFile() || !(IMG.has(ext) || TEXT.has(ext))) continue;
        const size = statSync(file).size; // wait until copying has finished (size stable for 1 s)
        setTimeout(() => {
          if (!existsSync(file) || busy.has(file) || statSync(file).size !== size) return;
          busy.add(file); queue.push({ file, mode, dir }); pump();
        }, 1000);
      }
    }
  };
  scan();
  setInterval(scan, 2000);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const args = isMain ? process.argv.slice(2) : [];
if (!isMain) { /* imported (e.g. by measure scripts): do nothing */ }
else if (args.includes('--watch')) {
  await watch();
} else {
  const mode = args.includes('--deck') ? 'deck' : 'video';
  let input = args.filter(a => a !== '--deck').join(' ');
  if (!input) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    input = await rl.question(`Make a ${MODES[mode].label}.\nDrag an image here (or paste its path), or type a scenario, then press Enter:\n> `);
    rl.close();
  }
  process.exitCode = await create(input, { mode });
}
