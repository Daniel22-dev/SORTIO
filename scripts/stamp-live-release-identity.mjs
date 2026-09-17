#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const target = path.resolve(process.argv[2] || path.join(root, 'dist-deployment', 'studio-manifest.json'));

const requiredEnv = ['GHRAB_SOURCE_REPOSITORY', 'GHRAB_SOURCE_COMMIT', 'GHRAB_BUILD_ID'];
for (const name of requiredEnv) {
  if (!String(process.env[name] || '').trim()) throw new Error(`LIVE identity stamp: chybí ${name}.`);
}
if (!/^[0-9a-f]{40}$/i.test(process.env.GHRAB_SOURCE_COMMIT)) {
  throw new Error('LIVE identity stamp: GHRAB_SOURCE_COMMIT není plný Git SHA.');
}
if (!fs.existsSync(target)) throw new Error(`LIVE identity stamp: chybí ${target}.`);

const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
if (manifest.id !== 'sortio') throw new Error(`LIVE identity stamp: app id ${manifest.id} != sortio.`);
if (manifest.version !== pkg.version) throw new Error(`LIVE identity stamp: verze ${manifest.version} != ${pkg.version}.`);

const canonicalPlatformKeys = ['schema','contract','requiredPlatformRange','platformVersion','brandVersion','themeContract','swContract','studioBridge','artifactEnvelope','storagePrefix','cacheName'];
for (const key of canonicalPlatformKeys) {
  if (manifest.platform?.[key] === undefined || manifest.platform?.[key] === null || manifest.platform?.[key] === '') {
    throw new Error(`LIVE identity stamp: chybí platform.${key}.`);
  }
}

manifest.releaseIdentity = {
  schema: 'ghrab-app-release-identity-v1',
  appId: 'sortio',
  version: pkg.version,
  source: {
    repository: process.env.GHRAB_SOURCE_REPOSITORY,
    commit: process.env.GHRAB_SOURCE_COMMIT,
  },
  buildId: process.env.GHRAB_BUILD_ID,
  evidence: {
    releaseIntegrity: 'release-integrity.json',
    provenance: 'build-provenance.json',
    sbom: 'sbom.cdx.json',
  },
};

fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  status: 'PASS',
  manifest: path.relative(root, target).split(path.sep).join('/'),
  appId: manifest.id,
  version: manifest.version,
  repository: manifest.releaseIdentity.source.repository,
  sourceCommit: manifest.releaseIdentity.source.commit,
  buildId: manifest.releaseIdentity.buildId,
}, null, 2));
