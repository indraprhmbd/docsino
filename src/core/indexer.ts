import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

import type { ProjectType } from './repository';
import { detectProjectType } from './repository';

export interface RepositoryIndex {
  projectType: ProjectType;
  features: string[];
  routes: string[];
  symbols: Map<string, string>;
  featureTokens: Map<string, string[]>;
  featureFreq: Map<string, Map<string, number>>;
  featureTotal: Map<string, number>;
  vocabSize: number;
  featureAliases?: Map<string, string>;
}

const SKIP_DIRS = new Set([
  '.git', '.next', 'node_modules', 'dist', 'build',
  'public', 'docs', 'scripts', 'test', 'tests', 'coverage',
]);

function cleanFeatureName(name: string): string {
  return name.replace(/^\(|\)$/g, '');
}

const NON_FEATURE_DIRS = new Set([
  '@types', 'app', 'src', 'public', 'styles', 'assets', 'images',
  'components', 'elements', 'fragments', 'layouts', 'providers',
  'lib', 'utils', 'hooks', 'db', 'drizzle', 'config', 'scripts',
  'types', 'shared', 'common', 'features',
]);

function walkFilter(name: string): boolean {
  if (name.startsWith('.')) return false;
  if (name.startsWith('_')) return false;
  if (name.startsWith('@')) return false;
  if (name === 'api') return false;
  if (name.includes('[') && name.includes(']')) return false;
  return true;
}

function discoverFeatures(root: string, projectType: ProjectType): string[] {
  const features = new Set<string>();

  if (projectType === 'nextjs') {
    // Primary: src/features/ subdirs (canonical feature structure)
    const srcFeaturesDir = join(root, 'src', 'features');
    if (existsSync(srcFeaturesDir)) {
      for (const entry of readdirSync(srcFeaturesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (NON_FEATURE_DIRS.has(entry.name)) continue;
        features.add(entry.name);
      }
    }

    // Route groups: only (name) dirs are auto-discovered as features
    const appDir = existsSync(join(root, 'src', 'app'))
      ? join(root, 'src', 'app')
      : join(root, 'app');
    if (existsSync(appDir)) {
      // Only route groups (name) are auto-discovered as features.
      // Top-level app/ dirs are NOT features — Next.js conflates feature modules with single pages.
      // Users who want src/features/ granularity should adopt feature-sliced layout.
      function walkApp(dir: string): void {
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            if (!walkFilter(entry.name)) continue;
            if (!entry.name.startsWith('(') || !entry.name.endsWith(')')) continue;

            const cleaned = cleanFeatureName(entry.name);
            if (NON_FEATURE_DIRS.has(cleaned) || cleaned.length === 0) continue;

            features.add(cleaned);
            walkApp(join(dir, entry.name));
          }
        } catch { /* skip unreadable */ }
      }
      walkApp(appDir);
    }
  } else {
    // Non-Next.js: scan src/ and root
    const srcDir = join(root, 'src');
    if (existsSync(srcDir)) {
      for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (NON_FEATURE_DIRS.has(entry.name)) continue;
        features.add(entry.name);
      }
    }

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      if (NON_FEATURE_DIRS.has(entry.name)) continue;
      features.add(entry.name);
    }
  }

  return [...features].sort();
}

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SYMBOL_RE = /export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|async\s+function)\s+(\w+)/g;
const IMPORT_RE = /from\s+['"]([^'"]+)['"]/g;

const FEATURE_TOKEN_CAP = 500;

function findAppDirsForFeature(root: string, feature: string): string[] {
  const dirs: string[] = [];

  function walk(dir: string): void {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (!walkFilter(entry.name)) continue;
        const full = join(dir, entry.name);
        const cleaned = cleanFeatureName(entry.name);
        if (cleaned === feature) {
          dirs.push(full);
        }
        if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
          walk(full);
        }
      }
    } catch { /* skip */ }
  }

  const appDir = existsSync(join(root, 'src', 'app'))
    ? join(root, 'src', 'app')
    : join(root, 'app');
  if (existsSync(appDir)) walk(appDir);

  return dirs;
}

interface FeatureTokenData {
  featureTokens: Map<string, string[]>;
  featureFreq: Map<string, Map<string, number>>;
  featureTotal: Map<string, number>;
  vocabSize: number;
}

