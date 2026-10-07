#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gates = [
  ['browser', 'scripts/qa-p3-browser.mjs'],
  ['runtime', 'scripts/qa-p5-runtime.mjs'],
  ['xss', 'scripts/qa-p5-xss-sinks.mjs'],
  ['axe', 'scripts/qa-p5-axe-runtime.mjs'],
];

function runGate([id, script]) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, script)], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ id, script, code: 1, stdout, stderr: stderr + String(error) }));
    child.on('exit', (code) => resolve({ id, script, code: code ?? 1, stdout, stderr }));
  });
}

function emit(result) {
  process.stdout.write(`\n===== P5 runtime gate ${result.id} =====\n`);
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : result.stderr + '\n');
}

const startedAt = Date.now();
const results = await Promise.all(gates.map(runGate));
for (const result of results) emit(result);

const failed = results.filter((result) => result.code !== 0);
console.log(JSON.stringify({
  classification: 'SORTIO_P5_RUNTIME_GATES_PARALLEL',
  status: failed.length ? 'FAIL' : 'PASS',
  elapsedMs: Date.now() - startedAt,
  gates: results.map(({ id, script, code }) => ({ id, script, code, pass: code === 0 })),
}, null, 2));

if (failed.length) process.exit(1);
