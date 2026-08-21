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
const packageLock = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8'));
const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
const readmeZh = fs.readFileSync(path.join(__dirname, 'README_zh-CN.md'), 'utf8');
const license = fs.readFileSync(path.join(__dirname, 'LICENSE'), 'utf8');
const expectedLicense = 'Limited Personal License';

assert.equal(manifest.id, 'obu-mindmap');
assert.equal(manifest.version, '0.2.1');
assert.equal(packageJson.name, 'obu-mindmap');
assert.equal(packageJson.license, expectedLicense);
assert.equal(packageLock.packages[''].license, expectedLicense);
assert.match(readme, /## License\s+Limited Personal License\./);
assert.match(readmeZh, /## License\s+有限个人使用许可（Limited Personal License）。/);
assert.match(license, /# 有限个人使用许可 Limited Personal License/);
assert.match(
  license,
  /Obu-specific modifications, additions, and subsequent developments may not be publicly uploaded, distributed, modified, or used to create derivative works without prior written permission\./
);

const collapse = loadTypeScript('src/collapse-state.ts');
const markdown = loadTypeScript('src/markdown-file.ts');

assert.equal(collapse.COLLAPSE_VERSION, 2);
assert.equal(typeof markdown.stripLeadingFrontmatter, 'function');

const repeatedTree = {
  virtualRoot: false,
  tree: {
    rawText: '项目/计划',
    text: '项目/计划',
    collapsed: false,
    children: [
      { rawText: '测试', text: '测试', collapsed: true, children: [] },
      { rawText: '测试', text: '测试', collapsed: true, children: [] },
      { rawText: 'A[B]\\C%', text: 'A[B]\\C%', collapsed: true, children: [] },
    ],
  },
};

assert.deepEqual(collapse.collectCollapsedPaths(repeatedTree), [
  '%E9%A1%B9%E7%9B%AE%2F%E8%AE%A1%E5%88%92[1]/%E6%B5%8B%E8%AF%95[1]',
  '%E9%A1%B9%E7%9B%AE%2F%E8%AE%A1%E5%88%92[1]/%E6%B5%8B%E8%AF%95[2]',
  '%E9%A1%B9%E7%9B%AE%2F%E8%AE%A1%E5%88%92[1]/A%5BB%5D%5CC%25[1]',
]);

repeatedTree.tree.children.forEach((node) => {
  node.collapsed = false;
});
assert.equal(collapse.applyCollapsedPaths(repeatedTree, [
  '%E9%A1%B9%E7%9B%AE%2F%E8%AE%A1%E5%88%92[1]/%E6%B5%8B%E8%AF%95[2]',
  'missing[1]',
  42,
]), 1);
assert.deepEqual(
  repeatedTree.tree.children.map((node) => node.collapsed),
  [false, true, false]
);

const virtualTree = {
  virtualRoot: true,
  tree: {
    rawText: '文件名',
    text: '文件名',
    collapsed: false,
    isVirtual: true,
    children: [
      {
        rawText: 'Cafe\u0301',
        text: 'Cafe\u0301',
        collapsed: true,
        children: [],
      },
    ],
  },
};
assert.deepEqual(collapse.collectCollapsedPaths(virtualTree), ['Caf%C3%A9[1]']);

assert.deepEqual(collapse.parseLegacyCollapseMarker('*需求分析*', true), {
  rawText: '需求分析',
  collapsed: true,
});
assert.deepEqual(collapse.parseLegacyCollapseMarker('**粗体**', true), {
  rawText: '**粗体**',
  collapsed: false,
});
assert.deepEqual(collapse.parseLegacyCollapseMarker('*正常斜体*', false), {
  rawText: '*正常斜体*',
  collapsed: false,
});

assert.equal(
  markdown.stripLeadingFrontmatter('---\ntype: mindmap\n---\n# 标题\n\n```yaml\n---\n```'),
  '# 标题\n\n```yaml\n---\n```'
);
assert.equal(markdown.stripLeadingFrontmatter('# 无属性\n'), '# 无属性\n');

const occupied = new Set(['Maps/项目-clean.md', 'Maps/项目-clean-2.md']);
assert.equal(
  markdown.nextCleanMarkdownPath('Maps/项目.md', (candidate) => occupied.has(candidate)),
  'Maps/项目-clean-3.md'
);
assert.equal(markdown.nextCleanMarkdownPath('Root.md', () => false), 'Root-clean.md');

console.log('Core identity, collapse path, and module tests passed');
