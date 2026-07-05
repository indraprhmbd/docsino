import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { detectProjectType } from '../../src/core/repository';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'docsino-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('detectProjectType', () => {
  it('detects nextjs from next.config.js', () => {
    writeFileSync(join(tmpDir, 'next.config.js'), 'module.exports = {}');
    expect(detectProjectType(tmpDir)).toBe('nextjs');
  });

  it('detects nextjs from package.json dependency', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { next: '14.0.0' },
    }));
    expect(detectProjectType(tmpDir)).toBe('nextjs');
  });

  it('detects react-vite from vite.config.ts', () => {
    writeFileSync(join(tmpDir, 'vite.config.ts'), 'export default {}');
    expect(detectProjectType(tmpDir)).toBe('react-vite');
  });

  it('detects react from package.json', () => {
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '18.0.0' },
    }));
    expect(detectProjectType(tmpDir)).toBe('react');
  });

  it('returns unknown for empty dir', () => {
    expect(detectProjectType(tmpDir)).toBe('unknown');
  });
});
