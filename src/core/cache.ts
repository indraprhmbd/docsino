import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { RepositoryIndex } from './indexer';

const CACHE_FILE = '.docsino-index.json';

interface SerializedIndex {
  projectType: string;
  features: string[];
  routes: string[];
  symbols: Array<[string, string]>;
  featureTokens: Array<[string, string[]]>;
  featureAliases: Array<[string, string]>;
  featureFreq: Array<[string, Array<[string, number]>]>;
  featureTotal: Array<[string, number]>;
  vocabSize: number;
}

interface CacheDataSerialized {
  mtime: number;
  index: SerializedIndex;
}

function serialize(index: RepositoryIndex): SerializedIndex {
  const freqEntries: Array<[string, Array<[string, number]>]> = [];
  for (const [feature, freq] of index.featureFreq) {
    freqEntries.push([feature, [...freq.entries()]]);
  }

  return {
    projectType: index.projectType,
    features: index.features,
    routes: index.routes,
    symbols: Array.from(index.symbols.entries()),
    featureTokens: Array.from(index.featureTokens?.entries() ?? []),
    featureAliases: Array.from(index.featureAliases?.entries() ?? []),
    featureFreq: freqEntries,
    featureTotal: Array.from(index.featureTotal?.entries() ?? []),
    vocabSize: index.vocabSize,
  };
}

function deserialize(data: SerializedIndex): RepositoryIndex {
  const aliases = data.featureAliases?.length ? new Map(data.featureAliases) : undefined;
  const featureFreq = new Map<string, Map<string, number>>();
  for (const [feature, entries] of data.featureFreq ?? []) {
    featureFreq.set(feature, new Map(entries));
  }

  return {
    projectType: data.projectType as RepositoryIndex['projectType'],
    features: data.features,
    routes: data.routes,
    symbols: new Map(data.symbols),
    featureTokens: new Map(data.featureTokens ?? []),
    featureAliases: aliases,
    featureFreq,
    featureTotal: new Map(data.featureTotal ?? []),
    vocabSize: data.vocabSize ?? 0,
  };
}

export function loadCache(root: string): RepositoryIndex | null {
  const file = join(root, CACHE_FILE);
  if (!existsSync(file)) return null;

  try {
    const raw = readFileSync(file, 'utf8');
    const data = JSON.parse(raw) as CacheDataSerialized;
    return deserialize(data.index);
  } catch {
    return null;
  }
}

export function saveCache(root: string, index: RepositoryIndex): void {
  const file = join(root, CACHE_FILE);
  const data: CacheDataSerialized = {
    mtime: Date.now(),
    index: serialize(index),
  };
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
