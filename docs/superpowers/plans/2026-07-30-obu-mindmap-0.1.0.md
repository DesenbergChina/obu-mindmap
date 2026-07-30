# Obu Mindmap 0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Stratify Mindmap 1.2.1 实现为独立的 Obu Mindmap 0.1.0，并加入逐篇默认视图、版本 2 折叠存储、`+/-` 控件、旧格式迁移和纯净 Markdown 导出。

**Architecture:** 保留现有 `src/main.ts` 中的 Obsidian 生命周期、overlay、布局、编辑、拖拽和快照写入机制；新增两个无 Obsidian 依赖的纯逻辑模块，分别处理折叠路径和 Markdown 文件边界。所有文档状态变化仍序列化为单个完整 Markdown 快照，使 Undo/Redo、重命名、拖拽和折叠 frontmatter 保持原子一致。

**Tech Stack:** TypeScript 5.8、Obsidian API、esbuild、Node.js 内置 `assert`、ESLint 9、CommonJS 测试入口。

## Global Constraints

- 插件 ID 必须为 `obu-mindmap`，名称为 `Obu Mindmap`，版本为 `0.1.0`，最低 Obsidian 版本为 `1.8.7`。
- 继续读取 `type: mindmap` 和现有 `mindmap-*` 字段，不新增 `type: obu-mindmap`。
- 保留内部 `StratifyOverlayElement`、`StratifyNodeElement`、`_stratify*` 和 `.stratify-*` 命名。
- 没有 `mindmap-collapse-version: 2` 的旧文件继续保留旧星号存储，直到用户显式执行迁移命令。
- 版本 2 文件不得用外围单星号表示折叠，斜体 Markdown 必须保持正文语义。
- 所有正文和折叠字段更新必须作为一个完整文件快照写入并进入现有 Undo/Redo。
- 纯净 Markdown 导出不得修改或覆盖原文件。
- 每项行为先写失败测试并确认因目标功能缺失而失败，再写最小实现。

---

## File Map

- Create `src/collapse-state.ts`: 折叠版本、旧标记识别、标题规范化/编码、同名兄弟路径、折叠路径收集与应用。
- Create `src/markdown-file.ts`: 文件开头 frontmatter 分离、纯正文提取、同目录防覆盖导出路径。
- Modify `src/main.ts`: 插件身份字符串、设置、默认视图生命周期、版本 2 解析/序列化、按钮、迁移和导出命令。
- Create `test-core.cjs`: 通过 esbuild 在内存中加载纯逻辑模块并做表驱动测试。
- Modify `test-persistence.cjs`: 插件级默认视图、完整快照、DOM 按钮、迁移和导出集成测试。
- Modify `package.json`: 插件身份和组合测试脚本。
- Modify `manifest.json`, `versions.json`, `esbuild.config.mjs`, `eslint.config.mts`: 发布身份和构建文案。
- Modify `styles.css`: 折叠按钮桌面/移动样式，移除旧 badge 样式。
- Modify `README.md`, `README_zh-CN.md`, `CHANGELOG.md`: 功能、迁移、安装、开发、Credits 和 0.1.0 发布说明。

---

### Task 1: 独立插件身份与测试入口

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `versions.json`
- Modify: `esbuild.config.mjs`
- Modify: `eslint.config.mts`
- Create: `test-core.cjs`

**Interfaces:**
- Produces: `npm test` 依次执行 `node test-core.cjs` 和 `node test-persistence.cjs`。
- Produces: 发布身份 `obu-mindmap@0.1.0`，供后续 README、日志和发布校验使用。

- [ ] **Step 1: 写身份和纯逻辑测试入口的失败测试**

在 `test-core.cjs` 中加入可复用的 TypeScript 内存加载器，并先断言尚未实现的两个模块：

