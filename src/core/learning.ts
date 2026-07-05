import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LEARNING_FILE = '.docsino-learning.json';

interface LearningData {
  overrides: Record<string, string>;
}

export function loadOverrides(root: string): Record<string, string> {
  const file = join(root, LEARNING_FILE);
  if (!existsSync(file)) return {};

  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw) as LearningData;
    return data.overrides ?? {};
  } catch {
    return {};
  }
}

export function saveOverride(root: string, filename: string, feature: string): void {
  const file = join(root, LEARNING_FILE);
  const existing = loadOverrides(root);
  existing[filename] = feature;

  const data: LearningData = { overrides: existing };
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

export function lookupOverride(
  filename: string,
  overrides: Record<string, string>,
): string | null {
  return overrides[filename] ?? null;
}
