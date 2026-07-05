import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProjectType = 'nextjs' | 'react' | 'react-vite' | 'unknown';

export function detectProjectType(root: string): ProjectType {
  const nextFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  for (const f of nextFiles) {
    if (existsSync(join(root, f))) return 'nextjs';
  }

  const viteFiles = ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'];
  for (const f of viteFiles) {
    if (existsSync(join(root, f))) return 'react-vite';
  }

  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return 'unknown';

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps['next']) return 'nextjs';
    if (allDeps['react']) return 'react';
  } catch {
    return 'unknown';
  }

  return 'unknown';
}
