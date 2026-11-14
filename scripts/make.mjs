// Build an animated infographic from a data JSON file.
//
//   node scripts/make.mjs data/my-post.json            -> HTML + MP4 + GIF
//   node scripts/make.mjs data/my-post.json --no-video -> HTML preview only
//   options: --seconds 6  --fps 30  --no-gif
//
// Output goes to out/<data-file-name>/ (infographic.html, infographic.mp4, infographic.gif)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const dataArg = args.find(a => !a.startsWith('--') && a.endsWith('.json'));

if (!dataArg) {
  console.error('Usage: node scripts/make.mjs data/<name>.json [--no-video] [--no-gif] [--seconds 6] [--fps 30]');
  process.exit(1);
}

const dataPath = resolve(process.cwd(), dataArg);
const data = JSON.parse(readFileSync(dataPath, 'utf8')); // fail fast on bad JSON
const name = basename(dataPath, '.json');
const outDir = join(root, 'out', name);
mkdirSync(outDir, { recursive: true });

// 1) HTML: template + inlined data (works by double-clicking, no server needed)
const template = readFileSync(join(root, 'template', 'infographic.html'), 'utf8');
const safeJson = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
const html = template.replace('/*DATA*/', () => safeJson);
const htmlPath = join(outDir, 'infographic.html');
writeFileSync(htmlPath, html);
console.log(`HTML  -> ${htmlPath}`);

if (flag('no-video')) process.exit(0);

// 2) MP4: step the animation frame by frame in headless Chromium, pipe PNGs to ffmpeg
const { chromium } = await import('playwright');
const ffmpegPath = (await import('ffmpeg-static')).default;
if (!ffmpegPath || !existsSync(ffmpegPath)) { console.error('ffmpeg-static binary missing. Run: npm install'); process.exit(1); }

const loop = Number(data.animation?.loopSeconds || 3);
const seconds = Number(opt('seconds', loop * 2)); // a whole number of loops = seamless
const fps = Number(opt('fps', 30));
const frames = Math.round(seconds * fps);
const mp4Path = join(outDir, 'infographic.mp4');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href + '?capture', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });

const run = (argv) => spawn(ffmpegPath, argv, { stdio: ['pipe', 'ignore', 'pipe'] });
const ff = run(['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', mp4Path]);
let ffErr = '';
ff.stderr.on('data', d => { ffErr += d; });
const ffDone = new Promise(r => ff.on('close', r));

for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.renderAt(t), i / fps);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\rframes ${i}/${frames}`);
}
ff.stdin.end();
await browser.close();
const code = await ffDone;
process.stdout.write('\n');
if (code !== 0) { console.error(ffErr.slice(-2000)); process.exit(code); }
console.log(`MP4   -> ${mp4Path}`);

// 3) GIF (optional): two-pass palette for clean colours, 15 fps to keep it small
if (!flag('no-gif')) {
  const gifPath = join(outDir, 'infographic.gif');
  const width = opt('gif-width', '810');
  const g = run(['-y', '-i', mp4Path, '-vf',
    `fps=15,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    '-loop', '0', gifPath]);
  let gErr = ''; g.stderr.on('data', d => { gErr += d; });
  const gc = await new Promise(r => g.on('close', r));
  if (gc !== 0) { console.error(gErr.slice(-2000)); process.exit(gc); }
  console.log(`GIF   -> ${gifPath}`);
}
console.log('Done. Post the MP4 on LinkedIn (sharper and smaller than the GIF).');
