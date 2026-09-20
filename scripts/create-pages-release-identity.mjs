#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dist = path.join(root, 'dist-deployment');
const qaResults = path.join(root, 'qa-results', 'current');
const pkg = JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8'));
const appId = 'sortio';
const version = pkg.version;
const integrityPath = path.join(dist, 'release-integrity.json');
const sbomPath = path.join(dist, 'sbom.cdx.json');
const provenancePath = path.join(dist, 'build-provenance.json');
const evidencePath = path.join(dist, 'security-evidence-manifest.json');
const studioManifestPath = path.join(dist, 'studio-manifest.json');

if (!fs.existsSync(dist)) throw new Error('Release identity FAIL: chybí dist-deployment/.');
if (!fs.existsSync(studioManifestPath)) throw new Error('Release identity FAIL: chybí studio-manifest.json.');
fs.rmSync(path.join(root, 'qa-results'), { recursive: true, force: true });
fs.mkdirSync(qaResults, { recursive: true });

function runNode(script, args = [], env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`Release identity FAIL: ${script} exit=${r.status}.\n${r.stdout || ''}\n${r.stderr || ''}`);
  return r.stdout || '';
}
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceCommit = () => {
  for (const value of [process.env.GHRAB_SOURCE_COMMIT, process.env.GITHUB_SHA]) {
    const v = String(value || '').trim();
    if (/^[0-9a-f]{40}$/i.test(v)) return v.toLowerCase();
  }
  throw new Error('Release identity FAIL: nelze určit 40znakový source commit SHA.');
};

const source = sourceCommit();
const repository = process.env.GHRAB_SOURCE_REPOSITORY || process.env.GITHUB_REPOSITORY || 'Daniel22-dev/SORTIO';
const workflowRef = process.env.GHRAB_WORKFLOW_REF || process.env.GITHUB_WORKFLOW_REF || 'local';
const runId = process.env.GITHUB_RUN_ID || 'local';
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || '1';
const buildId = process.env.GHRAB_BUILD_ID || `github-${runId}-${runAttempt}`;
const createdAt = new Date().toISOString();
const releaseStage = process.env.GHRAB_RELEASE_STAGE || (process.env.GITHUB_ACTIONS === 'true' ? 'LIVE-PUBLIC-PAGES' : 'PREP-VALIDATION');

// Preserve machine-readable evidence produced by the current run before public cleanup/identity generation.
for (const sourceDir of [path.join(root, 'dist'), path.join(root, 'test-results')]) {
  if (!fs.existsSync(sourceDir)) continue;
  for (const name of fs.readdirSync(sourceDir)) {
    const file = path.join(sourceDir, name);
    if (!fs.statSync(file).isFile()) continue;
    if (/^(?:qa-|quality-report|garp-).*\.json$/i.test(name) || name.endsWith('-report.json')) {
      fs.copyFileSync(file, path.join(qaResults, `${path.basename(sourceDir)}-${name}`));
    }
  }
}

const selftestEnv = { ...process.env };
delete selftestEnv.GHRAB_SOURCE_COMMIT;
delete selftestEnv.GITHUB_SHA;
const selftest = spawnSync(process.execPath, [path.join(root, 'security', 'garp25', 'tools', 'selftest-garp251.mjs')], {
  cwd: root,
  encoding: 'utf8',
  env: selftestEnv,
});
fs.writeFileSync(path.join(qaResults, 'garp251-selftest.json'), selftest.stdout || JSON.stringify({ status: 'FAIL', stderr: selftest.stderr || '' }));
if (selftest.status !== 0) throw new Error(`Release identity FAIL: GARP selftest neprošel. ${selftest.stderr || ''}`);

const dispatchTest = spawnSync(process.execPath, [path.join(root, 'scripts', 'test-ai-studio-dispatch.mjs')], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(qaResults, 'ai-studio-dispatch-contract.txt'), `${dispatchTest.stdout || ''}${dispatchTest.stderr || ''}`);
if (dispatchTest.status !== 0) throw new Error('Release identity FAIL: AI Studio dispatch contract neprošel.');

