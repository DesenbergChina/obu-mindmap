# Obu Mindmap 0.1.0 设计规格

## 目标

将 Stratify Mindmap 1.2.1 的源码作为兼容基线，发布为独立的 Obsidian 插件 Obu Mindmap 0.1.0。插件继续读取 `type: mindmap` 和既有 `mindmap-*` frontmatter，不要求用户转换原有笔记；新增逐篇默认视图、版本 2 折叠存储、节点 `+/-` 控件、显式旧格式迁移和纯净 Markdown 导出。

## 范围

0.1.0 包含：

- 独立插件身份：`id: obu-mindmap`、名称、作者、版本、README 和发布元数据；
- `mindmap-default: mindmap | markdown`，以及新建默认值、设置项和切换命令；
- `mindmap-collapse-version: 2` 与 `mindmap-collapsed` 路径数组；
- 展开节点显示 `−`、折叠节点显示 `+`、叶节点不显示按钮；
- `Migrate legacy collapse markers` 显式迁移命令；
- `Export clean Markdown` 命令，删除完整 frontmatter，防止覆盖已有文件；
- 针对默认视图、折叠路径、迁移、导出、交互和兼容性的自动化测试。

0.1.0 不包含：

- 与 Stratify Mindmap 同时启用；
- `type: obu-mindmap` 或批量笔记类型转换；
- Stratify `data.json` 自动迁移；
- FreeMind、OPML、XMind 或云服务；
- 内部 `_stratify*` TypeScript 字段和 `.stratify-*` CSS 命名空间的全量重命名；
- 打开旧文件时静默删除星号。

## 实现路径

采用增量兼容方案：

1. 以 Stratify Mindmap 1.2.1 的干净代码为基线，在独立目标目录和功能分支开发。
2. 保留现有 overlay、树布局、编辑、拖拽、Undo/Redo 和写入队列。
3. 将折叠路径、frontmatter 读写、旧标记识别和纯净导出命名等纯逻辑放入小型模块，以便不依赖 Obsidian DOM 进行测试。
4. `src/main.ts` 负责 Obsidian 生命周期、命令、视图切换、文件写入和 DOM 交互，并调用纯逻辑模块。
5. 所有改变文档内容或折叠状态的操作继续通过完整 Markdown 快照进入现有 Undo/Redo 和写入队列。

不采用以下方案：

- 直接修改 `stratify-mindmap` 工作目录：会污染兼容基线并增加回滚成本；
- 在 0.1.0 全面拆分 4400 行 `main.ts`：改动面过大，与首版低回归目标冲突。

## 文件职责

- `src/main.ts`：插件生命周期、命令注册、overlay 状态、视图切换、文件操作、DOM 渲染和事件。
- `src/collapse-state.ts`：节点标题编码、同名兄弟编号、完整路径生成、折叠路径收集和应用。
- `src/markdown-file.ts`：frontmatter/正文边界处理、纯净 Markdown 提取、导出文件名选择。
- `test-persistence.cjs`：现有插件级回归测试，以及默认视图、完整快照、命令和 DOM 交互测试。
- `test-core.cjs`：不加载 Obsidian 的纯逻辑测试，覆盖折叠路径、迁移数据和导出命名。
- `styles.css`：折叠按钮的桌面、移动端、布局和可访问交互样式。
- `manifest.json`、`package.json`、`versions.json`、`README.md`、`README_zh-CN.md`、`CHANGELOG.md`：身份、发布和用户文档。

## 数据模型

### 默认视图

合法值只有：

```yaml
mindmap-default: mindmap
```

或：

```yaml
mindmap-default: markdown
```

缺失值使用全局 `Default view for new mind maps` 设置；该全局设置的初始值为 `mindmap`，因此未改设置时，缺失字段仍默认打开脑图。非法值不使用全局设置，固定回退为 `mindmap`。当 frontmatter 明确配置合法值时，逐篇设置优先于全局设置。

overlay 保存已应用文件路径：

```typescript
_stratifyDefaultViewAppliedFor?: string;
```

只有文件首次进入 leaf、leaf 切换文件或工作区恢复重新装载时应用默认视图。普通 `_doScan()` 不重复覆盖用户的手动切换。

### 折叠状态

新版字段为：

```yaml
mindmap-collapse-version: 2
mindmap-collapsed:
  - 项目计划[1]/系统设计[1]
```

