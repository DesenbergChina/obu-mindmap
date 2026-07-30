export const COLLAPSE_VERSION = 2;

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

interface CollapsePathEntry {
  node: CollapseNodeLike;
  path: string;
}

export function normalizeCollapseTitle(node: CollapseNodeLike): string {
  return String(node.rawText || node.text || '').trim().normalize('NFC');
}

export function encodeCollapseTitle(node: CollapseNodeLike): string {
  return encodeURIComponent(normalizeCollapseTitle(node));
}

function collectPathEntries(treeInfo: CollapseTreeLike): CollapsePathEntry[] {
  const root = treeInfo.tree;
  if (!root) return [];
  const entries: CollapsePathEntry[] = [];

  const visitSiblings = (nodes: CollapseNodeLike[], parentPath: string): void => {
    const siblingCounts = new Map<string, number>();
    for (const node of nodes) {
      const normalizedTitle = normalizeCollapseTitle(node);
      const index = (siblingCounts.get(normalizedTitle) || 0) + 1;
      siblingCounts.set(normalizedTitle, index);
      const segment = encodeCollapseTitle(node) + '[' + index + ']';
      const path = parentPath ? parentPath + '/' + segment : segment;
      entries.push({ node, path });
      visitSiblings(node.children || [], path);
    }
  };

  visitSiblings(treeInfo.virtualRoot || root.isVirtual ? root.children || [] : [root], '');
  return entries;
}

export function collectCollapsedPaths(treeInfo: CollapseTreeLike): string[] {
  return collectPathEntries(treeInfo)
    .filter(({ node }) => node.collapsed)
    .map(({ path }) => path);
}

export function applyCollapsedPaths(treeInfo: CollapseTreeLike, value: unknown): number {
  const entries = collectPathEntries(treeInfo);
  for (const { node } of entries) node.collapsed = false;
  if (!Array.isArray(value)) return 0;

  const requested = new Set(value.filter((item): item is string => typeof item === 'string'));
  let applied = 0;
  for (const { node, path } of entries) {
    if (!requested.has(path)) continue;
    node.collapsed = true;
    applied += 1;
  }
  return applied;
}

const LEGACY_COLLAPSE_RE = /^\*(?!\*)(.+)\*(?!\*)$/;

export function parseLegacyCollapseMarker(
  rawText: string,
  enabled: boolean
): { rawText: string; collapsed: boolean } {
  const match = enabled ? rawText.match(LEGACY_COLLAPSE_RE) : null;
  return match
    ? { rawText: match[1], collapsed: true }
    : { rawText, collapsed: false };
}
