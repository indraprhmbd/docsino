import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { classifyFile } from '../../src/core/classifier';
import type { RepositoryIndex } from '../../src/core/indexer';

let tmpDir: string;
let index: RepositoryIndex;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'docsino-test-'));

  index = {
    projectType: 'nextjs',
    features: ['auth', 'teams', 'documents'],
    routes: ['auth/login', 'teams/manage', 'documents/list'],
    symbols: new Map([
      ['LoginForm', '/src/features/auth/components/LoginForm.tsx'],
      ['TeamCard', '/src/features/teams/components/TeamCard.tsx'],
      ['DocumentList', '/src/features/documents/components/DocumentList.tsx'],
    ]),
  };
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('classifyFile', () => {
  it('classifies a doc to the correct feature', () => {
    const content = [
      '# Authentication',
      '',
      'Users can log in using their email and password.',
      'The LoginForm component handles form submission.',
      'See `app/auth/login` for the route implementation.',
    ].join('\n');

    const filepath = join(tmpDir, 'auth-guide.md');
    writeFileSync(filepath, content);

    const result = classifyFile(filepath, 'auth-guide.md', index);
    expect(result.feature).toBe('auth');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.ranking.length).toBeGreaterThanOrEqual(1);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('returns uncategorized for empty doc', () => {
    const filepath = join(tmpDir, 'empty.md');
    writeFileSync(filepath, '');

    const result = classifyFile(filepath, 'empty.md', index);
    expect(result).toHaveProperty('feature');
    expect(result).toHaveProperty('confidence');
  });

  it('generates ranking with all features', () => {
    const filepath = join(tmpDir, 'test.md');
    writeFileSync(filepath, 'something about teams management');

    const result = classifyFile(filepath, 'test.md', index);
    const featureNames = result.ranking.map((r) => r.feature);
    expect(featureNames).toContain('teams');
  });
});
