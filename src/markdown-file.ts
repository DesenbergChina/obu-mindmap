const LEADING_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export function stripInlineMarkdown(text: string): string {
  const protectedText: string[] = [];
  let sentinel = '\u0000';
  while (text.includes(sentinel)) sentinel += '\u0000';

  const protect = (value: string): string => {
    const index = protectedText.push(value) - 1;
    return sentinel + index + sentinel;
  };

  // Code spans and escaped Markdown punctuation must not be interpreted by the
  // formatting expressions below.
  let result = text.replace(/`([^`\n]+)`/g, (_match: string, code: string) => protect(code));
  result = result.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, (_match, character: string) =>
    protect(character)
  );

  result = result
    .replace(
      /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match: string, target: string, alias: string | undefined) => alias || target
    )
    .replace(/!?\[([^\]]+)\]\((?:[^()]|\([^()]*\))+\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/gi, '$1')
    .replace(/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\/?>/g, '');

  const protectedPattern = new RegExp(sentinel + '(\\d+)' + sentinel, 'g');
  return result
    .replace(protectedPattern, (_match: string, index: string) => protectedText[Number(index)] ?? '')
    .trim();
}

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