```javascript
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');

function loadTypeScript(entry) {
  const result = esbuild.buildSync({
    entryPoints: [path.resolve(entry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });
  const loaded = new Module(path.resolve(entry) + '.cjs', module);
  loaded.filename = path.resolve(entry) + '.cjs';
  loaded.paths = Module._nodeModulePaths(path.dirname(path.resolve(entry)));
  loaded._compile(result.outputFiles[0].text, loaded.filename);
  return loaded.exports;
}

assert.equal(JSON.parse(fs.readFileSync('manifest.json', 'utf8')).id, 'obu-mindmap');
assert.equal(JSON.parse(fs.readFileSync('manifest.json', 'utf8')).version, '0.1.0');
assert.equal(JSON.parse(fs.readFileSync('package.json', 'utf8')).name, 'obu-mindmap');

const collapse = loadTypeScript('src/collapse-state.ts');
const markdown = loadTypeScript('src/markdown-file.ts');
assert.equal(collapse.COLLAPSE_VERSION, 2);
assert.equal(typeof markdown.stripLeadingFrontmatter, 'function');
```

- [ ] **Step 2: 运行测试并确认因 Obu 身份和模块缺失而失败**

Run: `node test-core.cjs`

Expected: FAIL，首先报告 `stratify-mindmap !== obu-mindmap`；身份改完后仍因 `src/collapse-state.ts` 不存在而失败。

- [ ] **Step 3: 写最小身份配置和空接口模块**

将 `manifest.json` 设置为规格中的完整 Obu 内容；将 `package.json` 的 `name`、`version`、`description`、`author` 改为 Obu 值，并设置：

```json
{
  "scripts": {
    "test:core": "node test-core.cjs",
    "test:persistence": "node test-persistence.cjs",
    "test": "npm run test:core && npm run test:persistence"
  }
}
```

将 `versions.json` 收敛为：

```json
{
  "0.1.0": "1.8.7"
}
```

创建最小接口：

```typescript
// src/collapse-state.ts
export const COLLAPSE_VERSION = 2;
```

```typescript
// src/markdown-file.ts
export function stripLeadingFrontmatter(content: string): string {
  return content;
}
```

将构建 banner、ESLint 品牌白名单更新为 Obu Mindmap。运行 `npm install --package-lock-only` 同步锁文件身份。

- [ ] **Step 4: 运行身份测试和发布校验**

Run: `node test-core.cjs`

Expected: PASS。

Run: `node scripts/verify-release.mjs`

Expected: PASS，无版本不一致错误。

- [ ] **Step 5: 提交**

```bash
git add manifest.json package.json package-lock.json versions.json esbuild.config.mjs eslint.config.mts test-core.cjs src/collapse-state.ts src/markdown-file.ts
git commit -m "feat: 建立 Obu Mindmap 独立插件身份" -m "更新插件、包、版本映射和构建品牌信息；新增纯逻辑测试入口并保留后续核心模块接口。验证发布版本映射与身份断言通过。"
```

---

### Task 2: 折叠路径和 Markdown 文件纯逻辑

**Files:**
- Modify: `src/collapse-state.ts`
- Modify: `src/markdown-file.ts`
- Modify: `test-core.cjs`

**Interfaces:**
- Produces: `CollapseNodeLike`、`CollapseTreeLike`。
- Produces: `parseLegacyCollapseMarker(rawText, enabled): { rawText: string; collapsed: boolean }`。
- Produces: `collectCollapsedPaths(treeInfo): string[]`。
- Produces: `applyCollapsedPaths(treeInfo, value): number`。
- Produces: `stripLeadingFrontmatter(content): string`。
- Produces: `nextCleanMarkdownPath(sourcePath, exists): string`。

- [ ] **Step 1: 写折叠路径失败测试**

在 `test-core.cjs` 中构造手写树，断言同名序号、虚拟根排除和特殊字符编码：

```javascript
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

repeatedTree.tree.children.forEach((node) => { node.collapsed = false; });
assert.equal(collapse.applyCollapsedPaths(repeatedTree, [
  '%E9%A1%B9%E7%9B%AE%2F%E8%AE%A1%E5%88%92[1]/%E6%B5%8B%E8%AF%95[2]',
  'missing[1]',
  42,
]), 1);
assert.deepEqual(repeatedTree.tree.children.map((node) => node.collapsed), [false, true, false]);
```

再断言虚拟根本身不进入路径，NFC 规范化后的等价标题能匹配。

