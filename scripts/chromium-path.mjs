import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function addPlaywrightCandidates(candidates, root) {
  if (!root || !fs.existsSync(root)) return;
  let names = [];
  try { names = fs.readdirSync(root); } catch { return; }
  for (const name of names.filter((entry) => entry.startsWith('chromium-') || entry.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const base = path.join(root, name);
    candidates.push(
      path.join(base, 'chrome-linux', 'chrome'),
      path.join(base, 'chrome-linux64', 'chrome'),
      path.join(base, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
      path.join(base, 'chrome-headless-shell-linux', 'chrome-headless-shell'),
    );
  }
}

export function findChromiumPath() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.GHRAB_CHROMIUM_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/lib/chromium/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  const playwrightRoot = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(os.homedir(), '.cache', 'ms-playwright');
  addPlaywrightCandidates(candidates, playwrightRoot);
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  throw new Error('Chromium není dostupné. Nastavte CHROMIUM_PATH/GHRAB_CHROMIUM_PATH nebo nainstalujte Playwright Chromium.');
}
