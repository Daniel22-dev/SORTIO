#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const certificationRoot = path.resolve(process.argv[2] || '.');
const repoRoot = process.cwd();
const expectedSha = String(process.env.GHRAB_EXPECTED_SOURCE_SHA || '').toLowerCase();
const expectedRepository = String(process.env.GHRAB_EXPECTED_REPOSITORY || '').toLowerCase();
const expectedRunId = String(process.env.GHRAB_EXPECTED_RUN_ID || '');
const expectedRunAttempt = String(process.env.GHRAB_EXPECTED_RUN_ATTEMPT || '');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const checks = [];

const add = (id, ok, detail = '') => checks.push({ id, ok: Boolean(ok), detail: String(detail).slice(0, 500) });
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const isSha256 = value => /^[a-f0-9]{64}$/i.test(String(value || ''));
const isCommit = value => /^[a-f0-9]{40}$/i.test(String(value || ''));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

if (!isCommit(expectedSha)) throw new Error('P5 certification verification FAIL: GHRAB_EXPECTED_SOURCE_SHA must be a 40-character commit SHA.');
if (!expectedRepository) throw new Error('P5 certification verification FAIL: GHRAB_EXPECTED_REPOSITORY is required.');
if (!/^[0-9]+$/.test(expectedRunId)) throw new Error('P5 certification verification FAIL: GHRAB_EXPECTED_RUN_ID is required.');
if (expectedRunAttempt && !/^[0-9]+$/.test(expectedRunAttempt)) throw new Error('P5 certification verification FAIL: invalid GHRAB_EXPECTED_RUN_ATTEMPT.');

const dist = path.join(certificationRoot, 'dist-deployment');
const qa = path.join(certificationRoot, 'qa-results', 'current');
const files = {
  integrity: path.join(dist, 'release-integrity.json'),
  manifest: path.join(dist, 'studio-manifest.json'),
  sbom: path.join(dist, 'sbom.cdx.json'),
  provenance: path.join(dist, 'build-provenance.json'),
  evidence: path.join(dist, 'security-evidence-manifest.json'),
};

for (const [name, file] of Object.entries(files)) add(`file.${name}`, fs.existsSync(file), file);
if (checks.some(check => !check.ok)) finish();

const integrity = readJson(files.integrity);
const manifest = readJson(files.manifest);
const provenance = readJson(files.provenance);
const evidence = readJson(files.evidence);
const sbom = readJson(files.sbom);

add('identity.schema', integrity.schema === 'ghrab-release-integrity-v2', integrity.schema);
add('identity.appId', integrity.appId === 'sortio', integrity.appId);
add('identity.version', integrity.version === pkg.version, `${integrity.version}/${pkg.version}`);
add('identity.sourceCommit', String(integrity.sourceCommit || '').toLowerCase() === expectedSha, integrity.sourceCommit);
add('identity.releaseStage', integrity.releaseStage === 'PREP-VALIDATION', integrity.releaseStage);
add('identity.status', integrity.status === 'GREEN', integrity.status);
add('identity.environment', integrity.environment === 'github-pages', integrity.environment);
add('identity.garpProfile', integrity.garpProfile === 'GARP-2.7', integrity.garpProfile);
add('identity.gate', integrity.gate === 'P5-R2', integrity.gate);
add('identity.assuranceMode', integrity.assuranceMode === 'TRANSITIONAL', integrity.assuranceMode);
add('identity.artifactDigest', isSha256(integrity.artifactDigest), integrity.artifactDigest);
add('identity.signature-not-overclaimed', ['NOT_PRESENT', 'VERIFIED'].includes(integrity.signature?.status), integrity.signature?.status);

const buildRun = integrity.buildRun || {};
add('buildRun.provider', buildRun.provider === 'github-actions', buildRun.provider);
add('buildRun.repository', String(buildRun.repository || '').toLowerCase() === expectedRepository, buildRun.repository);
add('buildRun.runId', String(buildRun.runId || '') === expectedRunId, buildRun.runId);
add('buildRun.sourceCommit', String(buildRun.sourceCommit || '').toLowerCase() === expectedSha, buildRun.sourceCommit);
if (expectedRunAttempt) add('buildRun.runAttempt', String(buildRun.runAttempt || '') === expectedRunAttempt, buildRun.runAttempt);
const expectedWorkflowRef = `${expectedRepository}/.github/workflows/p5-release-gate.yml@refs/heads/main`;
add('buildRun.workflowRef', String(buildRun.workflowRef || '').toLowerCase() === expectedWorkflowRef, buildRun.workflowRef);
add('identity.buildId', String(integrity.buildId || '') === `p5-${expectedRunId}-${buildRun.runAttempt}`, integrity.buildId);

