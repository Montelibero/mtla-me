import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRootDir = path.resolve(path.dirname(scriptPath), '..');
const EXPECTED_REPOSITORY = 'https://github.com/Montelibero/MTLA-Documents';

export function verifyDocumentProvenance({ rootDir = defaultRootDir, upstreamDir } = {}) {
  const manifestPath = path.join(rootDir, 'documents', 'UPSTREAM.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  validateManifest(manifest, manifestPath);

  const verifiedFiles = [];
  for (const [localName, source] of Object.entries(manifest.files)) {
    const localPath = path.join(rootDir, 'documents', localName);
    const actualHash = sha256(localPath);

    if (actualHash !== source.sha256) {
      throw new Error(
        `${localPath}: SHA-256 mismatch; expected ${source.sha256}, received ${actualHash}. ` +
        'Update the document and its provenance record together.'
      );
    }

    if (upstreamDir) {
      const upstreamPath = resolveContainedPath(upstreamDir, source.upstreamPath);
      const upstreamHash = sha256(upstreamPath);
      if (upstreamHash !== source.sha256) {
        throw new Error(
          `${upstreamPath}: does not match the recorded ${manifest.commit} document hash ${source.sha256}.`
        );
      }
    }

    verifiedFiles.push({ localName, sha256: actualHash, upstreamPath: source.upstreamPath });
  }

  return {
    repository: manifest.repository,
    commit: manifest.commit,
    verifiedAt: manifest.verifiedAt,
    files: verifiedFiles,
  };
}

function validateManifest(manifest, manifestPath) {
  if (!isPlainObject(manifest)) {
    throw new Error(`${manifestPath}: expected a JSON object.`);
  }

  const expectedKeys = ['commit', 'files', 'repository', 'verifiedAt'];
  const actualKeys = Object.keys(manifest).sort();
  if (actualKeys.join('\0') !== expectedKeys.join('\0')) {
    throw new Error(`${manifestPath}: expected only ${expectedKeys.join(', ')}.`);
  }

  let repository;
  try {
    repository = new URL(manifest.repository);
  } catch (_) {
    throw new Error(`${manifestPath}.repository: expected an absolute URL.`);
  }
  if (
    repository.protocol !== 'https:' ||
    repository.username ||
    repository.password ||
    manifest.repository !== EXPECTED_REPOSITORY
  ) {
    throw new Error(`${manifestPath}.repository: expected ${EXPECTED_REPOSITORY}.`);
  }

  if (!/^[0-9a-f]{40}$/.test(manifest.commit)) {
    throw new Error(`${manifestPath}.commit: expected a full 40-character Git commit SHA.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.verifiedAt)) {
    throw new Error(`${manifestPath}.verifiedAt: expected YYYY-MM-DD.`);
  }
  if (!isPlainObject(manifest.files) || Object.keys(manifest.files).length === 0) {
    throw new Error(`${manifestPath}.files: expected at least one document record.`);
  }

  for (const [localName, source] of Object.entries(manifest.files)) {
    if (path.basename(localName) !== localName || !/^Agreement\.(?:en|ru)\.md$/.test(localName)) {
      throw new Error(`${manifestPath}.files.${localName}: unexpected local document name.`);
    }
    if (!isPlainObject(source)) {
      throw new Error(`${manifestPath}.files.${localName}: expected an object.`);
    }

    const sourceKeys = Object.keys(source).sort();
    if (sourceKeys.join('\0') !== ['sha256', 'upstreamPath'].join('\0')) {
      throw new Error(`${manifestPath}.files.${localName}: expected only sha256 and upstreamPath.`);
    }
    if (!/^[0-9a-f]{64}$/.test(source.sha256)) {
      throw new Error(`${manifestPath}.files.${localName}.sha256: expected a lowercase SHA-256 digest.`);
    }
    if (
      typeof source.upstreamPath !== 'string' ||
      source.upstreamPath.startsWith('/') ||
      source.upstreamPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      throw new Error(`${manifestPath}.files.${localName}.upstreamPath: expected a safe repository-relative path.`);
    }
  }
}

function resolveContainedPath(baseDir, relativePath) {
  const base = path.resolve(baseDir);
  const candidate = path.resolve(base, relativePath);
  const relative = path.relative(base, candidate);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Upstream path escapes its repository root: ${relativePath}`);
  }
  return candidate;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseCliArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 1 && args[0] === '--print-commit') return { printCommit: true };
  if (args.length === 2 && args[0] === '--upstream-dir' && args[1]) {
    return { upstreamDir: args[1] };
  }
  throw new Error(
    'Usage: node scripts/verify-documents.mjs [--print-commit | --upstream-dir /path/to/MTLA-Documents]'
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const options = parseCliArgs(process.argv.slice(2));
  const result = verifyDocumentProvenance(options);
  console.log(options.printCommit ? result.commit : `Verified ${result.files.length} agreement files from ${result.commit}.`);
}