function extractFeatureTokens(root: string, features: string[]): FeatureTokenData {
  const featureFreq = new Map<string, Map<string, number>>();
  const featureTotal = new Map<string, number>();
  const allTokens = new Set<string>();

  for (const feature of features) {
    const freq = new Map<string, number>();
    freq.set(feature.toLowerCase(), 1);
    let total = 1;

    const srcFeatureDir = join(root, 'src', 'features', feature);
    if (existsSync(srcFeatureDir)) total += walkDirFreq(srcFeatureDir, freq);

    for (const appDir of findAppDirsForFeature(root, feature)) {
      total += walkDirFreq(appDir, freq);
    }

    const srcDir = join(root, 'src', feature);
    if (existsSync(srcDir)) total += walkDirFreq(srcDir, freq);

    const rootDir = join(root, feature);
    if (existsSync(rootDir) && statSync(rootDir).isDirectory()) {
      total += walkDirFreq(rootDir, freq);
    }

    featureFreq.set(feature, freq);
    featureTotal.set(feature, total);
    for (const t of freq.keys()) allTokens.add(t);
  }

  const vocabSize = allTokens.size;
  const featureTokens = new Map<string, string[]>();
  for (const [feature, freq] of featureFreq) {
    const tokens = [...freq.keys()].slice(0, FEATURE_TOKEN_CAP);
    featureTokens.set(feature, tokens);
  }

  return { featureTokens, featureFreq, featureTotal, vocabSize };
}

function walkDirFreq(dir: string, freq: Map<string, number>): number {
  let total = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;
        total += walkDirFreq(full, freq);
        continue;
      }

      const ext = extname(entry.name);
      if (!SOURCE_EXTS.has(ext)) continue;

      const nameNoExt = basename(entry.name, ext);
      for (const t of nameNoExt.split(/[-_.]/)) {
        if (t.length > 2) {
          const lower = t.toLowerCase();
          freq.set(lower, (freq.get(lower) ?? 0) + 1);
          total++;
        }
      }

      try {
        const content = readFileSync(full, 'utf8');

        let symMatch: RegExpExecArray | null;
        SYMBOL_RE.lastIndex = 0;
        while ((symMatch = SYMBOL_RE.exec(content)) !== null) {
          if (symMatch[1] !== undefined) {
            const lower = symMatch[1].toLowerCase();
            freq.set(lower, (freq.get(lower) ?? 0) + 1);
            total++;
          }
        }

        let impMatch: RegExpExecArray | null;
        IMPORT_RE.lastIndex = 0;
        while ((impMatch = IMPORT_RE.exec(content)) !== null) {
          if (impMatch[1] !== undefined) {
            const parts = impMatch[1].split(/[/\\]/);
            for (const p of parts) {
              if (p.length > 2 && p !== '.') {
                const lower = p.toLowerCase();
                freq.set(lower, (freq.get(lower) ?? 0) + 1);
                total++;
              }
            }
          }
        }

        const pascals = content.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
        if (pascals) {
          for (const p of pascals) {
            if (p.length > 2) {
              const lower = p.toLowerCase();
              freq.set(lower, (freq.get(lower) ?? 0) + 1);
              total++;
            }
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    return total;
  }
  return total;
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
        if (entry.name.startsWith('@')) continue;
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

export function dedupePluralAliases(features: string[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const sorted = [...features].sort((a, b) => a.length - b.length);

  for (let i = 0; i < sorted.length; i++) {
    const short = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const long = sorted[j]!;
      if (long === short + 's' || long === short + 'es') {
        aliases.set(short, long);
        break;
      }
    }
  }

  return aliases;
}

export function resolveFeatureAlias(name: string, aliases?: Map<string, string>): string {
  if (!aliases) return name;
  return aliases.get(name) ?? name;
}

export function buildIndex(root: string): RepositoryIndex {
  const projectType = detectProjectType(root);
  const features = discoverFeatures(root, projectType);
  const routes = discoverRoutes(root, projectType);
  const symbols = discoverSymbols(root);
  const tokenData = extractFeatureTokens(root, features);
  const featureAliases = dedupePluralAliases(features);

  return {
    projectType,
    features,
    routes,
    symbols,
    featureTokens: tokenData.featureTokens,
    featureFreq: tokenData.featureFreq,
    featureTotal: tokenData.featureTotal,
    vocabSize: tokenData.vocabSize,
    featureAliases,
  };
}