- [ ] **Step 2: 运行并确认缺少路径函数**

Run: `node test-core.cjs`

Expected: FAIL with `collapse.collectCollapsedPaths is not a function`。

- [ ] **Step 3: 实现最小路径算法**

在 `src/collapse-state.ts` 实现：

```typescript
export interface CollapseNodeLike {
  rawText: string;
  text: string;
  collapsed: boolean;
  children: CollapseNodeLike[];
  isVirtual?: boolean;
}

export interface CollapseTreeLike {
  tree: CollapseNodeLike | null;
  virtualRoot: boolean;
}

export function normalizeCollapseTitle(node: CollapseNodeLike): string {
  return String(node.rawText || node.text || '').trim().normalize('NFC');
}

export function encodeCollapseTitle(node: CollapseNodeLike): string {
  return encodeURIComponent(normalizeCollapseTitle(node));
}
```

遍历每一组兄弟时以规范化标题维护计数器；根节点也固定带 `[1]`。虚拟根只作为容器，路径从其子节点开始。`applyCollapsedPaths` 只接受字符串数组和完全匹配；开始应用前将所有真实节点设为展开。

- [ ] **Step 4: 写旧星号识别失败测试**

```javascript
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
```

Run: `node test-core.cjs`

Expected: FAIL with `parseLegacyCollapseMarker is not a function`。

- [ ] **Step 5: 实现旧标记识别并通过测试**

实现精确的完整单星号正则：

```typescript
const LEGACY_COLLAPSE_RE = /^\*(?!\*)(.+)\*(?!\*)$/;

export function parseLegacyCollapseMarker(rawText: string, enabled: boolean) {
  const match = enabled ? rawText.match(LEGACY_COLLAPSE_RE) : null;
  return match
    ? { rawText: match[1], collapsed: true }
    : { rawText, collapsed: false };
}
```

Run: `node test-core.cjs`

Expected: PASS。

- [ ] **Step 6: 写纯净导出边界和命名失败测试**

```javascript
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
assert.equal(
  markdown.nextCleanMarkdownPath('Root.md', () => false),
  'Root-clean.md'
);
```

Run: `node test-core.cjs`

Expected: FAIL，因为当前 `stripLeadingFrontmatter` 返回原文，且命名函数不存在。

- [ ] **Step 7: 实现 frontmatter 剥离和防覆盖命名**

`stripLeadingFrontmatter` 只匹配文件开头：

```typescript
const LEADING_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export function stripLeadingFrontmatter(content: string): string {
  return content.replace(LEADING_FRONTMATTER_RE, '');
}
```

`nextCleanMarkdownPath` 用最后一个 `/` 分割目录，用不区分扩展名大小写的 `.md` 去除扩展名，依次测试 `-clean.md`、`-clean-2.md`。

- [ ] **Step 8: 运行核心测试和类型检查**

Run: `node test-core.cjs`

Expected: PASS。

Run: `npm run build`

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add src/collapse-state.ts src/markdown-file.ts test-core.cjs
git commit -m "feat: 实现折叠路径与纯净导出核心逻辑" -m "新增同名兄弟编号、特殊字符编码、失效路径忽略和旧星号识别；实现仅剥离文件头 frontmatter 的正文提取与防覆盖导出命名。核心逻辑测试和 TypeScript 构建通过。"
```

---

### Task 3: 默认视图设置与一次性应用

**Files:**
- Modify: `src/main.ts`
- Modify: `test-persistence.cjs`

**Interfaces:**
- Produces: `type DefaultView = 'mindmap' | 'markdown'`。
- Produces: `PluginSettings.defaultView: DefaultView`。
- Produces: `_resolveDefaultView(frontmatter: Frontmatter | null): DefaultView`。
- Produces: `_applyDefaultView(view, overlay, value): void`。
- Produces: overlay `_stratifyDefaultViewAppliedFor?: string`。

- [ ] **Step 1: 写设置解析和新文件失败测试**

在测试插件设置中加入 `defaultView: 'markdown'`，断言：

```javascript
assert.equal(plugin._resolveDefaultView({ 'mindmap-default': 'mindmap' }), 'mindmap');
assert.equal(plugin._resolveDefaultView({ 'mindmap-default': 'markdown' }), 'markdown');
assert.equal(plugin._resolveDefaultView({}), 'markdown');
assert.equal(plugin._resolveDefaultView({ 'mindmap-default': 'invalid' }), 'mindmap');
assert.match(plugin._newMindmapContent(), /mindmap-default: markdown/);
assert.match(plugin._newMindmapContent(), /mindmap-collapse-version: 2/);
assert.match(plugin._newMindmapContent(), /mindmap-collapsed: \[\]/);
```

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为 `_resolveDefaultView` 不存在，且新文件缺少三个字段。

- [ ] **Step 2: 实现默认视图类型、设置加载和新文件字段**

增加：

```typescript
type DefaultView = 'mindmap' | 'markdown';