add('manifest.contract', manifest.releaseIdentity?.contract === 'ghrab-release-integrity-v2' && manifest.releaseIdentity?.url === './release-integrity.json', JSON.stringify(manifest.releaseIdentity || {}));
add('manifest.app-version', manifest.id === 'sortio' && manifest.version === pkg.version, `${manifest.id}/${manifest.version}`);
add('manifest.repository', String(manifest.repository || '').toLowerCase() === expectedRepository, manifest.repository);

for (const [field, file] of [
  ['manifestSha256', files.manifest],
  ['sbomSha256', files.sbom],
  ['buildProvenanceSha256', files.provenance],
  ['evidenceManifestSha256', files.evidence],
]) {
  const actual = sha256(file);
  add(`link.${field}`, isSha256(integrity[field]) && String(integrity[field]).toLowerCase() === actual, `${integrity[field]} vs ${actual}`);
}

add('provenance.schema', provenance.schema === 'ghrab-build-provenance-v1', provenance.schema);
add('provenance.subject', String(provenance.subject?.sha256 || '').toLowerCase() === String(integrity.manifestSha256 || '').toLowerCase(), provenance.subject?.sha256);
add('provenance.source', String(provenance.source?.revision || '').toLowerCase() === expectedSha, provenance.source?.revision);
add('provenance.repository', String(provenance.source?.repository || '').toLowerCase() === expectedRepository, provenance.source?.repository);
add('provenance.builder', provenance.builder?.id === 'github-actions', provenance.builder?.id);
add('provenance.workflow', String(provenance.builder?.workflow || '').toLowerCase() === expectedWorkflowRef, provenance.builder?.workflow);
add('provenance.entrypoint', provenance.builder?.entrypoint === 'npm run prepare:pages', provenance.builder?.entrypoint);
add('provenance.profile', provenance.invocation?.parameters?.profile === 'GARP-2.7/P5-R2', provenance.invocation?.parameters?.profile);
add('provenance.no-false-slsa', provenance.assurance?.claimedSlsaLevel == null, provenance.assurance?.claimedSlsaLevel);

add('evidence.schema', evidence.schema === 'ghrab-security-evidence-manifest-v1', evidence.schema);
add('evidence.release', evidence.appId === 'sortio' && evidence.version === pkg.version && String(evidence.sourceRevision || '').toLowerCase() === expectedSha, `${evidence.appId}/${evidence.version}/${evidence.sourceRevision}`);
const requiredEvidence = new Set([
  'ai-studio-dispatch-contract.txt',
  'garp251-selftest.json',
  'test-results-garp-canary-sweep.json',
  'test-results-garp-hostile-render.json',
  'test-results-garp-suite-session-regressions.json',
]);
const listedEvidence = new Set();
for (const item of Array.isArray(evidence.files) ? evidence.files : []) {
  listedEvidence.add(item.path);
  const evidenceFile = path.join(qa, item.path);
  const exists = fs.existsSync(evidenceFile) && fs.statSync(evidenceFile).isFile();
  add(`evidence.file.${item.path}.exists`, exists, evidenceFile);
  if (exists) {
    add(`evidence.file.${item.path}.size`, fs.statSync(evidenceFile).size === item.size, `${fs.statSync(evidenceFile).size}/${item.size}`);
    add(`evidence.file.${item.path}.sha256`, isSha256(item.sha256) && sha256(evidenceFile) === String(item.sha256).toLowerCase(), item.sha256);
  }
}
for (const required of requiredEvidence) add(`evidence.required.${required}`, listedEvidence.has(required), required);

add('sbom.format', sbom.bomFormat === 'CycloneDX', sbom.bomFormat);
add('sbom.version', sbom.metadata?.component?.version === pkg.version, sbom.metadata?.component?.version);

const integrityEntries = new Map((Array.isArray(integrity.files) ? integrity.files : []).map(item => [item.path, item]));
for (const [name, field] of [
  ['studio-manifest.json', 'manifestSha256'],
  ['sbom.cdx.json', 'sbomSha256'],
  ['build-provenance.json', 'buildProvenanceSha256'],
  ['security-evidence-manifest.json', 'evidenceManifestSha256'],
]) {
  const item = integrityEntries.get(name);
  add(`integrity.files.${name}`, Boolean(item) && isSha256(item.sha256) && String(item.sha256).toLowerCase() === String(integrity[field] || '').toLowerCase(), item?.sha256);
}

finish();

function finish() {
  const failed = checks.filter(check => !check.ok);
  const report = {
    schema: 'ghrab-p5-certification-verification-v1',
    appId: 'sortio',
    version: pkg.version,
    expectedSourceCommit: expectedSha,
    expectedRunId,
    status: failed.length ? 'failed' : 'passed',
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
    failed: failed.map(check => check.id),
    checks,
  };
  console[failed.length ? 'error' : 'log'](JSON.stringify(report, null, 2));
  process.exit(failed.length ? 1 : 0);
}
