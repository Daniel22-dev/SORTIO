#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const identityPath = path.resolve(process.argv[2] || path.join(root, 'dist-deployment', 'release-integrity.json'));
const deploymentDir = path.dirname(identityPath);
const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (message) => { throw new Error(`LIVE release identity: ${message}`); };

if (!fs.existsSync(identityPath)) fail(`chybí ${identityPath}`);
const ri = readJson(identityPath);
const expectedRepo = process.env.GHRAB_SOURCE_REPOSITORY;
const expectedCommit = process.env.GHRAB_SOURCE_COMMIT;
if (!expectedRepo || !expectedCommit) fail('chybí GHRAB_SOURCE_REPOSITORY nebo GHRAB_SOURCE_COMMIT');
if (ri.schema !== 'ghrab-release-integrity-v2') fail(`schema ${ri.schema}`);
if (ri.appId !== 'sortio') fail(`appId ${ri.appId}`);
if (ri.version !== pkg.version) fail(`version ${ri.version} != ${pkg.version}`);
if (ri.sourceRepository !== expectedRepo) fail(`repository ${ri.sourceRepository} != ${expectedRepo}`);
if (ri.sourceCommit !== expectedCommit) fail(`commit ${ri.sourceCommit} != ${expectedCommit}`);
if (!/^[a-f0-9]{64}$/.test(String(ri.artifactDigest || ''))) fail('neplatný artifactDigest');
if (!Number.isInteger(ri.fileCount) || ri.fileCount < 1) fail('neplatný fileCount');

const manifestPath = path.join(deploymentDir, 'studio-manifest.json');
const provenancePath = path.join(deploymentDir, 'build-provenance.json');
const sbomPath = path.join(deploymentDir, 'sbom.cdx.json');
for (const file of [manifestPath, provenancePath, sbomPath]) if (!fs.existsSync(file)) fail(`chybí ${path.basename(file)}`);

const manifest = readJson(manifestPath);
if (manifest.releaseIdentity?.source?.repository !== expectedRepo) fail('studio manifest repository mismatch');
if (manifest.releaseIdentity?.source?.commit !== expectedCommit) fail('studio manifest commit mismatch');
if (manifest.releaseIdentity?.appId !== 'sortio' || manifest.releaseIdentity?.version !== pkg.version) fail('studio manifest release identity mismatch');

const provenance = readJson(provenancePath);
if (provenance.source?.repository !== expectedRepo || provenance.source?.revision !== expectedCommit) fail('provenance source mismatch');
if (ri.buildProvenanceSha256 !== sha256File(provenancePath)) fail('buildProvenanceSha256 mismatch');
if (ri.sbomSha256 !== sha256File(sbomPath)) fail('sbomSha256 mismatch');

const indexed = new Map((ri.files || []).map((entry) => [entry.path, entry]));
for (const rel of ['studio-manifest.json', 'build-provenance.json', 'sbom.cdx.json']) {
  const entry = indexed.get(rel);
  if (!entry) fail(`release-integrity neobsahuje ${rel}`);
  if (entry.sha256 !== sha256File(path.join(deploymentDir, rel))) fail(`hash mismatch ${rel}`);
}

console.log(JSON.stringify({ status: 'PASS', appId: ri.appId, version: ri.version, repository: ri.sourceRepository, sourceCommit: ri.sourceCommit, artifactDigest: ri.artifactDigest, fileCount: ri.fileCount }, null, 2));
