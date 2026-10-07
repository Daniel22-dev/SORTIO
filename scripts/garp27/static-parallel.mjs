#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const gates = [
  ['contracts', 'scripts/garp27/contract-gate.mjs'],
  ['architecture', 'scripts/garp27/architecture-integrity.mjs'],
  ['policy-mutations', 'scripts/garp27/policy-admission-mutations.mjs'],
  ['mutations', 'scripts/garp27/mutation-tests.mjs'],
  ['auto-patch', 'scripts/garp27/auto-patch-contract.mjs'],
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

const startedAt = Date.now();
const results = await Promise.all(gates.map(runGate));

for (const result of results) {
  process.stdout.write(`\n===== GARP 2.7 ${result.id} =====\n`);
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : result.stderr + '\n');
}

const failed = results.filter((result) => result.code !== 0);
console.log(JSON.stringify({
  classification: 'GARP27_STATIC_PARALLEL_ORCHESTRATION',
  status: failed.length ? 'FAIL' : 'PASS',
  elapsedMs: Date.now() - startedAt,
  gates: results.map(({ id, script, code }) => ({ id, script, code, pass: code === 0 })),
}, null, 2));

if (failed.length) process.exit(1);
