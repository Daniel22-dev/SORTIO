#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import process from 'node:process';

const workflowPath = '.github/workflows/deploy.yml';
const workflow = readFileSync(new URL(`../${workflowPath}`, import.meta.url), 'utf8');

const fail = (message) => {
  console.error(`[AUTO-PATCH-NOTIFY] FAIL: ${message}`);
  process.exit(1);
};

const indexOf = (needle, label) => {
  const index = workflow.indexOf(needle);
  if (index < 0) fail(`${label} is missing`);
  return index;
};

if (!/push:\s*\n\s*branches:\s*\n\s*- main/.test(workflow)) {
  fail('production deploy must be push-triggered from main');
}
if (/push:[\s\S]*?branches:[\s\S]*?candidate/.test(workflow.split('workflow_dispatch:')[0])) {
  fail('candidate must never trigger the production deploy workflow');
}
if (!/if:\s*github\.ref == ['"]refs\/heads\/main['"]/.test(workflow)) {
  fail('deploy job must fail closed to refs/heads/main');
}

const credential = indexOf('Verify AI Studio dispatch credential', 'credential preflight');
const configure = indexOf('Configure GitHub Pages', 'GitHub Pages configuration');
const deploy = indexOf('Deploy to GitHub Pages', 'GitHub Pages deployment');
const liveCheck = indexOf('Wait for deployed LIVE Studio manifest', 'LIVE manifest verification');
const dispatch = indexOf('Dispatch app-updated event to AI Studio', 'AI Studio dispatch');

if (!(credential < configure && configure < deploy && deploy < liveCheck && liveCheck < dispatch)) {
  fail('required order is credential -> configure/upload -> deploy -> live verification -> dispatch');
}

for (const required of [
  'AI_STUDIO_DISPATCH_TOKEN',
  'Missing AI_STUDIO_DISPATCH_TOKEN',
  'for attempt in $(seq 1 18)',
  'releaseIdentity?.source?.repository',
  'releaseIdentity?.source?.commit',
  'source_repository:process.env.SOURCE_REPOSITORY',
  'source_sha:process.env.SOURCE_SHA',
  'https://api.github.com/repos/Daniel22-dev/AI-Studio-GHRAB/dispatches',
]) {
  if (!workflow.includes(required)) fail(`required contract fragment missing: ${required}`);
}
if (!/event_type:\s*["']app-updated["']/.test(workflow)) fail('dispatch event_type must be app-updated');
if (!/app_id:\s*["']sortio["']/.test(workflow)) fail('dispatch app_id must be sortio');
if (!/manifest_url:process\.env\.MANIFEST_URL/.test(workflow)) fail('dispatch must include the verified manifest URL');

if (/echo[^\n]*(?:\$AI_STUDIO_DISPATCH_TOKEN|\$\{AI_STUDIO_DISPATCH_TOKEN(?:[^}]*)?\})/.test(workflow)) {
  fail('dispatch credential value must never be echoed');
}

console.log('[AUTO-PATCH-NOTIFY] PASS: production notification topology is fail-closed.');