interface PluginSettings {
  // existing fields
  defaultView: DefaultView;
}
```

默认值为 `mindmap`；`loadSettings()` 和 `_sanitizeSettings()` 只接受两个合法值。`_newMindmapContent()` 与 `_convertFileToMindmap()` 写入 `mindmap-default`、折叠版本 2 和空数组。

- [ ] **Step 3: 运行设置测试并确认通过**

Run: `npm run build && node test-persistence.cjs`

Expected: PASS 到新增生命周期断言之前。

- [ ] **Step 4: 写一次性生命周期失败测试**

构造 `defaultView: markdown` 的文件和 overlay，连续两次调用 `_doScan()`：

```javascript
await plugin._doScan();
assert.ok(overlay.classList.contains('stratify-hidden'));
assert.equal(overlay._stratifyDefaultViewAppliedFor, file.path);

overlay.classList.remove('stratify-hidden');
await plugin._doScan();
assert.ok(!overlay.classList.contains('stratify-hidden'),
  'repeat scans must preserve a manual switch to the mind map');
```

再切换 `view.file` 和 metadata frontmatter 到另一个 `mindmap-default: markdown` 文件，断言新路径会再次应用。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为 `_doScan()` 尚未应用逐篇默认视图。

- [ ] **Step 5: 实现一次性应用和设置页选项**

`_doScan()` 在 overlay 创建或文件切换后执行：

```typescript
if (overlay._stratifyDefaultViewAppliedFor !== file.path) {
  this._applyDefaultView(view, overlay, this._resolveDefaultView(fm));
  overlay._stratifyDefaultViewAppliedFor = file.path;
}
```

`_applyDefaultView` 统一维护 `stratify-hidden`、`stratify-map-visible` 和 restore FAB。设置页新增 `Default view for new mind maps` 下拉框，选项为 `Mind Map` 和 `Markdown`。

- [ ] **Step 6: 写 Toggle default view 命令失败测试**

从 `plugin.addCommand` 捕获 `toggle-default-view` 的 callback，执行后断言当前文件 frontmatter 从缺失变为 `markdown`、overlay 立即隐藏、Notice 为 `Default view set to Markdown`；再次执行后断言变为 `mindmap`。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为命令尚未注册。

- [ ] **Step 7: 实现 Toggle default view 命令**

注册：

```typescript
{
  id: 'toggle-default-view',
  name: 'Obu Mindmap: Toggle default view',
  callback: () => void this._toggleDefaultViewForActiveFile()
}
```

方法在切到 Markdown 前提交活动编辑，使用 `processFrontMatter` 更新单个文件，调用 `_applyDefaultView`，刷新 `_stratifyDefaultViewAppliedFor` 并显示 Notice。

- [ ] **Step 8: 运行回归测试**

Run: `npm run check`

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add src/main.ts test-persistence.cjs
git commit -m "feat: 添加逐篇默认视图" -m "新增全局新建默认视图设置、mindmap-default 字段和切换命令；按文件路径一次性应用视图，避免重复扫描覆盖手动切换。默认视图与生命周期回归测试通过。"
```

---

### Task 4: 版本 2 折叠解析、序列化和快照

**Files:**
- Modify: `src/main.ts`
- Modify: `test-persistence.cjs`

