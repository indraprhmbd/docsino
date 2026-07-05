import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { RepositoryIndex } from './indexer';

const CACHE_FILE = '.docsino-index.json';

export interface CacheData {
  mtime: number;
  index: RepositoryIndex;
}

export function loadCache(root: string): CacheData | null {
  const file = join(root, CACHE_FILE);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

export function saveCache(root: string, index: RepositoryIndex): void {
  const file = join(root, CACHE_FILE);
  const data: CacheData = {
    mtime: Date.now(),
    index,
  };
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
