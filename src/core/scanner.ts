import { readdirSync, readFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const IGNORE_DIRS = new Set([
  '.git', '.next', 'node_modules', 'dist', 'build',
  '.turbo', '.vercel', '.idea', '.vscode', 'coverage',
  'public', 'scripts', 'test', 'tests',
]);

interface ScanOptions {
  ignoreDirs?: Set<string>;
}

export interface ScannedFile {
  path: string;
  name: string;
  relativePath: string;
}

export function scanMarkdownFiles(dir: string, options?: ScanOptions): ScannedFile[] {
  const ignore = options?.ignoreDirs ?? IGNORE_DIRS;
  const files: ScannedFile[] = [];

  function walk(current: string): void {
    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          if (ignore.has(entry.name)) continue;
          if (entry.name.startsWith('.')) continue;
          walk(full);
          continue;
        }
        if (extname(entry.name) !== '.md') continue;
        files.push({
          path: full,
          name: entry.name,
          relativePath: relative(dir, full),
        });
      }
    } catch {
      return;
    }
  }

  walk(dir);
  return files;
}

export function readFileContent(filepath: string): string {
  try {
    return readFileSync(filepath, 'utf8');
  } catch {
    return '';
  }
}