**Interfaces:**
- Consumes: `COLLAPSE_VERSION`, `parseLegacyCollapseMarker`, `collectCollapsedPaths`, `applyCollapsedPaths`。
- Produces: `_usesCollapseV2(frontmatter): boolean`。
- Produces: `_serializeMindmap(parsed, treeInfo, structureMode, forceCollapseV2 = false): string`。

- [ ] **Step 1: 写三种结构和斜体语义失败测试**

为 heading、list、hybrid 各构造版本 2 文档，路径数组指向一个节点，断言构树后对应节点折叠；同时断言：

```javascript
const italicV2 = [
  '---',
  'type: mindmap',
  'mindmap-structure: heading',
  'mindmap-collapse-version: 2',
  'mindmap-collapsed: []',
  '---',
  '# *正常斜体*',
  '',
].join('\n');
const italicParsed = plugin._parseStructured(italicV2, 'heading');
assert.equal(italicParsed.headings[0].rawText, '*正常斜体*');
assert.equal(italicParsed.headings[0].collapsed, false);
```

旧文件 `# *旧折叠*` 仍断言 `rawText === '旧折叠'` 且 `collapsed === true`。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，版本 2 斜体仍被当成折叠，frontmatter 路径未应用。

- [ ] **Step 2: 实现版本感知解析**

导入纯逻辑函数。`_parseStructured()` 同时取得 `frontmatter`，只有非版本 2 文件才启用旧标记识别；`_buildTree()` 完成后调用 `applyCollapsedPaths(treeInfo, frontmatter['mindmap-collapsed'])`。

- [ ] **Step 3: 运行解析测试**

Run: `npm run build && node test-persistence.cjs`

Expected: PASS 到序列化断言之前。

- [ ] **Step 4: 写完整快照序列化失败测试**

对版本 2 树折叠两个节点，断言：

```javascript
const serializedV2 = plugin._serializeMindmap(parsedV2, treeV2, 'heading');
assert.match(serializedV2, /mindmap-collapse-version: 2/);
assert.match(serializedV2, /mindmap-collapsed:/);
assert.doesNotMatch(plugin._splitFrontmatter(serializedV2).body, /# \*.+\*/);
```

重命名和移动节点后重新序列化，解析 YAML 并断言只有新路径，旧路径不存在。旧格式文档普通序列化仍保留 `*旧折叠*`。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为现有 `_serializeNode()` 始终写星号。

- [ ] **Step 5: 实现版本 2 原子序列化**

给 `_serializeNode` 增加 `collapseV2` 参数。版本 2 时原样保留正常 Markdown，绝不根据 `node.collapsed` 改星号；旧格式继续当前行为。

`_serializeMindmap` 先序列化正文，再在版本 2 或 `forceCollapseV2` 时一次调用：

```typescript
this._withFrontmatterUpdates(content, {
  'mindmap-structure': mode,
  'mindmap-collapse-version': COLLAPSE_VERSION,
  'mindmap-collapsed': collectCollapsedPaths(treeInfo),
});
```

所有 `_currentMindmapContent`、`_persistTreeSnapshot`、`_persistAndRelayout`、折叠、重命名、拖拽和删除继续调用这一入口，所以快照同时携带正文和路径。

- [ ] **Step 6: 写 Undo/Redo 与重开失败测试**

折叠节点后取得完整字符串，执行 `_undoMindmap`、`_redoMindmap`，断言每次写入的 frontmatter 路径与重建树的 `collapsed` 一致；再从 `diskValue` 重开并断言状态恢复。

Run: `npm run build && node test-persistence.cjs`

Expected: 在序列化尚未贯穿全部写入点时 FAIL。

- [ ] **Step 7: 修正所有完整快照写入点并运行回归**

确保 `_toggleCollapse()` 使用 `_queueMindmapWrite()`，并且 reparse/rebuild 前后的 frontmatter、选择路径和折叠路径来自同一 `newContent`。

