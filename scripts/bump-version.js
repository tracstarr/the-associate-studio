#!/usr/bin/env node
// Usage: node scripts/bump-version.js <major.minor.patch>
//        npm run version:bump 1.2.3

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.js <version>');
  console.error('Example: node scripts/bump-version.js 1.2.3');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version: "${version}". Must be major.minor.patch (e.g. 1.2.3)`);
  process.exit(1);
}

function bumpJson(filePath, field) {
  const abs = resolve(root, filePath);
  const data = JSON.parse(readFileSync(abs, 'utf8'));
  const old = data[field];
  data[field] = version;
  writeFileSync(abs, JSON.stringify(data, null, 2) + '\n');
  console.log(`${filePath}: ${field} ${old} → ${version}`);
}

function bumpCargoToml(filePath) {
  const abs = resolve(root, filePath);
  let src = readFileSync(abs, 'utf8');
  // Only replace the version in the [package] block (before any [dependencies])
  const updated = src.replace(
    /^(version\s*=\s*)"[^"]*"/m,
    `$1"${version}"`
  );
  if (updated === src) {
    console.warn(`${filePath}: no version field found — skipped`);
    return;
  }
  const oldMatch = src.match(/^version\s*=\s*"([^"]*)"/m);
  const old = oldMatch ? oldMatch[1] : '?';
  writeFileSync(abs, updated);
  console.log(`${filePath}: version ${old} → ${version}`);
}

bumpJson('package.json', 'version');
bumpCargoToml('src-tauri/Cargo.toml');
bumpJson('src-tauri/tauri.conf.json', 'version');

console.log(`\nDone. All files set to ${version}`);
