# Obu Mindmap

[English](README.md) | **简体中文**

Obu Mindmap 是一个以 Markdown 为原生数据格式的 Obsidian 思维导图插件。它可以把标题和嵌套列表显示为可交互导图，同时保留清晰、可移植的 Markdown 源文。

Obu Mindmap 基于 Stratify Mindmap 开发，并继续使用相同的 Markdown 数据格式；插件 ID、设置、安装目录、版本、仓库和 Release 渠道均独立。

## 主要功能

- Heading、Hybrid、List 三种结构模式
- 识别有序和无序列表，编辑后保留原列表标记
- 平衡、左、右、树形、径向五种布局
- 键盘编辑与导航、拖拽、普通链接和 Wiki 链接
- 每篇笔记可独立选择默认打开脑图或 Markdown
- 折叠状态不再占用 Markdown 斜体语法
- 每个分支显示可点击、可访问的 `+/-` 按钮
- 显式迁移旧版 `*折叠节点*` 标记
- 导出完全移除 frontmatter 的纯净 Markdown
- PNG 导出、主题、连接线和节点样式
- 支持桌面端和移动端

![Obu Mindmap 桌面端导图总览](assets/desktop-overview.png)

## Markdown 格式

Obu Mindmap 继续通过以下字段识别脑图：

```yaml
---
type: mindmap
---
```

以下现有字段继续兼容：

```yaml
mindmap-structure:
mindmap-layout:
mindmap-theme:
mindmap-line:
mindmap-node:
```

无需转换为 `type: obu-mindmap`。

### 新建脑图

新文件会写入当前全局默认值和新增字段：

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

## 每篇笔记的默认视图

可在 frontmatter 中使用：

```yaml
mindmap-default: mindmap
```

或：

```yaml
mindmap-default: markdown
```

执行 **Obu Mindmap: Toggle default view** 可以切换当前笔记并立即应用。默认视图只在文件首次进入 Leaf、Leaf 切换文件或工作区重新装载时应用；后续扫描不会覆盖用户手动切换的视图。

设置页中的 **Default view for new mind maps** 用于新建文件和未设置 `mindmap-default` 的笔记。非法的逐篇值会安全回退到脑图视图。

## 新版折叠存储

版本 2 将折叠状态保存到 frontmatter：

```yaml
mindmap-collapse-version: 2
mindmap-collapsed:
  - 项目%2F计划[1]/系统设计[1]
```

正文保持标准 Markdown：

```markdown
# 项目/计划

## 系统设计

### 后端
```

路径由祖先标题和同名兄弟序号组成，特殊字符会编码。失效路径会被忽略，不会模糊匹配到其他节点。

分支节点显示：

- 展开时为 `−`
- 折叠时为 `+`
- 没有子节点时不显示按钮

可以点击按钮、按 `Space` 或使用右键菜单。编辑折叠分支、向折叠分支拖入子节点时会自动展开。

## 迁移旧折叠标记

旧版 Stratify 笔记可能这样保存折叠：

```markdown
## *需求分析*
```

这些笔记无需转换即可打开。需要升级当前笔记时，执行 **Obu Mindmap: Migrate legacy collapse markers**。该命令会：

1. 识别旧标题和列表折叠标记；
2. 写入 `mindmap-collapse-version: 2` 和 `mindmap-collapsed`；
3. 只删除外围的旧折叠星号；
4. 记录一个完整的 Undo/Redo 快照；
5. 提示迁移节点数量。

插件不会静默迁移旧文件。在版本 2 文件中，`*斜体文本*` 只表示正常 Markdown 斜体，不表示折叠。

## 导出纯净 Markdown

执行 **Obu Mindmap: Export clean Markdown**，会在原笔记同目录生成标准 Markdown 副本。

- 删除完整 frontmatter，包括 `type`、`mindmap-*`、标签、别名和自定义属性；
- 保留全部正文，包括折叠隐藏的子节点、段落、链接、代码块、表格、引用和空行；
- 不修改原文件；
- 永不覆盖已有文件。

插件会选择第一个可用名称：

```text
项目-clean.md
项目-clean-2.md
项目-clean-3.md
```

导出文件不包含 Obu 专用标记，可用于幕布等 Markdown 工具。为了获得清晰层级，建议导出前使用 Heading 模式或规范的嵌套列表。

## 从 Stratify Mindmap 迁移

1. 禁用 Stratify Mindmap。
2. 安装并启用 Obu Mindmap。
3. 直接打开现有 `type: mindmap` 笔记。
4. 重新设置一次需要的全局默认值。
5. 如有需要，对旧文件逐篇执行折叠迁移命令。

每篇笔记的结构、布局、主题、连接线和节点样式仍保存在 Markdown 中。全局设置因插件 ID 不同而独立保存，不会自动复制。

不要同时启用 Obu Mindmap 与 Stratify Mindmap，因为二者都会处理相同的 `type: mindmap` 笔记。

## 安装

### 使用 Release

1. 从 Obu Mindmap Release 下载 `main.js`、`manifest.json`、`styles.css`。
2. 新建 `<vault>/.obsidian/plugins/obu-mindmap/`。
3. 将三个文件复制到该目录。
4. 重新加载 Obsidian。
5. 在 **设置 → 社区插件** 中启用 **Obu Mindmap**。

### 从源码构建

```bash
npm ci
npm run build
```

将 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/obu-mindmap/`。

## 开发

```bash
npm ci
npm run dev
```

发布前执行：

```bash
npm run check
node scripts/verify-release.mjs
```

`npm run check` 会运行 ESLint、TypeScript 编译、生产构建、核心行为测试和插件回归测试。

## 隐私

Obu Mindmap 完全在本地离线运行，不收集遥测、不展示广告、不访问当前 Vault 以外的文件，也不提供自建云服务。

## Credits

Obu Mindmap is based on Stratify Mindmap by Lywooye,
which is derived from Light Mindmap by Light Ning.

Obu-specific features and ongoing maintenance are provided by
DesenbergChina.

## License

MIT。上游项目的版权声明继续保留在 [LICENSE](LICENSE) 中。
