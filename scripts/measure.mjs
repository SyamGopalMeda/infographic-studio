// Measure the tokens and cost of one headless design run (the step where Claude writes the JSON).
//
//   node scripts/measure.mjs <label> <flags-json> <prompt-file>
//
// Prints one line: label, model(s), input / cache-read / cache-write / output tokens, turns, cost (USD).
// Used to compare token usage before and after changes. Not part of normal use.

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [label, flagsJson, promptFile] = process.argv.slice(2);
const flags = JSON.parse(flagsJson || '[]');
const prompt = readFileSync(promptFile, 'utf8');

const cmd = ['claude', '-p', '--output-format', 'json', ...flags].map(a => (/[\s()*"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
const child = spawn(cmd, { cwd: root, shell: true, stdio: ['pipe', 'pipe', 'inherit'] });
let out = '';
child.stdout.on('data', d => { out += d; });
child.stdin.end(prompt);
child.on('close', () => {
  try {
    const r = JSON.parse(out.trim().split('\n').filter(Boolean).at(-1));
    const u = r.usage || {};
    const models = Object.keys(r.modelUsage || {}).join('+') || '?';
    console.log([label, models,
      `in=${u.input_tokens ?? '?'}`, `cacheRead=${u.cache_read_input_tokens ?? '?'}`,
      `cacheWrite=${u.cache_creation_input_tokens ?? '?'}`, `out=${u.output_tokens ?? '?'}`,
      `turns=${r.num_turns ?? '?'}`, `cost=$${(r.total_cost_usd ?? 0).toFixed(4)}`].join('  '));
  } catch (e) {
    console.log(`${label}  could not parse result: ${e.message}\n${out.slice(-600)}`);
  }
});
