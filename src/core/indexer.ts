import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ProjectType } from './repository';
import { detectProjectType } from './repository';

export interface RepositoryIndex {
  projectType: ProjectType;
  features: string[];
  routes: string[];
  symbols: Map<string, string>;
}

const SKIP_DIRS = new Set([
  '.git', '.next', 'node_modules', 'dist', 'build',
  'public', 'docs', 'scripts', 'test', 'tests', 'coverage',
]);

function discoverFeatures(root: string, projectType: ProjectType): string[] {
  const features: string[] = [];

  let searchDirs: string[] = [];

  if (projectType === 'nextjs') {
    const appDir = join(root, 'app');
    if (existsSync(appDir)) searchDirs.push(appDir);

    const srcAppDir = join(root, 'src', 'app');
    if (existsSync(srcAppDir)) searchDirs.push(srcAppDir);
  }

  const srcDir = join(root, 'src');
  if (existsSync(srcDir)) searchDirs.push(srcDir);

  for (const dir of searchDirs) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name.startsWith('_')) continue;
        if (entry.name === 'api') continue;
        if (!features.includes(entry.name)) {
          features.push(entry.name);
        }
      }
    } catch {
      continue;
    }
  }

  const rootEntries = readdirSync(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (!features.includes(entry.name)) {
      features.push(entry.name);
    }
  }

  return features.sort();
}

function discoverRoutes(root: string, projectType: ProjectType): string[] {
  const routes: string[] = [];

  if (projectType !== 'nextjs') return routes;

  const appDir = existsSync(join(root, 'app'))
    ? join(root, 'app')
    : join(root, 'src', 'app');

  if (!existsSync(appDir)) return routes;

  function walk(dir: string, prefix: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name.startsWith('_')) continue;
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          walk(join(dir, entry.name), prefix);
          continue;
        }
        const route = prefix ? `${prefix}/${entry.name}` : entry.name;
        routes.push(route);
        walk(join(dir, entry.name), route);
      }
    } catch {
      return;
    }
  }

  walk(appDir, '');
  return routes;
}

function discoverSymbols(root: string): Map<string, string> {
  const symbols = new Map<string, string>();

  const srcDir = join(root, 'src');
  if (!existsSync(srcDir)) return symbols;

  function walk(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) continue;
          if (entry.name === 'node_modules') continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        try {
          const content = readFileSync(full, 'utf8');
          const re = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|async\s+function)\s+(\w+)/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            const name = m[1];
            if (name && !symbols.has(name)) {
              const relPath = full.replace(root, '').replace(/\\/g, '/');
              symbols.set(name, relPath);
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }

  walk(srcDir);
  return symbols;
}

export function buildIndex(root: string): RepositoryIndex {
  const projectType = detectProjectType(root);
  const features = discoverFeatures(root, projectType);
  const routes = discoverRoutes(root, projectType);
  const symbols = discoverSymbols(root);

  return {
    projectType,
    features,
    routes,
    symbols,
  };
}
