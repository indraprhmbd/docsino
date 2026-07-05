const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from',
  'into', 'your', 'have', 'been', 'will', 'they', 'their',
  'there', 'about', 'using', 'used', 'than', 'then', 'when',
  'where', 'which', 'while', 'should', 'could', 'would',
  'into', 'onto', 'also', 'only', 'more', 'less',
  'true', 'false', 'null', 'undefined',
  'const', 'function', 'return', 'import', 'export', 'default',
  'type', 'interface', 'class', 'extends', 'public', 'private',
  'async', 'await', 'props', 'component',
  'react', 'next', 'page', 'layout', 'server', 'client',
  'module',
]);

export function diceTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .split(/[-_.\s]+/)
      .filter(t => t.length > 0)
  );
}

export function diceCoefficient(a: string, b: string): number {
  const setA = diceTokens(a);
  const setB = diceTokens(b);
  const intersection = new Set([...setA].filter(t => setB.has(t)));
  const denom = setA.size + setB.size;
  if (denom === 0) return 0;
  return (2 * intersection.size) / denom;
}

export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

export function tokenizeWithWeights(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const tokens: string[] = [];

  for (const line of lines) {
    const base = tokenize(line);
    tokens.push(...base);

    if (line.startsWith('#')) {
      for (let i = 0; i < 3; i++) tokens.push(...base);
    }

    const codeMatches = line.match(/`[^`]+`/g);
    if (codeMatches) {
      for (const code of codeMatches) {
        tokens.push(...tokenize(code));
        tokens.push(...tokenize(code));
      }
    }

    const importMatch = line.match(/from\s+['"]([^'"]+)['"]/);
    if (importMatch && importMatch[1]) {
      tokens.push(...tokenize(importMatch[1]));
      tokens.push(...tokenize(importMatch[1]));
    }
  }

  const pascalMatches = text.match(/\b[A-Z][A-Za-z0-9]{4,}\b/g);
  if (pascalMatches) {
    for (const w of pascalMatches) {
      tokens.push(...tokenize(w));
      tokens.push(...tokenize(w));
    }
  }

  return tokens;
}
