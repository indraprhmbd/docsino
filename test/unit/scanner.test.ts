import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scanMarkdownFiles, readFileContent } from '../../src/core/scanner';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'docsino-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('scanMarkdownFiles', () => {
  it('finds md files in directory', () => {
    writeFileSync(join(tmpDir, 'readme.md'), '# hello');
    writeFileSync(join(tmpDir, 'guide.md'), '# guide');
    writeFileSync(join(tmpDir, 'notes.txt'), 'not markdown');

    const files = scanMarkdownFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name).sort()).toEqual(['guide.md', 'readme.md']);
  });

  it('scans recursively', () => {
    const subDir = join(tmpDir, 'sub');
    mkdirSync(subDir);
    writeFileSync(join(tmpDir, 'root.md'), '# root');
    writeFileSync(join(subDir, 'nested.md'), '# nested');

    const files = scanMarkdownFiles(tmpDir);
    expect(files).toHaveLength(2);
  });

  it('ignores dot dirs and node_modules', () => {
    const gitDir = join(tmpDir, '.git');
    mkdirSync(gitDir);
    writeFileSync(join(gitDir, 'config.md'), '# git');

    const nmDir = join(tmpDir, 'node_modules');
    mkdirSync(nmDir);
    writeFileSync(join(nmDir, 'dep.md'), '# dep');

    writeFileSync(join(tmpDir, 'real.md'), '# real');

    const files = scanMarkdownFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe('real.md');
  });

  it('returns empty for nonexistent directory', () => {
    const files = scanMarkdownFiles(join(tmpDir, 'nope'));
    expect(files).toEqual([]);
  });
});

describe('readFileContent', () => {
  it('reads file content', () => {
    writeFileSync(join(tmpDir, 'test.md'), 'hello world');
    expect(readFileContent(join(tmpDir, 'test.md'))).toBe('hello world');
  });

  it('returns empty for missing file', () => {
    expect(readFileContent(join(tmpDir, 'missing.md'))).toBe('');
  });
});
