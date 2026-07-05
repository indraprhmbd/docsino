import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
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
    featureTokens: new Map([
      ['auth', ['auth', 'login', 'loginform', 'credential', 'session', 'token', 'password']],
      ['teams', ['teams', 'manage', 'teamcard', 'member', 'workspace', 'role', 'invite']],
      ['documents', ['documents', 'list', 'documentlist', 'file', 'upload', 'share', 'permission']],
    ]),
  };
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('classifyFile', () => {
  it('pre-classifies by filename when feature name is substring', () => {
    const filepath = join(tmpDir, 'auth-doc.md');
    writeFileSync(filepath, 'some content');

    const result = classifyFile(filepath, 'auth-doc.md', index);
    expect(result.feature).toBe('auth');
    expect(result.confidence).toBe(100);
    expect(result.evidence[0]?.token).toBe('filename-dice');
  });

  it('falls to scorer when filename has no feature match', () => {
    const filepath = join(tmpDir, 'random-content.md');
    writeFileSync(filepath, '# Auth guide\nlogin stuff');

    const result = classifyFile(filepath, 'random-content.md', index);
    expect(result.evidence[0]?.token).not.toBe('filename-dice');
  });

  it('picks earliest match when filename has multiple features', () => {
    const filepath = join(tmpDir, 'auth-teams-guide.md');
    writeFileSync(filepath, 'some content');

    const result = classifyFile(filepath, 'auth-teams-guide.md', index);
    expect(result.feature).toBe('auth');
    expect(result.confidence).toBe(100);
  });

  it('classifies a doc to the correct feature via scorer', () => {
    const content = [
      '# Authentication',
      '',
      'Users can log in using their email and password.',
      'The LoginForm component handles form submission.',
      'See `auth/login` for the route implementation.',
    ].join('\n');

    const filepath = join(tmpDir, 'guide.md');
    writeFileSync(filepath, content);

    const result = classifyFile(filepath, 'guide.md', index);
    expect(result.feature).toBe('auth');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.ranking.length).toBeGreaterThanOrEqual(1);
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it('returns uncategorized for empty doc with no filename match', () => {
    const filepath = join(tmpDir, 'unknown.md');
    writeFileSync(filepath, '');

    const result = classifyFile(filepath, 'unknown.md', index);
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
