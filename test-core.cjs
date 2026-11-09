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
assert.equal(manifest.version, '0.3.1');
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
assert.equal(typeof markdown.stripInlineMarkdown, 'function');

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

const depthTree = {
  virtualRoot: false,
  tree: {
    rawText: 'Root', text: 'Root', collapsed: false,
    children: [{
      rawText: 'Branch', text: 'Branch', collapsed: false,
      children: [{
        rawText: 'Child', text: 'Child', collapsed: false,
        children: [{ rawText: 'Leaf', text: 'Leaf', collapsed: false, children: [] }],
      }],
    }],
  },
};
collapse.applyInitialExpandDepth(depthTree, 2);
assert.equal(depthTree.tree.collapsed, false);
assert.equal(depthTree.tree.children[0].collapsed, true, 'level 2 remains visible and hides its children');
assert.equal(depthTree.tree.children[0].children[0].collapsed, false, 'manual expansion can reveal the subtree');
collapse.applyInitialExpandDepth(depthTree, 1);
assert.equal(depthTree.tree.collapsed, true, 'level 1 shows only the root');
collapse.applyInitialExpandDepth(depthTree, 0);
assert.deepEqual(collapse.collectCollapsedPaths(depthTree), [], '0 expands all levels');
collapse.applyInitialExpandDepth(depthTree, 20);
assert.deepEqual(collapse.collectCollapsedPaths(depthTree), [], 'a depth beyond the tree leaves it expanded');
collapse.applyInitialExpandDepth({ tree: null, virtualRoot: false }, 2);
const virtualDepthTree = {
  virtualRoot: true,
  tree: { rawText: 'File', text: 'File', collapsed: false, isVirtual: true, children: [depthTree.tree] },
};
collapse.applyInitialExpandDepth(virtualDepthTree, 1);
assert.equal(virtualDepthTree.tree.collapsed, false, 'the virtual file root stays expanded');
assert.equal(depthTree.tree.collapsed, true, 'actual top-level nodes count as level 1');

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

assert.equal(markdown.stripInlineMarkdown('**bold**'), 'bold');
assert.equal(markdown.stripInlineMarkdown('*italic*'), 'italic');
assert.equal(markdown.stripInlineMarkdown('[[target|alias]]'), 'alias');
assert.equal(markdown.stripInlineMarkdown('[name](https://example.com)'), 'name');
assert.equal(markdown.stripInlineMarkdown('`List<T>`'), 'List<T>');
assert.equal(markdown.stripInlineMarkdown('`a*b*`'), 'a*b*');
assert.equal(markdown.stripInlineMarkdown('``code `with` ticks``'), 'code `with` ticks');
assert.equal(markdown.stripInlineMarkdown('\\`not code\\` and *italic*'), '`not code` and italic');
assert.equal(markdown.stripInlineMarkdown('`\\*literal\\*`'), '\\*literal\\*');
assert.equal(markdown.stripInlineMarkdown('[x](https://example.com/a_(b))'), 'x');
assert.equal(markdown.stripInlineMarkdown('<https://example.com>'), 'https://example.com');
assert.equal(markdown.stripInlineMarkdown('a < b > c'), 'a < b > c');
assert.equal(markdown.stripInlineMarkdown('\\*literal\\* and \\_value\\_'), '*literal* and _value_');
assert.equal(markdown.stripInlineMarkdown('<span>text</span>'), 'text');
assert.equal(markdown.stripInlineMarkdown('<<span>span>text<</span>/span>'), 'text');

const occupied = new Set(['Maps/项目-clean.md', 'Maps/项目-clean-2.md']);
assert.equal(
  markdown.nextCleanMarkdownPath('Maps/项目.md', (candidate) => occupied.has(candidate)),
  'Maps/项目-clean-3.md'
);
assert.equal(markdown.nextCleanMarkdownPath('Root.md', () => false), 'Root-clean.md');

// ────────────────────────────────────────────────────────────────
// 回归：文字编辑折叠节点时不得改变折叠状态
// （历史行为：_startEdit 会先展开节点，延迟到重布局后才进入编辑）
// ────────────────────────────────────────────────────────────────

function loadPluginClass() {
  const absoluteEntry = path.resolve(__dirname, 'src/main.ts');
  const result = esbuild.buildSync({
    entryPoints: [absoluteEntry],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'es2021',
    external: ['obsidian'],
    logLevel: 'silent',
  });
  const obsidianStub = {
    __esModule: true,
    Plugin: class {},
    PluginSettingTab: class {},
  };
  const loaded = new Module(absoluteEntry + '.bundle.cjs', module);
  loaded.filename = absoluteEntry + '.bundle.cjs';
  loaded.paths = Module._nodeModulePaths(path.dirname(absoluteEntry));
  const originalLoad = Module._load;
  Module._load = function (request) {
    if (request === 'obsidian') return obsidianStub;
    return originalLoad.apply(this, arguments);
  };
  try {
    loaded._compile(result.outputFiles[0].text, loaded.filename);
  } finally {
    Module._load = originalLoad;
  }
  return loaded.exports.default;
}

function makeEditableElement() {
  return {
    isContentEditable: false,
    textContent: '',
    contentEditable: 'false',
    spellcheck: true,
    classList: { add() {}, remove() {} },
    focus() {},
    addEventListener() {},
    removeEventListener() {},
    ownerDocument: { createRange: () => ({ selectNodeContents() {} }) },
  };
}

function makeEditHarness() {
  const PluginClass = loadPluginClass();
  const plugin = Object.create(PluginClass.prototype);
  const calls = { undo: 0, persist: 0 };
  plugin._pushUndoSnapshot = () => { calls.undo += 1; };
  plugin._persistAndRelayout = () => { calls.persist += 1; return Promise.resolve(); };
  plugin._selectNode = () => {};
  plugin._currentMindmapContent = () => '- 父\n  - 子';
  return { plugin, calls, overlay: {} };
}

function makeBranchNode(collapsed) {
  return {
    rawText: '父',
    text: '父',
    collapsed,
    isVirtual: false,
    children: [{ rawText: '子', text: '子', collapsed: false, children: [] }],
    _el: makeEditableElement(),
  };
}

{
  const node = makeBranchNode(true);
  const { plugin, calls, overlay } = makeEditHarness();
  plugin._startEdit(overlay, node);
  assert.equal(node.collapsed, true, '文字编辑保留折叠状态');
  assert.equal(overlay._stratifyPendingEdit ?? null, null, '文字编辑不延迟到重布局');
  assert.equal(calls.persist, 0, '开始编辑不触发持久化或重布局');
  assert.equal(calls.undo, 0, '开始编辑不写入撤销栈');
  assert.equal(node._el.contentEditable, 'true', '折叠节点立即进入编辑模式');
  assert.equal(overlay._stratifyEditingNode, node, '编辑目标是被触发的节点');
}

{
  const node = makeBranchNode(false);
  const { plugin, overlay } = makeEditHarness();
  plugin._startEdit(overlay, node);
  assert.equal(node.collapsed, false, '已展开节点保持展开');
  assert.equal(node._el.contentEditable, 'true', '已展开节点立即进入编辑模式');
}

console.log('Core identity, collapse path, module, and edit-collapse tests passed');
