'use strict';

const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const originalLoad = Module._load;

function parseYaml(source) {
  const result = {};
  let sequenceKey = null;
  for (const line of String(source || '').split(/\r?\n/)) {
    const sequenceMatch = line.match(/^\s+-\s+(.*)$/);
    if (sequenceMatch && sequenceKey) {
      result[sequenceKey].push(sequenceMatch[1]);
      continue;
    }
    const match = line.match(/^([^:#]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const rawValue = match[2].trim();
    sequenceKey = null;
    if (rawValue === '') {
      result[key] = [];
      sequenceKey = key;
    } else if (rawValue === '[]') {
      result[key] = [];
    } else if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
      result[key] = Number(rawValue);
    } else {
      result[key] = rawValue;
    }
  }
  return result;
}

function stringifyYaml(value) {
  return Object.entries(value || {}).map(([key, item]) => {
    if (!Array.isArray(item)) return key + ': ' + item;
    if (item.length === 0) return key + ': []';
    return key + ':\n' + item.map((entry) => '  - ' + entry).join('\n');
  }).join('\n') + '\n';
}

class MockMarkdownView {}
class MockTFile {
  constructor(path) {
    this.path = path;
    this.basename = path.split('/').at(-1).replace(/\.md$/i, '');
    this.extension = 'md';
  }
}
const mockPlatform = { isMobile: false };
const notices = [];
class MockNotice {
  constructor(message) {
    notices.push(String(message));
  }
}

Module._load = function (request, parent, isMain) {
  if (request !== 'obsidian') return originalLoad.call(this, request, parent, isMain);
  return {
    Plugin: class {},
    PluginSettingTab: class {},
    MarkdownView: MockMarkdownView,
    TFile: MockTFile,
    Notice: MockNotice,
    Platform: mockPlatform,
    getLanguage: () => 'en',
    parseYaml,
    stringifyYaml,
  };
};

global.requestAnimationFrame = (callback) => callback();

const mainPath = path.resolve(process.env.STRATIFY_MAIN || './main.js');
if (!fs.existsSync(mainPath)) {
  console.error('main.js not found - run "npm run build" first (npm run check does this automatically).');
  process.exit(1);
}
const pluginModule = new Module(mainPath + '.cjs', module);
pluginModule.filename = mainPath + '.cjs';
pluginModule.paths = Module._nodeModulePaths(path.dirname(mainPath));
pluginModule._compile(fs.readFileSync(mainPath, 'utf8'), pluginModule.filename);
const Plugin = pluginModule.exports.default;
const plugin = Object.create(Plugin.prototype);
plugin.pluginSettings = {
  defaultStructure: 'list',
  defaultLayout: 'right',
  defaultTheme: 'minimal',
  defaultLine: 'curve',
  defaultNodeStyle: 'rounded',
  defaultView: 'markdown',
  nodeFontSize: 13,
};
plugin._renderTreeIntoCanvas = () => {};

const file = { path: 'Maps/New Mindmap.md', basename: 'New Mindmap' };
let editorValue = plugin._newMindmapContent();
let diskValue = editorValue;
let writeCount = 0;
let editorSetCount = 0;
let requestSaveCount = 0;
let editorReadCount = 0;
let vaultReadCount = 0;
const editor = {
  getValue: () => {
    editorReadCount += 1;
    return editorValue;
  },
  setValue: (value) => {
    editorValue = value;
    editorSetCount += 1;
  },
};
const view = Object.assign(new MockMarkdownView(), {
  file,
  editor,
  requestSave: () => {
    requestSaveCount += 1;
  },
});
plugin.app = {
  workspace: { getLeavesOfType: () => [{ view }] },
  metadataCache: {
    getFileCache: () => ({ frontmatter: { type: 'mindmap', 'mindmap-structure': 'list' } }),
  },
  vault: {
    cachedRead: async (target) => {
      assert.strictEqual(target, file);
      vaultReadCount += 1;
      return diskValue;
    },
    modify: async (target, content) => {
      assert.strictEqual(target, file);
      diskValue = content;
      writeCount += 1;
    },
    process: async (target, update) => {
      assert.strictEqual(target, file);
      diskValue = update(diskValue);
      writeCount += 1;
    },
  },
};

async function run() {
  assert.strictEqual(plugin._resolveDefaultView({ 'mindmap-default': 'mindmap' }), 'mindmap');
  assert.strictEqual(plugin._resolveDefaultView({ 'mindmap-default': 'markdown' }), 'markdown');
  assert.strictEqual(plugin._resolveDefaultView({}), 'markdown');
  assert.strictEqual(plugin._resolveDefaultView({ 'mindmap-default': 'invalid' }), 'mindmap');
  assert.match(editorValue, /mindmap-default: markdown/);
  assert.match(editorValue, /mindmap-collapse-version: 2/);
  assert.match(editorValue, /mindmap-collapsed: \[\]/);

  const parseFixtureTree = (content, mode) => {
    const fixtureParsed = plugin._parseStructured(content, mode);
    return {
      parsed: fixtureParsed,
      treeInfo: plugin._buildTree(fixtureParsed, 'Fixture'),
    };
  };
  const headingV2 = [
    '---',
    'type: mindmap',
    'mindmap-structure: heading',
    'mindmap-collapse-version: 2',
    'mindmap-collapsed:',
    '  - Root[1]/Branch[1]',
    '---',
    '# Root',
    '## Branch',
    '### Child',
    '',
  ].join('\n');
  const headingFixture = parseFixtureTree(headingV2, 'heading');
  assert.strictEqual(headingFixture.treeInfo.tree.children[0].collapsed, true);

  const listV2 = headingV2
    .replace('mindmap-structure: heading', 'mindmap-structure: list')
    .replace('# Root\n## Branch\n### Child', '- Root\n  - Branch\n    - Child');
  const listFixture = parseFixtureTree(listV2, 'list');
  assert.strictEqual(listFixture.treeInfo.tree.children[0].collapsed, true);

  const hybridV2 = headingV2
    .replace('mindmap-structure: heading', 'mindmap-structure: hybrid')
    .replace('# Root\n## Branch\n### Child', '# Root\n- Branch\n  - Child');
  const hybridFixture = parseFixtureTree(hybridV2, 'hybrid');
  assert.strictEqual(hybridFixture.treeInfo.tree.children[0].collapsed, true);

  const italicV2 = headingV2
    .replace('mindmap-collapsed:\n  - Root[1]/Branch[1]', 'mindmap-collapsed: []')
    .replace('# Root\n## Branch\n### Child', '# *正常斜体*');
  const italicParsed = plugin._parseStructured(italicV2, 'heading');
  assert.strictEqual(italicParsed.headings[0].rawText, '*正常斜体*');
  assert.strictEqual(italicParsed.headings[0].collapsed, false);

  const legacyParsed = plugin._parseStructured('# *旧折叠*\n', 'heading');
  assert.strictEqual(legacyParsed.headings[0].rawText, '旧折叠');
  assert.strictEqual(legacyParsed.headings[0].collapsed, true);

  const serializedV2 = plugin._serializeMindmap(
    headingFixture.parsed,
    headingFixture.treeInfo,
    'heading'
  );
  const serializedV2Split = plugin._splitFrontmatter(serializedV2);
  assert.strictEqual(serializedV2Split.frontmatter['mindmap-collapse-version'], 2);
  assert.deepStrictEqual(serializedV2Split.frontmatter['mindmap-collapsed'], [
    'Root[1]/Branch[1]',
  ]);
  assert.doesNotMatch(serializedV2Split.body, /## \*Branch\*/);

  const renamedBranch = headingFixture.treeInfo.tree.children[0];
  renamedBranch.rawText = 'Renamed Branch';
  renamedBranch.text = 'Renamed Branch';
  const renamedV2 = plugin._serializeMindmap(
    headingFixture.parsed,
    headingFixture.treeInfo,
    'heading'
  );
  assert.deepStrictEqual(
    plugin._splitFrontmatter(renamedV2).frontmatter['mindmap-collapsed'],
    ['Root[1]/Renamed%20Branch[1]']
  );
  assert.doesNotMatch(plugin._splitFrontmatter(renamedV2).body, /\*Renamed Branch\*/);

  const legacyTree = plugin._buildTree(legacyParsed, 'Legacy');
  assert.match(plugin._serializeMindmap(legacyParsed, legacyTree, 'heading'), /# \*旧折叠\*/);

  const makeToggleHost = () => ({
    created: [],
    createEl(tag, options) {
      const button = {
        tag,
        textContent: options.text,
        attributes: { ...(options.attr || {}) },
        listeners: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        addEventListener(name, listener) {
          this.listeners[name] = listener;
        },
      };
      this.created.push(button);
      return button;
    },
  });
  const branchForToggle = {
    rawText: 'Branch',
    text: 'Branch',
    collapsed: false,
    children: [{}],
  };
  const toggleHost = makeToggleHost();
  let toggledNode = null;
  const originalToggleCollapse = plugin._toggleCollapse;
  plugin._toggleCollapse = (_targetOverlay, targetNode) => {
    toggledNode = targetNode;
  };
  const expandedButton = plugin._appendCollapseToggle(toggleHost, branchForToggle, {});
  assert.strictEqual(expandedButton.textContent, '−');
  assert.strictEqual(expandedButton.attributes['aria-label'], 'Collapse children');
  assert.strictEqual(expandedButton.attributes.type, 'button');
  const toggleEvent = {
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
  expandedButton.listeners.click(toggleEvent);
  assert.strictEqual(toggleEvent.prevented, true);
  assert.strictEqual(toggleEvent.stopped, true);
  assert.strictEqual(toggledNode, branchForToggle);
  const pointerEvent = {
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
  expandedButton.listeners.pointerdown(pointerEvent);
  assert.strictEqual(pointerEvent.prevented, true);
  assert.strictEqual(pointerEvent.stopped, true);
  const keydownEvent = {
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {
      this.stopped = true;
    },
  };
  expandedButton.listeners.keydown(keydownEvent);
  assert.strictEqual(keydownEvent.prevented, false, 'button keyboard activation must keep native behavior');
  assert.strictEqual(keydownEvent.stopped, true, 'button key events must not reach node shortcuts');
  for (const eventName of ['mousedown', 'dblclick', 'contextmenu']) {
    const guardedEvent = {
      prevented: false,
      stopped: false,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
    };
    expandedButton.listeners[eventName](guardedEvent);
    assert.strictEqual(guardedEvent.prevented, true);
    assert.strictEqual(guardedEvent.stopped, true);
  }

  branchForToggle.collapsed = true;
  const collapsedButton = plugin._appendCollapseToggle(makeToggleHost(), branchForToggle, {});
  assert.strictEqual(collapsedButton.textContent, '+');
  assert.strictEqual(collapsedButton.attributes['aria-label'], 'Expand children');
  assert.strictEqual(
    plugin._appendCollapseToggle(makeToggleHost(), { children: [], collapsed: false }, {}),
    null
  );
  plugin._toggleCollapse = originalToggleCollapse;

  const parsed = plugin._parseStructured(editorValue, 'list');
  const treeInfo = plugin._buildTree(parsed, file.basename);
  const overlay = {
    _stratifyFile: file,
    _stratifyView: view,
    _stratifyParsed: parsed,
    _stratifyTreeInfo: treeInfo,
    _stratifyStructure: 'list',
    _stratifySelected: null,
    _stratifyPendingEdit: null,
  };
  let sourceVisible = false;
  const overlayClasses = new Set();
  overlay.classList = {
    contains: (name) => (name === 'stratify-hidden' && sourceVisible) || overlayClasses.has(name),
    toggle: (name, force) => {
      if (force) overlayClasses.add(name);
      else overlayClasses.delete(name);
    },
  };
  overlay.dataset = {};
  overlay.ownerDocument = {
    defaultView: { requestAnimationFrame: (callback) => callback() },
  };
  const hostClasses = new Set();
  view.contentEl = {
    querySelector: () => overlay,
    addClass: (name) => hostClasses.add(name),
    removeClass: (name) => hostClasses.delete(name),
  };
  plugin._showRestoreFab = () => {};
  plugin._removeRestoreFab = () => {};

  const undoSnapshot = plugin._currentMindmapContent(overlay);
  plugin._updateNodeText(treeInfo.tree, 'Renamed Root');
  const persistAndRelayout = plugin._persistAndRelayout.bind(plugin);
  let pendingPersist = null;
  plugin._persistAndRelayout = (targetOverlay) => {
    pendingPersist = persistAndRelayout(targetOverlay);
    return pendingPersist;
  };
  plugin._addChild(overlay, treeInfo.tree, true, undoSnapshot);
  await pendingPersist;

  assert.strictEqual(writeCount, 1, 'a mind map save must commit the serialized Markdown to the vault');
  assert.strictEqual(editorSetCount, 1, 'a stale open editor must be synchronized after the vault write');
  assert.strictEqual(requestSaveCount, 0, 'the verified vault write must not depend on a deferred view save');
  assert.strictEqual(diskValue, editorValue, 'the vault and open editor must contain the same Markdown');

  const renderedContents = [];
  plugin._render = (targetOverlay, content) => renderedContents.push(content);
  overlay._stratifyDefaultViewAppliedFor = undefined;
  await plugin._doScan();
  assert.ok(
    overlayClasses.has('stratify-hidden'),
    'an unconfigured file must use the global Markdown default once'
  );
  assert.strictEqual(overlay._stratifyDefaultViewAppliedFor, file.path);
  overlay.classList.toggle('stratify-hidden', false);
  await plugin._doScan();
  assert.ok(
    !overlayClasses.has('stratify-hidden'),
    'repeat scans must preserve a manual switch to the mind map'
  );

  const activeFrontmatter = { 'mindmap-default': 'markdown' };
  plugin.app.fileManager = {
    processFrontMatter: async (target, update) => {
      assert.strictEqual(target, file);
      update(activeFrontmatter);
    },
  };
  plugin.app.workspace.getActiveViewOfType = () => view;
  const getFileCacheBeforeDefaultCommand = plugin.app.metadataCache.getFileCache;
  plugin.app.metadataCache.getFileCache = () => ({
    frontmatter: {
      type: 'mindmap',
      'mindmap-structure': 'list',
      'mindmap-default': 'markdown',
    },
  });
  overlay._stratifyFrontmatter = undefined;
  notices.length = 0;
  await plugin._toggleDefaultViewForActiveFile();
  assert.strictEqual(activeFrontmatter['mindmap-default'], 'mindmap');
  assert.ok(!overlayClasses.has('stratify-hidden'));
  assert.strictEqual(notices.at(-1), 'Default view set to Mind Map');

  delete activeFrontmatter['mindmap-default'];
  overlay._stratifyFrontmatter = {};
  notices.length = 0;
  await plugin._toggleDefaultViewForActiveFile();
  assert.strictEqual(activeFrontmatter['mindmap-default'], 'markdown');
  assert.ok(overlayClasses.has('stratify-hidden'));
  assert.strictEqual(notices.at(-1), 'Default view set to Markdown');
  await plugin._toggleDefaultViewForActiveFile();
  assert.strictEqual(activeFrontmatter['mindmap-default'], 'mindmap');
  assert.ok(!overlayClasses.has('stratify-hidden'));
  assert.strictEqual(notices.at(-1), 'Default view set to Mind Map');
  plugin.app.metadataCache.getFileCache = getFileCacheBeforeDefaultCommand;

  const processFrontMatterBeforeBrandTest = plugin.app.fileManager.processFrontMatter;
  const consoleErrorBeforeBrandTest = console.error;
  let loggedBrand = null;
  plugin.app.fileManager.processFrontMatter = async () => {
    throw new Error('brand-test');
  };
  console.error = (prefix) => {
    loggedBrand = prefix;
  };
  await plugin._persistFrontmatterValue(file, 'mindmap-layout', 'right');
  console.error = consoleErrorBeforeBrandTest;
  plugin.app.fileManager.processFrontMatter = processFrontMatterBeforeBrandTest;
  assert.strictEqual(loggedBrand, '[ObuMindmap] frontmatter persist error');

  const legacyFile = { path: 'Maps/Legacy.md', basename: 'Legacy' };
  const legacyContent = [
    '---',
    'type: mindmap',
    'mindmap-structure: hybrid',
    '---',
    '# Root',
    '## *需求分析*',
    '- *后端*',
    '',
  ].join('\n');
  let legacyDiskValue = legacyContent;
  let legacyEditorValue = legacyContent;
  let legacyWriteCount = 0;
  const legacyView = Object.assign(new MockMarkdownView(), {
    file: legacyFile,
    editor: {
      getValue: () => legacyEditorValue,
      setValue: (value) => {
        legacyEditorValue = value;
      },
    },
  });
  const legacyParsedForOverlay = plugin._parseStructured(legacyContent, 'hybrid');
  const legacyOverlay = {
    _stratifyFile: legacyFile,
    _stratifyView: legacyView,
    _stratifyParsed: legacyParsedForOverlay,
    _stratifyTreeInfo: plugin._buildTree(legacyParsedForOverlay, legacyFile.basename),
    _stratifyStructure: 'hybrid',
    _stratifyFrontmatter: plugin._splitFrontmatter(legacyContent).frontmatter,
    _stratifyUndoStack: [],
    _stratifyRedoStack: [],
    _stratifySelected: null,
    _stratifyPendingEdit: null,
    _stratifyWriting: false,
    ownerDocument: {
      defaultView: { requestAnimationFrame: (callback) => callback() },
    },
  };
  legacyView.contentEl = {
    querySelector: () => legacyOverlay,
    addClass: () => {},
    removeClass: () => {},
  };
  const activeViewBeforeMigration = plugin.app.workspace.getActiveViewOfType;
  const modifyBeforeMigration = plugin.app.vault.modify;
  plugin.app.workspace.getActiveViewOfType = () => legacyView;
  plugin.app.vault.modify = async (target, content) => {
    assert.strictEqual(target, legacyFile);
    legacyDiskValue = content;
    legacyWriteCount += 1;
  };
  notices.length = 0;
  await plugin._migrateLegacyCollapseMarkers();
  assert.match(legacyDiskValue, /mindmap-collapse-version: 2/);
  assert.doesNotMatch(plugin._splitFrontmatter(legacyDiskValue).body, /\*需求分析\*/);
  assert.doesNotMatch(plugin._splitFrontmatter(legacyDiskValue).body, /\*后端\*/);
  assert.match(plugin._splitFrontmatter(legacyDiskValue).body, /^## 需求分析\n- 后端$/m);
  assert.doesNotMatch(plugin._splitFrontmatter(legacyDiskValue).body, /### 后端/);
  const migratedParsed = plugin._parseStructured(legacyDiskValue, 'hybrid');
  const migratedTree = plugin._buildTree(migratedParsed, legacyFile.basename);
  const migratedNodes = [];
  const collectMigratedNodes = (node) => {
    if (!node) return;
    migratedNodes.push(node);
    node.children.forEach(collectMigratedNodes);
  };
  collectMigratedNodes(migratedTree.tree);
  assert.strictEqual(migratedNodes.filter((node) => node.collapsed).length, 2);
  assert.strictEqual(notices.at(-1), 'Migrated 2 legacy collapsed nodes');
  assert.strictEqual(legacyOverlay._stratifyUndoStack[0], legacyContent);

  const writesAfterMigration = legacyWriteCount;
  await plugin._migrateLegacyCollapseMarkers();
  assert.strictEqual(legacyWriteCount, writesAfterMigration);
  assert.strictEqual(notices.at(-1), 'This mind map already uses collapse storage version 2');

  await plugin._undoMindmap(legacyOverlay);
  assert.strictEqual(legacyDiskValue, legacyContent);
  await plugin._redoMindmap(legacyOverlay);
  assert.match(legacyDiskValue, /mindmap-collapse-version: 2/);

  legacyEditorValue = legacyContent;
  legacyDiskValue = legacyContent;
  legacyOverlay._stratifyFile = { path: 'Maps/Stale.md', basename: 'Stale' };
  legacyOverlay._stratifyView = new MockMarkdownView();
  legacyOverlay._stratifyFrontmatter = plugin._splitFrontmatter(legacyContent).frontmatter;
  legacyOverlay._stratifyParsed = plugin._parseStructured(legacyContent, 'hybrid');
  legacyOverlay._stratifyTreeInfo = plugin._buildTree(legacyOverlay._stratifyParsed, legacyFile.basename);
  const staleHistoryContent = [
    '---',
    'type: mindmap',
    'mindmap-structure: heading',
    '---',
    '# Content from another file',
    '',
  ].join('\n');
  legacyOverlay._stratifyUndoStack = [staleHistoryContent];
  legacyOverlay._stratifyRedoStack = [staleHistoryContent];
  const removedStaleListeners = [];
  const staleBlurListener = () => {};
  const staleInputListener = () => {};
  let clearedStaleTimer = null;
  let removedMentionPopup = false;
  legacyOverlay.ownerDocument.defaultView.clearTimeout = (timer) => {
    clearedStaleTimer = timer;
  };
  legacyOverlay._stratifyAutosaveTimer = 77;
  legacyOverlay._stratifyEditingNode = {
    _el: {
      removeEventListener: (name, listener) => {
        removedStaleListeners.push([name, listener]);
      },
    },
  };
  legacyOverlay._stratifyEditingBlur = staleBlurListener;
  legacyOverlay._stratifyMentionInput = staleInputListener;
  legacyOverlay._stratifyMention = {
    popup: {
      remove: () => {
        removedMentionPopup = true;
      },
    },
  };
  await plugin._migrateLegacyCollapseMarkers();
  assert.match(legacyDiskValue, /mindmap-collapse-version: 2/);
  assert.strictEqual(legacyOverlay._stratifyFile, legacyFile);
  assert.strictEqual(legacyOverlay._stratifyView, legacyView);
  assert.strictEqual(clearedStaleTimer, 77);
  assert.strictEqual(legacyOverlay._stratifyAutosaveTimer, null);
  assert.deepStrictEqual(removedStaleListeners, [
    ['blur', staleBlurListener],
    ['input', staleInputListener],
  ]);
  assert.strictEqual(removedMentionPopup, true);
  assert.strictEqual(legacyOverlay._stratifyMention, null);
  assert.strictEqual(legacyOverlay._stratifyMentionInput, null);
  assert.strictEqual(legacyOverlay._stratifyEditingNode, null);
  assert.deepStrictEqual(legacyOverlay._stratifyUndoStack, [legacyContent]);
  assert.deepStrictEqual(legacyOverlay._stratifyRedoStack, []);
  assert.strictEqual(await plugin._undoMindmap(legacyOverlay), true);
  assert.strictEqual(legacyDiskValue, legacyContent);
  const writesAfterActiveFileUndo = legacyWriteCount;
  assert.strictEqual(await plugin._undoMindmap(legacyOverlay), false);
  assert.strictEqual(legacyWriteCount, writesAfterActiveFileUndo);
  assert.doesNotMatch(legacyDiskValue, /Content from another file/);

  const legacyConvertFile = new MockTFile('Maps/Already Mindmap.md');
  const legacyConvertFrontmatter = {
    type: 'mindmap',
    'mindmap-structure': 'heading',
  };
  const readFileBeforeConvert = plugin._readFileContent;
  const processFrontMatterBeforeConvert = plugin.app.fileManager.processFrontMatter;
  const scanBeforeConvert = plugin._scan;
  plugin._readFileContent = async () => '---\ntype: mindmap\nmindmap-structure: heading\n---\n# *Old fold*\n';
  plugin.app.fileManager.processFrontMatter = async (target, update) => {
    assert.strictEqual(target, legacyConvertFile);
    update(legacyConvertFrontmatter);
  };
  plugin._scan = () => {};
  await plugin._convertFileToMindmap(legacyConvertFile, false);
  assert.strictEqual(
    legacyConvertFrontmatter['mindmap-collapse-version'],
    undefined,
    're-converting a legacy mind map must not silently switch its collapse semantics'
  );
  plugin._readFileContent = readFileBeforeConvert;
  plugin.app.fileManager.processFrontMatter = processFrontMatterBeforeConvert;
  plugin._scan = scanBeforeConvert;

  plugin.app.workspace.getActiveViewOfType = activeViewBeforeMigration;
  plugin.app.vault.modify = modifyBeforeMigration;
  renderedContents.length = 0;

  const exportFile = { path: 'Maps/项目.md', basename: '项目', extension: 'md' };
  let exportSource = [
    '---',
    'type: mindmap',
    'mindmap-collapse-version: 2',
    'mindmap-collapsed:',
    '  - 项目[1]/需求[1]',
    'tags:',
    '  - 项目',
    '---',
    '# 项目',
    '',
    '## 需求',
    '',
    '```yaml',
    '---',
    '```',
  ].join('\n');
  const exportView = Object.assign(new MockMarkdownView(), {
    file: exportFile,
    editor: { getValue: () => exportSource },
  });
  const exportOverlay = {};
  exportView.contentEl = { querySelector: () => exportOverlay };
  let createdPath = null;
  let createdContent = null;
  let openedPath = null;
  const getActiveBeforeExport = plugin.app.workspace.getActiveViewOfType;
  const openLinkBeforeExport = plugin.app.workspace.openLinkText;
  const getAbstractBeforeExport = plugin.app.vault.getAbstractFileByPath;
  const createBeforeExport = plugin.app.vault.create;
  const commitBeforeExport = plugin._commitActiveEdit;
  let exportEditCommitted = false;
  plugin.app.workspace.getActiveViewOfType = () => exportView;
  plugin.app.workspace.openLinkText = async (pathToOpen) => {
    openedPath = pathToOpen;
  };
  plugin.app.vault.getAbstractFileByPath = (candidate) => (
    candidate === 'Maps/项目-clean.md' ? { path: candidate } : null
  );
  plugin.app.vault.create = async (pathToCreate, contentToCreate) => {
    createdPath = pathToCreate;
    createdContent = contentToCreate;
    return { path: pathToCreate };
  };
  plugin._commitActiveEdit = async (targetOverlay) => {
    assert.strictEqual(targetOverlay, exportOverlay);
    exportEditCommitted = true;
    exportSource = exportSource.replace('## 需求', '## 需求（已编辑）');
    return true;
  };
  const sourceBeforeExport = diskValue;
  notices.length = 0;
  await plugin._exportCleanMarkdown();
  assert.strictEqual(exportEditCommitted, true);
  assert.strictEqual(createdPath, 'Maps/项目-clean-2.md');
  assert.strictEqual(createdContent, '# 项目\n\n## 需求（已编辑）\n\n```yaml\n---\n```');
  assert.strictEqual(diskValue, sourceBeforeExport);
  assert.strictEqual(openedPath, createdPath);
  assert.strictEqual(notices.at(-1), 'Exported clean Markdown: 项目-clean-2.md');
  plugin.app.workspace.getActiveViewOfType = getActiveBeforeExport;
  plugin.app.workspace.openLinkText = openLinkBeforeExport;
  plugin.app.vault.getAbstractFileByPath = getAbstractBeforeExport;
  plugin.app.vault.create = createBeforeExport;
  plugin._commitActiveEdit = commitBeforeExport;

  const orderedFixture = parseFixtureTree(headingV2, 'heading');
  const orderedOverlay = {
    _stratifyFile: file,
    _stratifyView: view,
    _stratifyParsed: orderedFixture.parsed,
    _stratifyTreeInfo: orderedFixture.treeInfo,
    _stratifyStructure: 'heading',
    _stratifySelected: null,
    _stratifyPendingEdit: null,
    _stratifyUndoStack: [],
    _stratifyRedoStack: [],
    ownerDocument: {
      defaultView: { requestAnimationFrame: (callback) => callback() },
    },
  };
  const writeBeforeOrderingTest = plugin._writeMindmapContent;
  const renderTreeBeforeOrderingTest = plugin._renderTreeIntoCanvas;
  const orderedStarts = [];
  const orderedResolvers = [];
  plugin._renderTreeIntoCanvas = () => {};
  plugin._writeMindmapContent = (_targetOverlay, content) => new Promise((resolve) => {
    orderedStarts.push(content);
    orderedResolvers.push(resolve);
  });
  const olderWrite = plugin._queueMindmapWrite(orderedOverlay, 'older edit');
  const branchToCollapse = orderedOverlay._stratifyTreeInfo.tree.children[0];
  branchToCollapse.collapsed = false;
  const collapseWrite = plugin._toggleCollapse(orderedOverlay, branchToCollapse);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepStrictEqual(
    orderedStarts,
    ['older edit'],
    'a collapse write must wait for an earlier full-document save'
  );
  orderedResolvers.shift()();
  await olderWrite;
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(orderedStarts.length, 2);
  assert.match(orderedStarts[1], /mindmap-collapsed:\n  - Root\[1\]\/Branch\[1\]/);
  orderedResolvers.shift()();
  await collapseWrite;

  const undoTarget = orderedStarts[1];
  orderedOverlay._stratifyUndoStack = [headingV2];
  orderedOverlay._stratifyRedoStack = [];
  const pendingNewerWrite = plugin._queueMindmapWrite(orderedOverlay, undoTarget);
  const undoWrite = plugin._undoMindmap(orderedOverlay);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(
    orderedStarts.length,
    3,
    'Undo must wait for the preceding queued document write'
  );
  orderedResolvers.shift()();
  await pendingNewerWrite;
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(orderedStarts.length, 4);
  assert.strictEqual(orderedStarts[3], headingV2);
  orderedResolvers.shift()();
  assert.strictEqual(await undoWrite, true);

  orderedOverlay._stratifyRedoStack = [undoTarget];
  const pendingBeforeRedo = plugin._queueMindmapWrite(orderedOverlay, headingV2);
  const redoWrite = plugin._redoMindmap(orderedOverlay);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(
    orderedStarts.length,
    5,
    'Redo must wait for the preceding queued document write'
  );
  orderedResolvers.shift()();
  await pendingBeforeRedo;
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(orderedStarts.length, 6);
  assert.strictEqual(orderedStarts[5], undoTarget);
  orderedResolvers.shift()();
  assert.strictEqual(await redoWrite, true);
  plugin._writeMindmapContent = writeBeforeOrderingTest;
  plugin._renderTreeIntoCanvas = renderTreeBeforeOrderingTest;
  renderedContents.length = 0;

  const movementContent = [
    '---',
    'type: mindmap',
    'mindmap-structure: list',
    'mindmap-collapse-version: 2',
    'mindmap-collapsed:',
    '  - Root[1]/Folded[1]',
    '---',
    '- Root',
    '  - Folded',
    '    - Child',
    '  - Target',
    '',
  ].join('\n');
  const movementParsed = plugin._parseStructured(movementContent, 'list');
  const movementOverlay = {
    _stratifyFile: file,
    _stratifyView: view,
    _stratifyParsed: movementParsed,
    _stratifyTreeInfo: plugin._buildTree(movementParsed, file.basename),
    _stratifyStructure: 'list',
    _stratifySelected: null,
    _stratifyPendingEdit: null,
    _stratifyUndoStack: [],
    _stratifyRedoStack: [],
    ownerDocument: {
      defaultView: { requestAnimationFrame: (callback) => callback() },
    },
  };
  const queueBeforeMovementTest = plugin._queueMindmapWrite;
  const persistBeforeMovementTest = plugin._persistAndRelayout;
  const renderBeforeMovementTest = plugin._renderTreeIntoCanvas;
  const movementWrites = [];
  let movementPending = null;
  plugin._queueMindmapWrite = async (_targetOverlay, content) => {
    movementWrites.push(content);
  };
  plugin._renderTreeIntoCanvas = () => {};
  plugin._persistAndRelayout = (targetOverlay) => {
    movementPending = persistBeforeMovementTest.call(plugin, targetOverlay);
    return movementPending;
  };
  const foldedNode = movementOverlay._stratifyTreeInfo.tree.children[0];
  const targetNode = movementOverlay._stratifyTreeInfo.tree.children[1];
  assert.strictEqual(plugin._moveNodeAsChild(movementOverlay, foldedNode, targetNode), true);
  await movementPending;
  assert.deepStrictEqual(
    plugin._splitFrontmatter(movementWrites.at(-1)).frontmatter['mindmap-collapsed'],
    ['Root[1]/Target[1]/Folded[1]']
  );
  const movedFoldedNode = movementOverlay._stratifyTreeInfo.tree.children[0].children[0];
  plugin._deleteNode(movementOverlay, movedFoldedNode);
  await movementPending;
  assert.deepStrictEqual(
    plugin._splitFrontmatter(movementWrites.at(-1)).frontmatter['mindmap-collapsed'],
    []
  );
  plugin._queueMindmapWrite = queueBeforeMovementTest;
  plugin._persistAndRelayout = persistBeforeMovementTest;
  plugin._renderTreeIntoCanvas = renderBeforeMovementTest;

  editorReadCount = 0;
  vaultReadCount = 0;
  mockPlatform.isMobile = true;
  await plugin._doScan();
  assert.ok(overlayClasses.has('stratify-mobile'), 'mobile scans must mark the overlay for touch-safe toolbar styles');
  mockPlatform.isMobile = false;
  assert.strictEqual(editorReadCount, 1, 'an open mindmap must scan the live editor buffer');
  assert.strictEqual(vaultReadCount, 0, 'an open mindmap must not scan stale disk content');
  assert.deepStrictEqual(renderedContents, [], 'stale disk content must not replace the newly rendered child');
  assert.ok(hostClasses.has('stratify-map-visible'), 'visible maps must hide the underlying Markdown pane');

  const persistedEditorValue = editorValue;
  sourceVisible = true;
  editorValue = persistedEditorValue.replace('Renamed Root', 'Source Root');
  await plugin._doScan();
  assert.strictEqual(editorReadCount, 2, 'source mode must scan the live editor buffer');
  assert.strictEqual(overlay._stratifyStaleContent, editorValue);
  assert.ok(!hostClasses.has('stratify-map-visible'), 'source mode must reveal the underlying Markdown pane');
  sourceVisible = false;

  editorValue = persistedEditorValue;
  diskValue = editorValue;
  const reopenedFrontmatter = plugin._splitFrontmatter(diskValue).frontmatter;
  const reopenedMode = plugin._readStructureFromFrontmatter(reopenedFrontmatter);
  const reopenedParsed = plugin._parseStructured(diskValue, reopenedMode);
  const reopenedTree = plugin._buildTree(reopenedParsed, file.basename);
  assert.strictEqual(reopenedMode, 'list');
  assert.strictEqual(reopenedTree.tree.rawText, 'Renamed Root');
  assert.strictEqual(reopenedTree.tree.children.length, 1);
  assert.strictEqual(reopenedTree.tree.children[0].rawText, 'New Title');

  const beforeModeDiskWrite = writeCount;
  const beforeModeEditorWrite = editorSetCount;
  const headingContent = plugin._serializeMindmap(
    overlay._stratifyParsed,
    overlay._stratifyTreeInfo,
    'heading'
  );
  assert.strictEqual(plugin._readStructureFromFrontmatter(plugin._splitFrontmatter(headingContent).frontmatter), 'heading');
  assert.match(plugin._splitFrontmatter(headingContent).body, /^\n?# Renamed Root\n## New Title\n$/);
  overlay._stratifyWriting = true;
  await plugin._writeMindmapContent(overlay, headingContent);
  overlay._stratifyWriting = false;
  assert.strictEqual(writeCount, beforeModeDiskWrite + 1, 'mode changes must write the complete Markdown to the vault');
  assert.strictEqual(editorSetCount, beforeModeEditorWrite + 1, 'a mode change must synchronize the open editor');
  assert.strictEqual(requestSaveCount, 0, 'mode changes must not depend on a deferred view save');
  assert.strictEqual(editorValue, headingContent);

  const broken = headingContent.replace('mindmap-structure: heading', 'mindmap-structure: list');
  const brokenFrontmatter = plugin._splitFrontmatter(broken).frontmatter;
  assert.strictEqual(plugin._parseStructured(broken, 'list').headings.length, 0);
  assert.strictEqual(plugin._resolveStructure(brokenFrontmatter, broken), 'heading');
  assert.strictEqual(plugin._parseStructured(broken, plugin._resolveStructure(brokenFrontmatter, broken)).headings.length, 2);

  const oddParsed = plugin._parseStructured('## Details\n### Child\n# Title\n', 'heading');
  const oddTree = plugin._buildTree(oddParsed, 'F');
  assert.ok(oddTree.virtualRoot, 'out-of-order top levels must use a virtual root');
  assert.deepStrictEqual(oddTree.tree.children.map((node) => node.text), ['Details', 'Title']);
  assert.deepStrictEqual(oddTree.tree.children[0].children.map((node) => node.text), ['Child']);
  assert.strictEqual(
    plugin._serialize(oddParsed, oddTree, 'heading'),
    '# Details\n## Child\n# Title\n',
    'out-of-order headings should preserve hierarchy while normalizing levels'
  );

  assert.strictEqual(plugin._safeExternalHref('https://example.com'), 'https://example.com');
  assert.strictEqual(plugin._safeExternalHref(' HTTPS://example.com/path '), 'HTTPS://example.com/path');
  assert.strictEqual(plugin._safeExternalHref('obsidian://open?vault=Test'), 'obsidian://open?vault=Test');
  assert.strictEqual(plugin._safeExternalHref('javascript:alert(1)'), null);
  assert.strictEqual(plugin._safeExternalHref('data:text/html,unsafe'), null);
  assert.strictEqual(plugin._safeExternalHref('Notes/Target.md'), null);

  const measuredChild = {
    _el: { getBoundingClientRect: () => ({ width: 120, height: 60 }) },
    children: [],
    collapsed: false,
  };
  const measuredRoot = {
    _el: { getBoundingClientRect: () => ({ width: 200, height: 80 }) },
    children: [measuredChild],
    collapsed: false,
  };
  plugin._measureNodes(measuredRoot, 2);
  assert.deepStrictEqual([measuredRoot.width, measuredRoot.height], [100, 40]);
  assert.deepStrictEqual([measuredChild.width, measuredChild.height], [60, 30]);

  const zoomInner = { style: {} };
  const zoomCanvas = { _stratify: { tx: 100, ty: 70, scale: 3 }, clientWidth: 400, clientHeight: 300 };
  plugin._zoomBy(zoomCanvas, zoomInner, 1.2);
  assert.deepStrictEqual(zoomCanvas._stratify, { tx: 100, ty: 70, scale: 3 });
  zoomCanvas._stratify = { tx: -20, ty: -10, scale: 0.2 };
  plugin._zoomBy(zoomCanvas, zoomInner, 1 / 1.2);
  assert.deepStrictEqual(zoomCanvas._stratify, { tx: -20, ty: -10, scale: 0.2 });
  zoomCanvas._stratify = { tx: 0, ty: 0, scale: 1 };
  plugin._zoomBy(zoomCanvas, zoomInner, 2);
  assert.deepStrictEqual(zoomCanvas._stratify, { tx: -200, ty: -150, scale: 2 });

  const fitInner = { style: { width: '800px', height: '400px' } };
  const fitCanvas = {
    _stratify: { tx: 12, ty: 18, scale: 0.75 },
    clientWidth: 0,
    clientHeight: 0,
  };
  assert.strictEqual(plugin._fitTo(fitCanvas, fitInner), false);
  assert.deepStrictEqual(
    fitCanvas._stratify,
    { tx: 12, ty: 18, scale: 0.75 },
    'a hidden startup canvas must not overwrite its transform with a zero scale'
  );
  fitCanvas.clientWidth = 1000;
  fitCanvas.clientHeight = 600;
  assert.strictEqual(plugin._fitTo(fitCanvas, fitInner), true);
  assert.deepStrictEqual(fitCanvas._stratify, { tx: 100, ty: 100, scale: 1 });

  const geometryFrames = new Map();
  let nextGeometryFrame = 1;
  let geometryObserverCallback = null;
  let geometryObserverDisconnected = false;
  const geometryWindow = {
    requestAnimationFrame: (callback) => {
      const id = nextGeometryFrame++;
      geometryFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => geometryFrames.delete(id),
    ResizeObserver: class {
      constructor(callback) {
        geometryObserverCallback = callback;
      }
      observe() {}
      disconnect() {
        geometryObserverDisconnected = true;
      }
    },
  };
  const flushGeometryFrames = () => {
    const pending = Array.from(geometryFrames.values());
    geometryFrames.clear();
    pending.forEach((callback) => callback());
  };
  const geometryCanvas = {
    _stratify: { tx: 0, ty: 0, scale: 1 },
    clientWidth: 0,
    clientHeight: 0,
    ownerDocument: { defaultView: geometryWindow },
  };
  const geometryInner = { style: { width: '800px', height: '400px' } };
  const geometryOverlay = {
    _stratifyCanvas: geometryCanvas,
    _stratifyInner: geometryInner,
    _stratifyLayoutReady: false,
    _stratifyRenderPending: false,
    _stratifyPendingPreserveTransform: false,
    _stratifyUserTransformed: false,
    _stratifyCleanup: null,
  };
  const originalRenderTreeIntoCanvas = plugin._renderTreeIntoCanvas;
  const originalFitTo = plugin._fitTo;
  const geometryRenders = [];
  let geometryFits = 0;
  plugin._renderTreeIntoCanvas = (target, preserveTransform) => {
    geometryRenders.push([target, preserveTransform]);
  };
  plugin._fitTo = () => {
    geometryFits += 1;
    return true;
  };
  plugin._bindCanvasGeometry(geometryCanvas, geometryInner, geometryOverlay);
  assert.ok(geometryObserverCallback, 'canvas geometry recovery must observe restored tabs');

  geometryObserverCallback();
  flushGeometryFrames();
  assert.strictEqual(geometryRenders.length, 0, 'a hidden canvas must wait for a usable size');

  geometryCanvas.clientWidth = 900;
  geometryCanvas.clientHeight = 600;
  geometryObserverCallback();
  flushGeometryFrames();
  assert.deepStrictEqual(
    geometryRenders,
    [[geometryOverlay, false]],
    'a restored background tab must rerender once its canvas becomes visible'
  );

  geometryOverlay._stratifyLayoutReady = true;
  geometryCanvas.clientWidth = 1000;
  geometryObserverCallback();
  flushGeometryFrames();
  assert.strictEqual(geometryFits, 1, 'an untouched map must refit after startup geometry settles');

  geometryOverlay._stratifyUserTransformed = true;
  geometryCanvas.clientWidth = 1100;
  geometryObserverCallback();
  flushGeometryFrames();
  assert.strictEqual(geometryFits, 1, 'geometry recovery must not override a user transform');

  geometryOverlay._stratifyCleanup();
  assert.ok(geometryObserverDisconnected, 'render cleanup must disconnect the canvas observer');
  plugin._renderTreeIntoCanvas = originalRenderTreeIntoCanvas;
  plugin._fitTo = originalFitTo;

  const switchingOldFile = { path: 'Maps/Switching Old.md', basename: 'Switching Old' };
  const switchingNewFile = { path: 'Maps/Switching New.md', basename: 'Switching New' };
  const switchingOldContent = plugin._newMindmapContent();
  const switchingParsed = plugin._parseStructured(switchingOldContent, 'list');
  const switchingTreeInfo = plugin._buildTree(switchingParsed, switchingOldFile.basename);
  const switchingNodeEl = {
    isContentEditable: true,
    textContent: 'Typed without Enter',
    empty() {
      this.textContent = '';
    },
    removeEventListener: () => {},
    classList: { remove: () => {} },
  };
  switchingTreeInfo.tree._el = switchingNodeEl;
  const switchingOverlay = {
    _stratifyFile: switchingOldFile,
    _stratifyView: view,
    _stratifyParsed: switchingParsed,
    _stratifyTreeInfo: switchingTreeInfo,
    _stratifyStructure: 'list',
    _stratifyEditingNode: switchingTreeInfo.tree,
    _stratifyEditSnapshot: switchingOldContent,
    _stratifyEditChanged: false,
    _stratifyUndoStack: [],
    _stratifyRedoStack: [],
    _stratifyAutosaveTimer: null,
    _stratifyMention: null,
    classList: {
      contains: () => false,
      toggle: () => {},
    },
    dataset: {},
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (callback) => callback(),
        clearTimeout: () => {},
      },
    },
  };
  const switchingView = Object.assign(new MockMarkdownView(), {
    file: switchingNewFile,
    editor: { getValue: () => plugin._newMindmapContent() },
    contentEl: {
      querySelector: () => switchingOverlay,
      addClass: () => {},
      removeClass: () => {},
    },
  });
  switchingOverlay._stratifyView = switchingView;
  let switchingPersisted = switchingOldContent;
  const switchingLeaves = plugin.app.workspace.getLeavesOfType;
  plugin.app.workspace.getLeavesOfType = () => [{ view: switchingView }];
  plugin.app.metadataCache.getFileCache = () => ({ frontmatter: { type: 'mindmap', 'mindmap-structure': 'list' } });
  plugin.app.vault.modify = async (target, content) => {
    assert.strictEqual(target, switchingOldFile, 'switching files must save the overlay\'s old file');
    switchingPersisted = content;
  };
  await plugin._doScan();
  assert.match(
    switchingPersisted,
    /- Typed without Enter/,
    'switching files must persist the active node without Enter, Tab, or blur'
  );
  assert.strictEqual(switchingOverlay._stratifyEditingNode, null, 'a switched file must leave edit mode');
  plugin.app.workspace.getLeavesOfType = switchingLeaves;
  plugin.app.metadataCache.getFileCache = () => ({ frontmatter: { type: 'mindmap', 'mindmap-structure': 'list' } });
  plugin.app.vault.modify = async (target, content) => {
    assert.strictEqual(target, file);
    diskValue = content;
    writeCount += 1;
  };

  assert.deepStrictEqual(plugin._hexToRgb('rgb(255, 255, 255)'), [255, 255, 255]);
  assert.deepStrictEqual(plugin._hexToRgb('rgba(12, 34, 56, 0.5)'), [12, 34, 56]);
  assert.deepStrictEqual(plugin._hexToRgb('#abc'), [170, 187, 204]);
  assert.strictEqual(plugin._mixColors('#FF0000', 'rgb(255,255,255)', 0.5), 'rgb(255,128,128)');

  const getLeavesOfType = plugin.app.workspace.getLeavesOfType;
  let unloadedScanCount = 0;
  plugin.app.workspace.getLeavesOfType = () => {
    unloadedScanCount += 1;
    return [];
  };
  plugin._unloading = true;
  await plugin._doScan();
  assert.strictEqual(unloadedScanCount, 0, 'an unloaded plugin must not start another scan');
  plugin._unloading = false;
  plugin.app.workspace.getLeavesOfType = getLeavesOfType;

  const cachedRead = plugin.app.vault.cachedRead;
  let resolveDelayedRead;
  let overlayCreateCount = 0;
  const delayedView = Object.assign(new MockMarkdownView(), {
    file,
    editor: null,
    contentEl: {
      addClass: () => {},
      querySelector: () => null,
      createDiv: () => {
        overlayCreateCount += 1;
        return {};
      },
    },
  });
  plugin.app.workspace.getLeavesOfType = () => [{ view: delayedView }];
  plugin.app.vault.cachedRead = () => new Promise((resolve) => {
    resolveDelayedRead = resolve;
  });
  const delayedScan = plugin._doScan();
  await Promise.resolve();
  assert.ok(resolveDelayedRead, 'the delayed scan should reach the asynchronous file read');
  plugin._unloading = true;
  resolveDelayedRead(editorValue);
  await delayedScan;
  assert.strictEqual(overlayCreateCount, 0, 'an in-flight scan must not recreate an overlay after unload');
  plugin._unloading = false;
  plugin.app.workspace.getLeavesOfType = getLeavesOfType;
  plugin.app.vault.cachedRead = cachedRead;

  const styles = fs.readFileSync(path.resolve('./styles.css'), 'utf8');
  assert.match(styles, /--stratify-safe-top:[^;]*safe-area-inset-top/);
  assert.match(styles, /--stratify-mobile-toolbar-offset:[^;]*--view-header-height/s);
  assert.match(styles, /margin-top: var\(--stratify-mobile-toolbar-offset\)/);
  assert.match(styles, /\.stratify-overlay\.stratify-mobile \.stratify-icon-btn\s*\{[^}]*width: 44px/s);
  assert.match(styles, /\.stratify-overlay\.stratify-mobile \.stratify-more-panel\s*\{[^}]*left:/s);
  assert.match(
    styles,
    /\.stratify-collapse-toggle\s*\{[^}]*min-width:\s*28px[^}]*min-height:\s*28px/s
  );
  assert.match(
    styles,
    /\.stratify-overlay\.stratify-mobile \.stratify-collapse-toggle\s*\{[^}]*min-width:\s*36px[^}]*min-height:\s*36px/s
  );

  console.log('Persistence, rendering, lifecycle, and mobile toolbar tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