Run: `npm run check`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add src/main.ts test-persistence.cjs
git commit -m "feat: 使用 frontmatter 保存折叠状态" -m "为版本 2 文件实现可编码节点路径、同名兄弟序号和完整快照序列化；保留旧文件星号兼容，并让重命名、拖拽、删除和 Undo/Redo 同步更新路径。三种结构与持久化测试通过。"
```

---

### Task 5: 节点 `+/-` 折叠按钮

**Files:**
- Modify: `src/main.ts`
- Modify: `styles.css`
- Modify: `test-persistence.cjs`

**Interfaces:**
- Produces: `_renderNodeDisplay(el, node, overlay): void`。
- Produces: `_appendCollapseToggle(el, node, overlay): HTMLButtonElement | null`。

- [ ] **Step 1: 写按钮行为失败测试**

用最小真实事件记录 fake button 调用 `_appendCollapseToggle`，断言：

```javascript
assert.equal(expandedButton.textContent, '−');
assert.equal(expandedButton.attributes['aria-label'], 'Collapse children');
assert.equal(expandedButton.attributes.type, 'button');

const event = {
  prevented: false,
  stopped: false,
  preventDefault() { this.prevented = true; },
  stopPropagation() { this.stopped = true; },
};
expandedButton.listeners.click(event);
assert.equal(event.prevented, true);
assert.equal(event.stopped, true);
assert.equal(toggledNode, branch);
assert.equal(plugin._appendCollapseToggle(fakeEl, leaf, overlay), null);
```

折叠分支的按钮文本断言为 `+`，标签为 `Expand children`。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为按钮方法不存在。

- [ ] **Step 2: 实现统一节点显示和按钮事件**

`_renderNodeDisplay` 先清空节点；有子节点时创建 `.stratify-node-text` 并渲染内容，再追加真实 button；叶节点直接渲染内容。`_createNodes()` 和 `_exitEditMode()` 都调用该方法，避免无修改退出编辑后按钮消失。

按钮 click 只调用现有 `_toggleCollapse(overlay, node)`，不创建第二套折叠状态逻辑。

- [ ] **Step 3: 运行按钮逻辑测试**

Run: `npm run build && node test-persistence.cjs`

Expected: PASS。

- [ ] **Step 4: 写样式失败测试**

在 `test-persistence.cjs` 读取 `styles.css` 并断言：

```javascript
assert.match(styles, /\.stratify-collapse-toggle\s*\{[^}]*min-width:\s*28px[^}]*min-height:\s*28px/s);
assert.match(styles, /\.stratify-overlay\.stratify-mobile \.stratify-collapse-toggle\s*\{[^}]*min-width:\s*36px[^}]*min-height:\s*36px/s);
```

Run: `node test-persistence.cjs`

Expected: FAIL，因为旧 CSS 只有 `.stratify-collapse-badge`。

- [ ] **Step 5: 替换 badge CSS 并验证布局**

删除 `.stratify-collapse-badge` 伪元素规则，新增 button 的透明背景、继承颜色、居中、焦点可见样式；使用 flex 布局容纳文本和按钮。移动端点击区为 36×36 px。保留 `stratify-collapsed` 类供布局和隐藏子节点使用。

- [ ] **Step 6: 运行完整检查**

Run: `npm run check`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/main.ts styles.css test-persistence.cjs
git commit -m "feat: 添加节点折叠按钮" -m "将旧折叠徽标替换为可访问的加减按钮，统一复用折叠入口并阻止选择、编辑和拖拽事件冒泡；补充桌面与移动端点击区域样式。交互和样式回归测试通过。"
```

---

### Task 6: 显式迁移旧折叠标记

**Files:**
- Modify: `src/main.ts`
- Modify: `test-persistence.cjs`

**Interfaces:**
- Consumes: `_serializeMindmap(..., forceCollapseV2 = true)`。
- Produces: `_migrateLegacyCollapseMarkers(): Promise<void>`。

- [ ] **Step 1: 写迁移命令失败测试**

用包含旧 heading 和 list 星号的 hybrid 文件执行迁移，断言：