路径不包含虚拟根节点。每段由规范化原始标题的百分号编码值和 `[同名兄弟序号]` 构成；序号只在同一父节点、相同规范化标题之间计数，从 1 开始。编码必须覆盖 `%`、`/`、`\`、`[`、`]`，从而保证路径分隔符和序号语法无歧义。

读取顺序：

1. 解析完整 Markdown 树；
2. 如果版本为 2，不把外围单星号解释为折叠；
3. 为真实节点生成路径；
4. 读取字符串数组 `mindmap-collapsed`；
5. 只对完全匹配的有效路径设置 `collapsed = true`；
6. 无效或失效路径忽略，对应节点保持展开。

写入顺序：

1. 修改内存树；
2. 遍历完整树并收集折叠路径；
3. 生成 `mindmap-collapse-version: 2` 和 `mindmap-collapsed`；
4. 序列化正文，且不因折叠状态添加或删除标题外围星号；
5. 将 frontmatter 与正文组合为一个完整字符串；
6. 通过现有写入队列一次提交，并把同一个完整字符串用于 Undo/Redo。

上述版本 2 写入顺序只用于新文件、已迁移文件和新转换的脑图。没有 `mindmap-collapse-version: 2` 的旧文件在普通编辑、折叠、重命名或拖拽时继续使用旧星号存储；只有用户执行显式迁移命令后才切换到版本 2。这样可以避免任何后台扫描或普通编辑静默改变用户原有斜体文本。

### 旧格式

没有 `mindmap-collapse-version: 2` 的文件继续按旧规则读取完整单星号标题或列表项。迁移只能由用户执行命令触发。迁移使用旧规则构建内存折叠状态，再以版本 2 完整快照写回；外围折叠星号从标题或列表项中移除，内部 Markdown 保留。版本 2 文件中的 `*标题*` 始终是正常 Markdown 斜体。

## 交互设计

有子节点时创建真实按钮：

```html
<button class="stratify-collapse-toggle" type="button" aria-label="Collapse children">−</button>
```

- 展开显示 `−`，`aria-label` 为 `Collapse children`；
- 折叠显示 `+`，`aria-label` 为 `Expand children`；
- 叶节点不创建按钮；
- 点击处理器先调用 `preventDefault()` 和 `stopPropagation()`，再调用统一的 `_toggleCollapse(overlay, node)`；
- Space、右键菜单、编辑自动展开和拖入自动展开继续使用既有逻辑；
- 桌面最小点击区域为 28×28 px，移动端为 36×36 px。

## 命令与文件操作

### Toggle default view

未设置或 `mindmap` 切换为 `markdown`；`markdown` 切换为 `mindmap`。命令更新当前文件 frontmatter、立即应用一次目标视图并显示 Notice，不影响其他文件。

### Migrate legacy collapse markers

仅处理当前旧格式脑图。命令写入完整版本 2 快照，显示迁移的折叠节点数；在已是版本 2 的文件上重复执行不会修改内容。

### Export clean Markdown

导出基于当前文件的完整原始正文，不遍历当前可见节点。只移除文件开头合法的 YAML frontmatter；代码块中的 `---` 不受影响。输出放在原目录，依次尝试：

```text
原名-clean.md
原名-clean-2.md
原名-clean-3.md
```

选择第一个不存在的路径，绝不覆盖。成功后打开新文件并显示 Notice，原文件及插件设置不变。

## 新文件

新建脑图包含：

```yaml
---
type: mindmap
mindmap-structure: hybrid
mindmap-layout: balanced
mindmap-theme: minimal
mindmap-line: curve
mindmap-node: rounded
mindmap-default: mindmap
mindmap-collapse-version: 2
mindmap-collapsed: []
---

# New
```

实际的结构、布局、主题、连接线、节点样式和默认视图使用插件设置值；字段名和版本保持上述格式。

## 错误处理

- 非法默认视图值按默认脑图视图处理，不阻止渲染；
- 非数组或包含非字符串值的 `mindmap-collapsed` 只忽略无效项；
- 失效折叠路径保持展开，不能模糊匹配其他节点；
- 无当前 Markdown 文件时命令显示 Notice 并返回；
- 迁移、导出、frontmatter 更新和完整快照写入捕获异常，记录 `[ObuMindmap]` 错误并显示用户可理解的 Notice；
- 导出命名在创建前逐个检查存在性，创建失败不修改原文件；
- 文件切换前继续提交活动编辑，避免未按 Enter 的输入丢失。

## 测试与验收

开发遵循测试先行：每项行为先新增会因功能缺失而失败的测试，再写最小实现并运行完整回归。

自动化测试至少覆盖：

- 默认视图的全局默认、逐篇覆盖、文件切换、重复扫描和工作区恢复；
- Heading、Hybrid、List 三种结构中的折叠状态；
- 同名节点、中文、英文、特殊字符、重命名、拖拽、删除、Undo/Redo 和重开；
- `+/-` 文本、叶节点无按钮、事件阻止、Space 保留和移动端点击尺寸；
- 旧标题和列表星号迁移、新版斜体语义、重复迁移；
- 完整 frontmatter 删除、正文保真、代码块分隔符、无 frontmatter、中文文件名和防覆盖命名；
- 原有持久化、布局、移动工具栏、拖拽和编辑回归。

最终验收命令：

```bash
npm run check
```

该命令必须以零退出码完成 ESLint、TypeScript 编译、生产构建和全部测试。发布产物为 `main.js`、`manifest.json` 和 `styles.css`，版本为 0.1.0。
