import { resolve } from 'node:path';

import { buildIndex } from '../core/indexer';
import { classifyDocs } from '../core/classifier';
import { loadCache, saveCache } from '../core/cache';
import { loadOverrides, lookupOverride } from '../core/learning';
import { safeMove } from '../utils/filesystem';
import { logger } from '../utils/logger';
import { resolveDocsDir, resolveThreshold } from '../config/defaults';

interface OrganizeOptions {
  dir?: string;
  threshold?: number;
  dryRun?: boolean;
  verbose?: boolean;
  json?: boolean;
}

export async function organize(options: OrganizeOptions): Promise<void> {
  const root = process.cwd();
  const docsDir = resolve(root, resolveDocsDir(options.dir));
  const threshold = resolveThreshold(options.threshold);
  const dryRun = options.dryRun ?? true;

  if (options.verbose) logger.setLevel('verbose');
  if (options.json) logger.setMode('json');

  logger.info('Building repository index...');

  let index = null;
  const cached = loadCache(root);
  if (cached) {
    index = cached.index;
    logger.verbose('Loaded index from cache');
  } else {
    index = buildIndex(root);
    saveCache(root, index);
    logger.verbose('Index built and cached');
  }

  if (index.features.length === 0) {
    logger.warn('No features detected in repository');
    return;
  }

  logger.verbose(`Features: ${index.features.join(', ')}`);
  logger.info('Scanning documentation...');

  const results = classifyDocs(docsDir, index);
  const overrides = loadOverrides(root);

  let moved = 0;
  let skipped = 0;

  for (const result of results) {
    const override = lookupOverride(result.filename, overrides);

    if (override) {
      logger.info(`${result.filename} -> ${override} (learned)`);
      const target = safeMove(
        resolve(docsDir, result.filename),
        resolve(docsDir, override),
        dryRun,
      );
      if (target) moved++;
      continue;
    }

    logger.verbose(`\n${result.filename}`);
    logger.verbose(`  Winner: ${result.feature} (${result.confidence}%)`);

    if (result.confidence < threshold) {
      logger.verbose(`  LOW CONFIDENCE (${result.confidence} < ${threshold})`);
      skipped++;
      continue;
    }

    const targetDir = resolve(docsDir, result.feature);
    const sourceFile = resolve(docsDir, result.filename);

    const target = safeMove(sourceFile, targetDir, dryRun);

    if (target) {
      moved++;
      const label = dryRun ? 'DRY RUN' : 'MOVE';
      logger.info(`${label}: ${result.filename} -> ${result.feature}/`);
    }
  }

  if (options.json) {
    logger.json({
      moved,
      skipped,
      total: results.length,
    });
    return;
  }

  logger.info(`\nDone. Moved: ${moved}, Skipped: ${skipped}`);
}