```javascript
assert.match(diskValue, /mindmap-collapse-version: 2/);
assert.doesNotMatch(plugin._splitFrontmatter(diskValue).body, /\*需求分析\*/);
assert.doesNotMatch(plugin._splitFrontmatter(diskValue).body, /\*后端\*/);
assert.equal(plugin._parseStructured(diskValue, 'hybrid').headings.filter((node) => node.collapsed).length, 2);
assert.equal(lastNotice, 'Migrated 2 legacy collapsed nodes');
```

随后调用 `_undoMindmap`，断言完整旧星号文件恢复；redo 再恢复版本 2。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为迁移方法和命令不存在。

- [ ] **Step 2: 实现迁移命令和完整快照**

注册 `migrate-legacy-collapse-markers`。方法读取活动 Markdown 文件的实时编辑器内容，拒绝非 mindmap；版本已为 2 时显示 `This mind map already uses collapse storage version 2` 并不写入。

对旧文件解析/构树，统计真实 `collapsed` 节点，先把旧完整内容压入 overlay undo 栈，再调用 `_serializeMindmap(parsed, treeInfo, mode, true)`。通过 `_queueMindmapWrite` 一次写入并用新字符串重渲染。

- [ ] **Step 3: 写重复迁移和新版斜体测试**

迁移后再次执行，断言写入次数不增加；版本 2 的 `*正常斜体*` 执行迁移也不修改正文。

Run: `npm run build && node test-persistence.cjs`

Expected: PASS。

- [ ] **Step 4: 运行完整检查**

Run: `npm run check`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/main.ts test-persistence.cjs
git commit -m "feat: 添加旧折叠格式迁移" -m "新增用户显式迁移命令，将旧标题和列表星号转换为版本 2 路径并写入单个 Undo/Redo 快照；重复执行和新版斜体均保持不变。迁移与幂等测试通过。"
```

---

### Task 7: 导出纯净 Markdown

**Files:**
- Modify: `src/main.ts`
- Modify: `test-persistence.cjs`

**Interfaces:**
- Consumes: `stripLeadingFrontmatter(content)`。
- Consumes: `nextCleanMarkdownPath(sourcePath, exists)`。
- Produces: `_exportCleanMarkdown(): Promise<void>`。

- [ ] **Step 1: 写导出集成失败测试**

为 vault fake 增加 `getAbstractFileByPath` 和 `create`，先占用 `Maps/项目-clean.md`，执行导出后断言：

```javascript
assert.equal(createdPath, 'Maps/项目-clean-2.md');
assert.equal(createdContent, '# 项目计划\n\n## 需求分析\n\n```yaml\n---\n```\n');
assert.equal(diskValue, originalContent, 'the source file must stay unchanged');
assert.equal(openedPath, createdPath);
assert.equal(lastNotice, 'Exported clean Markdown: 项目-clean-2.md');
```

再覆盖无 frontmatter、中文根目录文件和折叠子节点正文完整存在。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为导出方法和命令不存在。

- [ ] **Step 2: 实现导出命令**

注册 `export-clean-markdown`。方法获取活动 `.md` 文件，优先读取实时 editor buffer；调用 `stripLeadingFrontmatter`；用：

```typescript
const targetPath = nextCleanMarkdownPath(
  file.path,
  (candidate) => Boolean(this.app.vault.getAbstractFileByPath(candidate))
);
```

创建新文件，打开新路径并显示 Notice。catch 中记录 `[ObuMindmap] clean Markdown export error` 并显示失败 Notice。

- [ ] **Step 3: 运行导出与完整回归**

Run: `npm run check`

Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/main.ts test-persistence.cjs
git commit -m "feat: 支持导出纯净 Markdown" -m "新增仅移除文件头 frontmatter 的导出命令，按 -clean、-clean-2 顺序选择同目录空闲路径，创建后打开新文件且不修改原文。正文保真和防覆盖测试通过。"
```

---

### Task 8: 用户可见品牌、文档和发布验收

**Files:**
- Modify: `src/main.ts`
- Modify: `README.md`
- Modify: `README_zh-CN.md`
- Modify: `CHANGELOG.md`
- Modify: `LICENSE` only if required to preserve and append notices; do not remove existing copyright.
- Modify: `test-persistence.cjs`

