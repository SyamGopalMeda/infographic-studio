// Build an animated infographic from a data JSON file.
//
//   node scripts/make.mjs data/my-post.json             -> HTML + MP4 + GIF + poster.png
//   node scripts/make.mjs data/my-post.json --no-video  -> HTML preview only
//   options: --format portrait|landscape|square  --seconds 6  --fps 30  --no-gif  --pptx  --out <dir>
//
// Output goes to out/<data-file-name>/ (or --out).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { checkFile } from './check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const dataArg = args.find((a, i) => !a.startsWith('--') && a.endsWith('.json') && !args[i - 1]?.startsWith('--out'));

if (!dataArg) {
  console.error('Usage: node scripts/make.mjs data/<name>.json [--no-video] [--no-gif] [--pptx] [--format landscape] [--seconds 6] [--fps 30]');
  process.exit(1);
}

const SIZES = { portrait: [1080, 1350], landscape: [1920, 1080], square: [1080, 1080] };
const dataPath = resolve(process.cwd(), dataArg);
// Validate + auto-fix first (prints only problems). --no-check skips it.
const data = flag('no-check') ? JSON.parse(readFileSync(dataPath, 'utf8')) : await checkFile(dataPath, 'infographic');
if (opt('format')) data.format = opt('format');
if (!SIZES[data.format]) data.format = 'portrait';
const [W, H] = SIZES[data.format];

const name = basename(dataPath, '.json');
// Inside the studio repo: out/<name>/. Used from another project (plugin): next to the JSON, <dir>/<name>/.
const inStudio = dataPath.toLowerCase().startsWith(root.toLowerCase());
const outDir = resolve(opt('out', inStudio ? join(root, 'out', name) : join(dirname(dataPath), name)));
mkdirSync(outDir, { recursive: true });

// 1) HTML: template + inlined data (works by double-clicking, no server needed)
const template = readFileSync(join(root, 'template', 'infographic.html'), 'utf8');
const safeJson = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
const htmlPath = join(outDir, 'infographic.html');
writeFileSync(htmlPath, template.replace('/*DATA*/', () => safeJson));
const made = ['infographic.html'];
const tty = process.stdout.isTTY; // progress lines only for people, not for Claude (saves tokens)

if (flag('no-video')) { console.log(`Done: ${outDir} [infographic.html]`); process.exit(0); }

// 2) MP4: step the animation frame by frame in headless Chromium, pipe PNGs to ffmpeg
const { chromium } = await import('playwright');
const ffmpegPath = (await import('ffmpeg-static')).default;
if (!ffmpegPath || !existsSync(ffmpegPath)) { console.error('ffmpeg missing. Run setup.bat'); process.exit(1); }

const loop = Number(data.animation?.loopSeconds || 3);
const seconds = Number(opt('seconds', loop * 2)); // a whole number of loops = seamless
const fps = Number(opt('fps', 30));
const frames = Math.round(seconds * fps);
const mp4Path = join(outDir, 'infographic.mp4');
const posterPath = join(outDir, 'poster.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href + '?capture', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const report = await page.evaluate(() => window.__report || null);

const run = argv => spawn(ffmpegPath, argv, { stdio: ['pipe', 'ignore', 'pipe'] });
const ff = run(['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', mp4Path]);
let ffErr = '';
ff.stderr.on('data', d => { ffErr += d; });
const ffDone = new Promise(r => ff.on('close', r));

for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.renderAt(t), i / fps);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
  if (i === Math.round(fps * 0.4)) writeFileSync(posterPath, png); // still image (dots mid-way)
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (tty && i % fps === 0) process.stdout.write(`\rframes ${i}/${frames}`);
}
ff.stdin.end();
await browser.close();
const code = await ffDone;
if (tty) process.stdout.write('\n');
if (code !== 0) { console.error(ffErr.slice(-1500)); process.exit(code); }
made.push('infographic.mp4', 'poster.png');

// 3) GIF (optional): two-pass palette for clean colours, 15 fps to keep it small
if (!flag('no-gif')) {
  const gifPath = join(outDir, 'infographic.gif');
  const width = opt('gif-width', String(Math.round(W * 0.75)));
  const g = run(['-y', '-i', mp4Path, '-vf',
    `fps=15,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    '-loop', '0', gifPath]);
  let gErr = ''; g.stderr.on('data', d => { gErr += d; });
  const gc = await new Promise(r => g.on('close', r));
  if (gc !== 0) { console.error(gErr.slice(-2000)); process.exit(gc); }
  made.push('infographic.gif');
}

// 4) PPTX (optional): one 16:9 slide with the animation playing (poster shown until it starts)
if (flag('pptx')) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  const SW = 13.333, SH = 7.5, k = Math.min(SW / W, SH / H);
  const w = W * k, h = H * k, x = (SW - w) / 2, y = (SH - h) / 2;
  const cover = 'data:image/png;base64,' + readFileSync(posterPath).toString('base64');
  s.addMedia({ type: 'video', path: mp4Path, x, y, w, h, cover });
  const pptxPath = join(outDir, 'infographic.pptx');
  await pptx.writeFile({ fileName: pptxPath });
  made.push('infographic.pptx');
}

// Short text summary so nobody has to open the image to check it.
if (report) {
  const issues = [];
  if (report.overflow > 0) issues.push(`content is ${report.overflow}px too tall: remove rows or shorten text`);
  if (report.font < 12) issues.push(`text is small (${report.font}px): use fewer rows/items`);
  if (report.missing?.length) issues.push(`logos not loaded: ${report.missing.join(', ')}`);
  console.log(`summary: ${report.rows} rows, ${report.wires} lines, text ${report.font}px, ${issues.length ? 'ISSUES: ' + issues.join('; ') : 'fits, all logos loaded'}`);
}
console.log(`Done: ${outDir} [${made.join(', ')}]`);
