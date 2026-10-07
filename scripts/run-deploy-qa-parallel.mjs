#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reporter = ['reporter', 'scripts/test-error-reporter.mjs'];
const deterministicGates = [
  ['technical', 'scripts/qa-technical.mjs'],
  ['security', 'scripts/qa-security.mjs'],
  ['pwa', 'scripts/qa-pwa.mjs'],
  ['combinatorial', 'scripts/qa-combinatorial.mjs'],
];

function runNode([id, script]) {
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
  process.stdout.write(`\n===== deploy QA ${result.id} =====\n`);
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : result.stderr + '\n');
}

const startedAt = Date.now();
const reporterPromise = runNode(reporter);
const deterministicResults = [];

for (const gate of deterministicGates) {
  const result = await runNode(gate);
  deterministicResults.push(result);
  emit(result);
  if (result.code !== 0) break;
}

const reporterResult = await reporterPromise;
emit(reporterResult);

const failed = [...deterministicResults, reporterResult].filter((result) => result.code !== 0);
console.log(JSON.stringify({
  classification: 'SORTIO_DEPLOY_QA_PARALLEL_ORCHESTRATION',
  status: failed.length ? 'FAIL' : 'PASS',
  elapsedMs: Date.now() - startedAt,
  reporter: { code: reporterResult.code, pass: reporterResult.code === 0 },
  deterministic: deterministicResults.map(({ id, code }) => ({ id, code, pass: code === 0 })),
}, null, 2));

if (failed.length) process.exit(1);
