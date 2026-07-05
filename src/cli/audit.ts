import { resolve } from 'node:path';
import { select, intro, outro, isCancel } from '@clack/prompts';

import { buildIndex, resolveFeatureAlias } from '../core/indexer';
import { classifyAllDocs } from '../core/classifier';
import { loadCache, saveCache } from '../core/cache';
import { loadOverrides, lookupOverride, saveOverride } from '../core/learning';
import { safeMove } from '../utils/filesystem';
import { logger } from '../utils/logger';
import { resolveDocsDir, resolveThreshold } from '../config/defaults';

interface AuditOptions {
  dir?: string;
  threshold?: number;
  verbose?: boolean;
  json?: boolean;
  fix?: boolean;
  interactive?: boolean;
}

export async function audit(options: AuditOptions): Promise<void> {
  const root = process.cwd();
  const docsDir = resolve(root, resolveDocsDir(options.dir));
  const threshold = resolveThreshold(options.threshold);
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

  logger.info('Auditing documentation...');

  const results = classifyAllDocs(docsDir, index);
  const overrides = loadOverrides(root);

  const misplaced: Array<{ file: string; current: string; suggested: string; confidence: number }> = [];
  const lowConfidence: Array<{ file: string; confidence: number; feature: string }> = [];
  const orphaned: Array<{ file: string }> = [];

  let fixed = 0;

  if (options.verbose) {
    logger.verbose(`\nScanned ${results.length} files`);
  }

  if (interactive && process.stdin.isTTY) {
    intro('Docsino audit');
  }

  for (const result of results) {
    const rp = result.relativePath;
    const parts = rp.split(/[/\\]/);
    const currentDir = parts.length > 1 ? (parts[0] ?? '') : '';

    const override = lookupOverride(result.filename, overrides);

    if (currentDir && index.features.includes(currentDir)) {
      const canonicalCurrent = resolveFeatureAlias(currentDir, index.featureAliases);
      const canonicalResult = resolveFeatureAlias(result.feature, index.featureAliases);

      if (canonicalCurrent === canonicalResult) {
        if (options.verbose) {
          logger.verbose(`  ${rp} -> ${canonicalCurrent}/ (correct)`);
        }
        continue;
      }

      const targetFeature = override ?? result.feature;

      if (resolveFeatureAlias(targetFeature, index.featureAliases) === canonicalCurrent) {
        if (options.verbose) {
          logger.verbose(`  ${rp} -> ${currentDir}/ (overridden)`);
        }
        continue;
      }

      misplaced.push({
        file: rp,
        current: currentDir,
        suggested: targetFeature,
        confidence: result.confidence,
      });

      if (options.fix) {
        const src = resolve(docsDir, rp);
        const canonicalTarget = resolveFeatureAlias(targetFeature, index.featureAliases);
        const tgtDir = resolve(docsDir, canonicalTarget);
        const target = safeMove(src, tgtDir, false);
        if (target) {
          fixed++;
          logger.info(`${rp} -> ${canonicalTarget}/ (fixed)`);
        }
      }
      continue;
    }

    if (result.confidence < threshold) {
      lowConfidence.push({
        file: rp,
        confidence: result.confidence,
        feature: result.feature,
      });

      if (options.fix && interactive && process.stdin.isTTY) {
        const action = await select({
          message: `${rp} -> ${result.feature} (${result.confidence}%)`,
          options: [
            { value: 'accept', label: 'Accept' },
            { value: 'edit', label: 'Choose feature' },
            { value: 'skip', label: 'Skip' },
          ],
        });

        if (isCancel(action) || action === 'skip') continue;

        let targetFeature = result.feature;
        if (action === 'edit') {
          const chosen = await select({
            message: 'Select feature:',
            options: index.features.map(f => ({ value: f, label: f })),
          });
          if (isCancel(chosen)) continue;
          targetFeature = chosen as string;
        }

        saveOverride(root, result.filename, targetFeature);

        const canonicalInteractive = resolveFeatureAlias(targetFeature, index.featureAliases);
        const target = safeMove(
          resolve(docsDir, rp),
          resolve(docsDir, canonicalInteractive),
          false,
        );
        if (target) {
          fixed++;
          logger.info(`${rp} -> ${canonicalInteractive}/ (fixed)`);
        }
      }
      continue;
    }

    if (currentDir && !index.features.includes(currentDir)) {
      orphaned.push({ file: rp });

      if (options.fix && result.confidence >= threshold) {
        const canonicalOrphan = resolveFeatureAlias(result.feature, index.featureAliases);
        const target = safeMove(
          resolve(docsDir, rp),
          resolve(docsDir, canonicalOrphan),
          false,
        );
        if (target) {
          fixed++;
          logger.info(`${rp} -> ${canonicalOrphan}/ (fixed)`);
        }
      }
    }

    if (options.verbose && currentDir && currentDir === result.feature) {
      const canonicalVerbose = resolveFeatureAlias(result.feature, index.featureAliases);
      logger.verbose(`  ${rp} -> ${canonicalVerbose}/ (correct)`);
    }
  }

  if (interactive && process.stdin.isTTY) {
    outro(`Done. Fixed: ${fixed}, Total: ${results.length}`);
  }

  if (options.json) {
    logger.json({
      total: results.length,
      misplaced,
      lowConfidence,
      orphaned,
      fixed,
    });
    return;
  }

  logger.info(`\nAudit Report`);
  logger.info(`Total files: ${results.length}`);

  if (fixed > 0) {
    logger.success(`Fixed: ${fixed}`);
  }

  if (misplaced.length > 0) {
    logger.warn(`\nMisplaced (${misplaced.length}):`);
    for (const m of misplaced) {
      logger.warn(`  ${m.file} is in ${m.current}/, should be in ${m.suggested}/ (${m.confidence}%)`);
    }
  }

  if (lowConfidence.length > 0) {
    logger.warn(`\nLow confidence (${lowConfidence.length}):`);
    for (const l of lowConfidence) {
      logger.warn(`  ${l.file} (${l.confidence}%)`);
    }
  }

  if (orphaned.length > 0) {
    logger.warn(`\nOrphaned (${orphaned.length}):`);
    for (const o of orphaned) {
      logger.warn(`  ${o.file}`);
    }
  }

  if (misplaced.length === 0 && lowConfidence.length === 0 && orphaned.length === 0) {
    logger.success('No issues found.');
  }
}
