'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');

function loadTypeScript(entry) {
  const absoluteEntry = path.resolve(__dirname, entry);
  const result = esbuild.transformSync(fs.readFileSync(absoluteEntry, 'utf8'), {
    loader: 'ts',
    format: 'cjs',
    target: 'es2021',
  });
  const loaded = new Module(absoluteEntry + '.cjs', module);
  loaded.filename = absoluteEntry + '.cjs';
  loaded.paths = Module._nodeModulePaths(path.dirname(absoluteEntry));
  loaded._compile(result.code, loaded.filename);
  return loaded.exports;
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

assert.equal(manifest.id, 'obu-mindmap');
assert.equal(manifest.version, '0.1.0');
assert.equal(packageJson.name, 'obu-mindmap');

const collapse = loadTypeScript('src/collapse-state.ts');
const markdown = loadTypeScript('src/markdown-file.ts');

assert.equal(collapse.COLLAPSE_VERSION, 2);
assert.equal(typeof markdown.stripLeadingFrontmatter, 'function');

console.log('Core identity and module tests passed');