runNode('scripts/stamp-live-release-identity.mjs', [studioManifestPath], {
  GHRAB_SOURCE_REPOSITORY: repository,
  GHRAB_SOURCE_COMMIT: source,
  GHRAB_BUILD_ID: buildId,
});
runNode('scripts/generate-cyclonedx-sbom.mjs', [sbomPath]);
runNode('security/garp25/tools/create-evidence-manifest.mjs', [qaResults, evidencePath], {
  GHRAB_APP_ID: appId,
  GHRAB_APP_VERSION: version,
  GHRAB_SOURCE_COMMIT: source,
});
runNode('security/garp25/tools/create-build-provenance.mjs', [studioManifestPath, provenancePath], {
  GHRAB_SOURCE_REPOSITORY: repository,
  GHRAB_SOURCE_COMMIT: source,
  GHRAB_BUILDER_ID: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local-untrusted-builder',
  GHRAB_WORKFLOW_REF: workflowRef,
  GHRAB_BUILD_ENTRYPOINT: 'npm run prepare:pages',
  GHRAB_BUILD_STARTED_AT: process.env.GITHUB_RUN_STARTED_AT || createdAt,
  GHRAB_BUILD_FINISHED_AT: createdAt,
  GHRAB_LOCKFILE: path.join(root, 'package-lock.json'),
  GHRAB_BUILD_PROFILE: 'GARP-2.5.1-SHIELD-PREP/P5-R2',
});

const sbomSha256 = sha256(sbomPath);
const provenanceSha256 = sha256(provenancePath);
const evidenceSha256 = sha256(evidencePath);
const manifestSha256 = sha256(studioManifestPath);
// GitHub Pages consumes .nojekyll as a deployment control marker and does not serve it as a public file.
// Exclude it before computing the publicly verifiable artifact identity.
fs.rmSync(path.join(dist, '.nojekyll'), { force: true });
runNode('security/garp25/tools/create-release-integrity.mjs', [dist, appId, version, 'TRANSITIONAL-UNSIGNED', integrityPath], {
  GHRAB_BUILD_ID: buildId,
  GHRAB_SOURCE_COMMIT: source,
  GHRAB_BUILD_PROVENANCE_SHA256: provenanceSha256,
  GHRAB_SBOM_SHA256: sbomSha256,
  GHRAB_EVIDENCE_MANIFEST_SHA256: evidenceSha256,
});

const integrity = JSON.parse(await fsp.readFile(integrityPath, 'utf8'));
Object.assign(integrity, {
  assuranceMode: 'TRANSITIONAL',
  releaseStage,
  status: 'GREEN',
  environment: 'github-pages',
  garpProfile: 'GARP-2.5.1-SHIELD-PREP',
  gate: 'P5-R2',
  manifestSha256,
  sbomSha256,
  buildProvenanceSha256: provenanceSha256,
  evidenceManifestSha256: evidenceSha256,
  buildRun: {
    provider: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    repository,
    workflowRef,
    runId: String(runId),
    runAttempt: String(runAttempt),
    sourceCommit: source,
  },
  tooling: { garp: '2.5.1', platform: '1.1.2', node: process.version },
  signature: {
    algorithm: 'Ed25519',
    keyId: 'TRANSITIONAL-UNSIGNED',
    status: 'NOT_PRESENT',
    note: 'TRANSITIONAL: exact release identity is machine-verified, but no production signing key is asserted for this GitHub Pages release.',
  },
});
await fsp.writeFile(integrityPath, `${JSON.stringify(integrity, null, 2)}\n`, 'utf8');

runNode('security/garp25/tools/verify-release-integrity.mjs', [dist, integrityPath]);
runNode('scripts/verify-live-release-identity.mjs', [integrityPath], {
  GHRAB_SOURCE_REPOSITORY: repository,
  GHRAB_SOURCE_COMMIT: source,
});
runNode('security/garp25/tools/scan-deployment-leaks.mjs', [dist]);

for (const field of ['artifactDigest', 'manifestSha256', 'sbomSha256', 'buildProvenanceSha256', 'evidenceManifestSha256']) {
  if (!/^[0-9a-f]{64}$/i.test(String(integrity[field] || ''))) throw new Error(`Release identity FAIL: ${field} není SHA-256.`);
}
console.log(JSON.stringify({
  status: 'PASS', appId, version, sourceCommit: source, artifactDigest: integrity.artifactDigest,
  releaseStage, assuranceMode: integrity.assuranceMode, signatureStatus: integrity.signature.status,
  evidence: { manifestSha256, sbomSha256, provenanceSha256, evidenceSha256 },
}, null, 2));
