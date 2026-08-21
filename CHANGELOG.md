# Changelog

## 0.2.1

### English

- Fixed ordered-list write-back to indent nested items by their ancestor marker widths, preserving hierarchy in Obsidian Live Preview and Reading view.
- Added regression coverage for repaired two-space input, deep mixed-marker lists, Hybrid mind maps, and structural edits.
- Unified the project license declarations under the Limited Personal License and clarified that Obu-specific modifications may not be redistributed or used for derivative works without prior written permission.
- Updated vulnerable transitive development dependencies reported by `npm audit`.

### 简体中文

- 修复有序列表写回缩进：根据各级父列表标记宽度计算子项缩进，确保 Obsidian 实时预览和阅读模式保留原层级。
- 补充两空格损坏输入修复、多层混合标记、Hybrid 模式和结构编辑的回归测试。
- 将项目许可证声明统一为有限个人使用许可，并明确未经事先书面许可不得再分发 Obu 专属修改或基于这些修改创作衍生作品。
- 更新 `npm audit` 报告存在漏洞的传递性开发依赖。

## 0.2.0

### English

- Added ordered-list recognition and marker-preserving write-back for List and Hybrid mind maps.
- Made drag, keyboard restructuring, and node creation inherit destination list styles while keeping ordered groups continuous and preserving unrelated mixed markers.

### 简体中文

- 新增有序列表识别，并在 List 与 Hybrid 思维导图中保留原始列表标记写回 Markdown。
- 拖拽、键盘调整层级和新建节点会继承目标层级的列表样式；有序列表保持连续编号，混排层级中的无关标记保持不变。

## 0.1.0

- Established Obu Mindmap as an independent plugin with ID `obu-mindmap`, version 0.1.0, separate settings, and DesenbergChina release metadata.
- Kept zero-conversion compatibility with Stratify `type: mindmap` notes and existing `mindmap-*` fields.
- Added per-note Mind Map or Markdown default views with one-time leaf application.
- Added collapse storage version 2 with encoded node paths, same-name sibling indexes, atomic snapshots, and standard Markdown italics.
- Added accessible `+/-` branch controls while preserving Space, context-menu, edit-expand, and drag-expand interactions.
- Added an explicit, undoable migration command for legacy collapse stars.
- Added clean Markdown export with complete frontmatter removal and non-overwriting `-clean` file names.
- Added core and plugin regression coverage for identity, lifecycle, folding, migration, export, persistence, layout, and mobile controls.

## Upstream history

## 1.2.1

- Restored reliable Markdown persistence by writing structured edits through Obsidian's Vault API and synchronizing the active editor buffer.
- Autosaved unfinished node edits and committed them before switching notes or opening Markdown source mode.
- Serialized writes against their originating file to prevent stale or cross-file updates during rapid navigation.
- Kept interactive relayouts synchronous when geometry is ready and prevented edit focus from scrolling the canvas.
- Added regression coverage for disk persistence, editor synchronization, note switching, and interaction layout stability.

## 1.2.0

- Deferred initial node measurement until both the canvas and root node have usable dimensions.
- Recovered layouts automatically when restored tabs or workspace panes become visible.
- Refit untouched maps while startup geometry settles without overriding user pan or zoom.
- Guarded Fit against zero, non-finite, and otherwise invalid dimensions.
- Added regression coverage for hidden startup canvases, restored tabs, and transform preservation.

## 1.1.10

- Moved the mobile toolbar below Obsidian's own top view controls instead of sharing the same row.
- Derived the offset from Obsidian's `--view-header-height` and the device safe area, with stable fallbacks.
- Kept the toolbar, canvas, and downward-opening options panel in normal layout flow.

## 1.1.9

- Kept the mobile toolbar at the top while moving its controls below iOS and Android display cutouts.
- Increased mobile controls to 44-pixel touch targets and kept Mode, Layout, Fit, Edit Markdown, and options in one row.
- Moved mobile zoom controls into the full-width options panel and changed source-only content to an edit-button status marker.
- Left the desktop toolbar unchanged.

## 1.1.5

- Fixed layout measurements after zooming and stopped wheel or button zoom from drifting at scale limits.
- Preserved the correct hierarchy for out-of-order headings and restricted rendered external links to safe protocols.
- Normalized CSS theme colors before PNG mixing so exports no longer darken unexpectedly.
- Cancelled pending scans, guarded in-flight unload work, and broke stale render cleanup chains.
- Added regression coverage for hierarchy, link protocols, zoom geometry, CSS colors, and unload races.

## 1.1.4

- Fixed newly added nodes and edited root labels reverting before Obsidian saved the active editor to disk.
- Made open mind maps read from the live Editor API and request a save after each structured edit.
- Added a delayed-disk regression test for Tab-created child persistence.

## 1.1.3

- Added reproducible TypeScript, npm, ESLint, CI, and GitHub Release tooling for Obsidian Community submission.
- Replaced direct active-note and Adapter API writes with the Editor, Vault, FileManager, and normalized-path APIs.
- Removed Electron and Node.js dependencies so PNG export behaves consistently on desktop and mobile.
- Replaced unsafe SVG `innerHTML`, global document assumptions, manual settings headings, and plugin-prefixed command IDs.
- Added explicit offline and privacy disclosures and stopped tracking generated `main.js` in the repository.

## 1.1.2

- Fixed newly created child nodes being immediately replaced on screen by a stale Markdown editor buffer.
- Kept source-mode edits responsive by reading the live editor only while the Markdown source is visible.

## 1.1.1

- Fixed Tab-created child nodes and edited root labels being lost when the active structure diverged from note frontmatter.
- Made structure-mode changes update the Markdown body and `mindmap-structure` frontmatter atomically.
- Added a safe parser fallback for notes whose declared structure does not contain any readable nodes.

## 1.1.0

- Replaced the original palettes with curated categorical schemes based on Paul Tol, Tableau Classic, ColorBrewer Paired, and a restrained dark palette.
- Replaced the Theme dropdown with a visual palette picker and added color previews to settings.
- Added a global node font-size slider with matching PNG export text sizing.
- Wrapped long node labels instead of truncating them and tightened node, branch, and canvas spacing.
- Added source-only Markdown indicators and preserved blank-line boundaries during parse/write-back round trips.

## 1.0.0

- Established the independent Stratify Mindmap plugin identity.
- Added the flat Minimal theme and made it the default.
- Reorganized the toolbar around primary controls, icon actions, and one appearance/export menu.
- Preserved deep Heading, Hybrid, and List structures and automatic format detection.
- Preserved direct editing, pointer drag and drop, keyboard navigation, undo, redo, settings, wikilinks, and PNG export.
- Namespaced commands, DOM state, and CSS to avoid styling conflicts with Light Mindmap installations.
