#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const EXPECTED_PLAYWRIGHT_VERSION = '1.61.1';
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules', 'playwright', 'package.json'), 'utf8'));

if (pkg.version !== EXPECTED_PLAYWRIGHT_VERSION) {
  throw new Error(`Playwright provisioning FAIL: expected ${EXPECTED_PLAYWRIGHT_VERSION}, got ${pkg.version}.`);
}

const executablePath = chromium.executablePath();

async function probe(label) {
  if (!fs.existsSync(executablePath)) {
    throw new Error(`${label}: expected Chromium executable is missing at ${executablePath}`);
  }
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const version = browser.version();
    if (!version) throw new Error(`${label}: browser version is empty`);
    console.log(`[playwright-provision] ${label}: PASS ${version} @ ${executablePath}`);
  } finally {
    await browser.close();
  }
}

async function installFallback() {
  console.log('[playwright-provision] Cache/browser probe failed; running pinned Playwright fallback with OS dependencies.');
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['playwright', 'install', '--with-deps', 'chromium'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Playwright provisioning FAIL: fallback installer exited with ${result.status}.`);
  }
}

let cacheReady = false;
try {
  await probe('restored browser launch probe');
  cacheReady = true;
} catch (error) {
  console.log(`[playwright-provision] Initial probe unavailable: ${error.message}`);
}

if (!cacheReady) {
  await installFallback();
  await probe('post-install browser launch probe');
}

if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `CHROMIUM_PATH=${executablePath}\n`);
}
console.log(`CHROMIUM_PATH=${executablePath}`);
