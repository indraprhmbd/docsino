import { resolve } from 'node:path';
import { select, intro, outro, isCancel } from '@clack/prompts';

import { buildIndex, resolveFeatureAlias } from '../core/indexer';
import { classifyDocs } from '../core/classifier';
import { loadCache, saveCache } from '../core/cache';
import { loadOverrides, lookupOverride, saveOverride } from '../core/learning';
import { safeMove } from '../utils/filesystem';
import { logger } from '../utils/logger';
import { resolveDocsDir, resolveThreshold } from '../config/defaults';

interface OrganizeOptions {
  dir?: string;
  threshold?: number;
  apply?: boolean;
  verbose?: boolean;
  json?: boolean;
  interactive?: boolean;
}

export async function organize(options: OrganizeOptions): Promise<void> {
  const root = process.cwd();
  const docsDir = resolve(root, resolveDocsDir(options.dir));
  const threshold = resolveThreshold(options.threshold);
  const dryRun = options.apply !== true;
  const interactive = options.interactive !== false;

  if (options.verbose) logger.setLevel('verbose');
  if (options.json) logger.setMode('json');

  logger.info('Building repository index...');

  let index = loadCache(root);
  if (index) {
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

  if (interactive && process.stdin.isTTY) {
    intro('Docsino organize');
  }

  for (const result of results) {
    const override = lookupOverride(result.filename, overrides);

    if (override) {
      const canonicalOverride = resolveFeatureAlias(override, index.featureAliases);
      logger.info(`${result.filename} -> ${canonicalOverride} (learned)`);
      const target = safeMove(
        resolve(docsDir, result.filename),
        resolve(docsDir, canonicalOverride),
        dryRun,
      );
      if (target) moved++;
      continue;
    }

    if (options.verbose) {
      logger.verbose(`\n${result.filename}`);
      for (const ev of result.evidence) {
        logger.verbose(`  ${ev.token}: +${ev.weight}`);
      }
      const top = result.ranking[0];
      if (top) logger.verbose(`  Total: ${top.score}`);
      logger.verbose(`  Winner: ${result.feature} (${result.confidence}%)`);
    }

    if (result.confidence >= threshold) {
      const canonicalFeature = resolveFeatureAlias(result.feature, index.featureAliases);
      const targetDir = resolve(docsDir, canonicalFeature);
      const sourceFile = resolve(docsDir, result.filename);

      const target = safeMove(sourceFile, targetDir, dryRun);

      if (target) {
        moved++;
        const label = dryRun ? 'DRY RUN' : 'MOVE';
        logger.info(`${label}: ${result.filename} -> ${canonicalFeature}/`);
      }
      continue;
    }

    if (interactive && process.stdin.isTTY) {
      const winnerScore = result.ranking[0]?.score ?? 0;
      const secondScore = result.ranking[1]?.score ?? 0;

      const action = await select({
        message: `${result.filename} -> ${result.feature} (${result.confidence}%, score ${winnerScore} vs ${secondScore})`,
        options: [
          { value: 'accept', label: 'Accept' },
          { value: 'edit', label: 'Choose feature' },
          { value: 'skip', label: 'Skip' },
        ],
      });

      if (isCancel(action) || action === 'skip') {
        skipped++;
        continue;
      }

      let targetFeature = result.feature;
      if (action === 'edit') {
        const chosen = await select({
          message: 'Select feature:',
          options: index.features.map(f => ({ value: f, label: f })),
        });
        if (isCancel(chosen)) {
          skipped++;
          continue;
        }
        targetFeature = chosen as string;
      }

      saveOverride(root, result.filename, targetFeature);

      const canonicalTarget = resolveFeatureAlias(targetFeature, index.featureAliases);
      const target = safeMove(
        resolve(docsDir, result.filename),
        resolve(docsDir, canonicalTarget),
        dryRun,
      );
      if (target) moved++;
    } else {
      logger.verbose(`  LOW CONFIDENCE (${result.confidence} < ${threshold})`);
      skipped++;
    }
  }

  if (interactive && process.stdin.isTTY) {
    outro(`Done. Moved: ${moved}, Skipped: ${skipped}`);
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