**Interfaces:**
- Produces: 所有用户可见字符串使用 Obu Mindmap；内部 Stratify 类型和 CSS 不变。
- Produces: README 包含迁移、默认视图、版本 2 折叠、按钮、显式迁移、纯净导出、幕布建议、安装、构建和 Credits。

- [ ] **Step 1: 写用户可见行为失败测试**

在 mock 中捕获 ribbon、command、file-menu、restore FAB 和日志前缀所产生的用户行为，断言用户界面只出现 Obu Mindmap。测试实际注册结果和控件文本，不以 grep 源码作为断言。

Run: `npm run build && node test-persistence.cjs`

Expected: FAIL，因为 ribbon/file-menu/FAB 仍显示 Stratify Mindmap。

- [ ] **Step 2: 更新所有用户可见品牌和错误日志**

将命令面板、Ribbon、文件/文件夹菜单、设置页、Notice、恢复按钮和错误日志改为 Obu；错误日志前缀统一为 `[ObuMindmap]`。保留内部类名、字段名、测试环境变量和 CSS 选择器。

- [ ] **Step 3: 运行插件级行为测试**

Run: `npm run build && node test-persistence.cjs`

Expected: PASS。

- [ ] **Step 4: 更新英文和中文 README**

两份 README 均包含：

- Obu Mindmap 功能介绍；
- 禁用 Stratify 后直接打开既有 `type: mindmap` 文件；
- `mindmap-default` 两个值和全局默认规则；
- `mindmap-collapse-version: 2`、`mindmap-collapsed` 与斜体语义；
- `+/-`、Space 和右键操作；
- 显式旧格式迁移命令；
- 纯净 Markdown 导出和幕布导入建议；
- 手动安装目录 `.obsidian/plugins/obu-mindmap/`；
- `npm ci`、`npm run dev`、`npm run check`；
- 规格要求的 Credits 文本；
- MIT License 和原作者声明。

将 CHANGELOG 顶部加入 `0.1.0` 条目，列出独立身份和五项新功能。

- [ ] **Step 5: 执行占位符、旧品牌和发布产物检查**

Run: `rg -n "T[B]D|T[O]DO|Stratify Mindmap Settings|Create Stratify mind map|Convert to Stratify mind map|\\[StratifyMindmap\\]" README.md README_zh-CN.md src manifest.json package.json esbuild.config.mjs`

Expected: 无输出。允许内部 `StratifyOverlayElement`、`_stratify*`、`.stratify-*` 以及 Credits 中的 `Stratify Mindmap`。

Run: `node scripts/verify-release.mjs`

Expected: PASS。

- [ ] **Step 6: 执行最终完整检查**

Run: `npm run check`

Expected: ESLint、TypeScript、生产构建、核心测试和插件回归测试全部 PASS，退出码为 0。

Run: `git diff --check`

Expected: 无输出。

- [ ] **Step 7: 提交**

```bash
git add src/main.ts README.md README_zh-CN.md CHANGELOG.md LICENSE test-persistence.cjs
git commit -m "docs: 完成 Obu Mindmap 0.1.0 发布文档" -m "统一用户可见品牌、命令、提示和错误日志；补充迁移、默认视图、折叠格式、纯净导出、安装构建与 Credits 文档。发布校验和 npm run check 全部通过。"
```

---

## Final Verification Checklist

- [ ] `manifest.json`、`package.json`、`versions.json` 版本和身份一致。
- [ ] 原 Stratify 工作目录没有任何改动。
- [ ] 新文件和转换文件写入默认视图与折叠版本 2。
- [ ] 旧文件无需转换即可打开，且在显式迁移前保留旧星号存储。
- [ ] 版本 2 的斜体标题/列表项不再表示折叠。
- [ ] 折叠路径在重命名、拖拽、删除、Undo/Redo 和重开后同步。
- [ ] `+/-`、Space、右键、编辑展开、拖入展开均走统一折叠逻辑。
- [ ] 纯净导出保留完整正文、不覆盖、不修改原文件。
- [ ] README、CHANGELOG、Credits 和发布元数据完整。
- [ ] `npm run check` 与 `node scripts/verify-release.mjs` 最新运行均为零退出码。
