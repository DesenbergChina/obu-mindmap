const LEADING_FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export function stripInlineMarkdown(text: string): string {
  const protectedText: string[] = [];
  let sentinel = '\u0000';
  while (text.includes(sentinel)) sentinel += '\u0000';

  const protect = (value: string): string => {
    const index = protectedText.push(value) - 1;
    return sentinel + index + sentinel;
  };

  // Scan these constructs together so an escaped backtick cannot open a code
  // span and backslashes inside a code span retain their literal meaning.
  let result = '';
  for (let index = 0; index < text.length; ) {
    if (text[index] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/.test(text[index + 1] || '')) {
      result += protect(text[index + 1]);
      index += 2;
      continue;
    }
    if (text[index] === '`') {
      let runEnd = index + 1;
      while (text[runEnd] === '`') runEnd += 1;
      const delimiter = text.slice(index, runEnd);
      let closingIndex = text.indexOf(delimiter, runEnd);
      while (
        closingIndex >= 0 &&
        (text[closingIndex - 1] === '`' || text[closingIndex + delimiter.length] === '`')
      ) {
        closingIndex = text.indexOf(delimiter, closingIndex + delimiter.length);
      }
      if (closingIndex >= 0) {
        result += protect(text.slice(runEnd, closingIndex));
        index = closingIndex + delimiter.length;
        continue;
      }
      result += delimiter;
      index = runEnd;
      continue;
    }
    result += text[index];
    index += 1;
  }

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
