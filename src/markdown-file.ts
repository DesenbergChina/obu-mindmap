const LEADING_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export function stripLeadingFrontmatter(content: string): string {
  return content.replace(LEADING_FRONTMATTER_RE, '');
}

export function nextCleanMarkdownPath(
  sourcePath: string,
  exists: (candidate: string) => boolean
): string {
  const slashIndex = sourcePath.lastIndexOf('/');
  const directory = slashIndex >= 0 ? sourcePath.slice(0, slashIndex + 1) : '';
  const fileName = slashIndex >= 0 ? sourcePath.slice(slashIndex + 1) : sourcePath;
  const baseName = fileName.replace(/\.md$/i, '');
  let candidate = directory + baseName + '-clean.md';
  let suffix = 2;
  while (exists(candidate)) {
    candidate = directory + baseName + '-clean-' + suffix + '.md';
    suffix += 1;
  }
  return candidate;
}
