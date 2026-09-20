#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const consumer = JSON.parse(fs.readFileSync(path.join(root, 'ghrab-platform.consumer.json'), 'utf8'));
const template = JSON.parse(fs.readFileSync(path.join(root, 'src', 'studio-manifest.template.json'), 'utf8').replaceAll('__APP_VERSION__', pkg.version).replaceAll('__BUILD_TIME__', 'TEST'));
const builtPath = path.join(root, 'dist', 'studio-manifest.json');
if (!fs.existsSync(builtPath)) throw new Error('Studio manifest regression: chybí dist/studio-manifest.json.');
const built = JSON.parse(fs.readFileSync(builtPath, 'utf8'));

const failures = [];
const expect = (ok, label, actual, expected) => {
  if (!ok) failures.push({ label, actual, expected });
};

expect(built.id === consumer.appId, 'app id', built.id, consumer.appId);
expect(built.version === pkg.version, 'app version', built.version, pkg.version);
expect(built.repository === template.repository, 'repository', built.repository, template.repository);

const canonical = template.platform || {};
for (const key of ['schema','contract','requiredPlatformRange','platformVersion','brandVersion','themeContract','swContract','studioBridge','artifactEnvelope','storagePrefix']) {
  expect(JSON.stringify(built.platform?.[key]) === JSON.stringify(canonical[key]), `platform.${key}`, built.platform?.[key], canonical[key]);
}
expect(built.platform?.cacheName === `ghrab-${consumer.appId}-v${pkg.version}`, 'platform.cacheName', built.platform?.cacheName, `ghrab-${consumer.appId}-v${pkg.version}`);
expect(built.platform?.requiredRange === consumer.platform.requiredRange, 'platform.requiredRange alias', built.platform?.requiredRange, consumer.platform.requiredRange);
expect(built.platform?.storageContract === 'ghrab-storage-namespace-v1', 'platform.storageContract alias', built.platform?.storageContract, 'ghrab-storage-namespace-v1');
expect(built.platform?.bridgeContract === consumer.bridge.contract, 'platform.bridgeContract alias', built.platform?.bridgeContract, consumer.bridge.contract);
expect(built.platform?.artifactContract === consumer.artifact.schema, 'platform.artifactContract alias', built.platform?.artifactContract, consumer.artifact.schema);

expect(built.releaseIdentity?.schema === 'ghrab-app-release-identity-v1', 'release identity schema', built.releaseIdentity?.schema, 'ghrab-app-release-identity-v1');
expect(built.releaseIdentity?.contract === 'ghrab-release-integrity-v2', 'release identity contract', built.releaseIdentity?.contract, 'ghrab-release-integrity-v2');
expect(built.releaseIdentity?.url === './release-integrity.json', 'release identity url', built.releaseIdentity?.url, './release-integrity.json');
expect(built.releaseIdentity?.assuranceMode === 'TRANSITIONAL', 'release identity assurance mode', built.releaseIdentity?.assuranceMode, 'TRANSITIONAL');
expect(built.releaseIdentity?.appId === consumer.appId, 'release identity appId', built.releaseIdentity?.appId, consumer.appId);
expect(built.releaseIdentity?.version === pkg.version, 'release identity version', built.releaseIdentity?.version, pkg.version);
const expectedRepo = process.env.GHRAB_SOURCE_REPOSITORY || built.repository;
expect(built.releaseIdentity?.source?.repository === expectedRepo, 'release source repository', built.releaseIdentity?.source?.repository, expectedRepo);
if (process.env.GHRAB_SOURCE_COMMIT) {
  expect(built.releaseIdentity?.source?.commit === process.env.GHRAB_SOURCE_COMMIT, 'release source commit', built.releaseIdentity?.source?.commit, process.env.GHRAB_SOURCE_COMMIT);
}
for (const [key, value] of Object.entries({ releaseIntegrity: 'release-integrity.json', provenance: 'build-provenance.json', sbom: 'sbom.cdx.json', securityEvidenceManifest: 'security-evidence-manifest.json' })) {
  expect(built.releaseIdentity?.evidence?.[key] === value, `release evidence ${key}`, built.releaseIdentity?.evidence?.[key], value);
}

if (failures.length) {
  console.error(JSON.stringify({ status: 'FAIL', failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PASS', manifest: 'dist/studio-manifest.json', sourceCommit: built.releaseIdentity?.source?.commit || null }, null, 2));
