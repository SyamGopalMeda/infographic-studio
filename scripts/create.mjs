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
function runClaude(prompt) {
  return new Promise(resolveP => {
    const allowed = ['Read', 'Edit', 'Write', 'Glob', 'Grep'];
    // One fixed command string (no user text in it; the prompt goes via stdin). The shell resolves claude(.cmd).
    // No --plugin-dir: it marks this folder's files as protected plugin files and blocks the write.
    // The prompt points Claude at the skill file in this repo instead (works with or without the plugin installed).
    const cmd = `claude -p --permission-mode acceptEdits --allowedTools ${allowed.map(a => `"${a}"`).join(' ')}`;
    const child = spawn(cmd, { cwd: root, shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('error', e => { console.error('Could not start Claude Code:', e.message, '\nRun setup.bat first.'); resolveP(1); });
    child.on('close', code => resolveP(code ?? 1));
    child.stdin.end(prompt);
  });
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
    mkdirSync(join(root, 'input'), { recursive: true });
    name = slug(basename(asPath, ext));
    const local = join('input', `${stamp()}-${name}${ext}`).replace(/\\/g, '/');
    copyFileSync(asPath, join(root, local));
    console.log(`Image: ${local}`);
    what = `The input is an IMAGE at ${local}. Read it first.`;
  } else {
    if (input.length < 3) { console.error('Please give an image path or describe a scenario.'); return 1; }
    name = slug(input.split(/\s+/).slice(0, 6).join(' '));
    console.log(`Scenario: ${input.slice(0, 120)}${input.length > 120 ? '…' : ''}`);
    what = `The input is a written SCENARIO (no image):\n\n"""\n${input}\n"""`;
  }

  const prompt = `Make a ${M.label}. First read skills/${M.skill}/SKILL.md in this folder and follow it ` +
    `(this folder is the studio, so WORK is ${M.dir}/). ${what}\n\n` +
    `Use ${M.dir}/${name}.json as the file name.\n\n` +
    `You are running headless from scripts/create.mjs: do NOT run any command or script yourself; ${M.note} ` +
    'The caller renders the output right after you finish.';

  console.log(`Step 1/2  Claude is designing the ${M.label}… (about 1–2 minutes)\n`);
  const code = await runClaude(prompt);
  const file = newestJson(M.dir, started);
  if (code !== 0 || !file) {
    console.error(`\nClaude did not write a ${M.dir}/*.json file. Read the messages above (is Claude Code signed in? run: claude).`);
    return code || 1;
  }
  try { JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error(`\nInvalid JSON in ${file}: ${e.message}`); return 1; }

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

const args = process.argv.slice(2);
if (args.includes('--watch')) {
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
