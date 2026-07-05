import { resolve } from 'node:path';

import { buildIndex } from '../core/indexer';
import { classifyDocs } from '../core/classifier';
import { loadCache, saveCache } from '../core/cache';
import { scanMarkdownFiles } from '../core/scanner';
import { logger } from '../utils/logger';
import { resolveDocsDir, resolveThreshold } from '../config/defaults';

interface AuditOptions {
  dir?: string;
  threshold?: number;
  verbose?: boolean;
  json?: boolean;
  fix?: boolean;
}

export async function audit(options: AuditOptions): Promise<void> {
  const root = process.cwd();
  const docsDir = resolve(root, resolveDocsDir(options.dir));
  const threshold = resolveThreshold(options.threshold);

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

  logger.info('Auditing documentation...');

  const allFiles = scanMarkdownFiles(docsDir);
  const results = classifyDocs(docsDir, index);

  const misplaced: Array<{ file: string; current: string; suggested: string; confidence: number }> = [];
  const lowConfidence: Array<{ file: string; confidence: number }> = [];
  const orphaned: Array<{ file: string }> = [];

  for (const result of results) {
    const relDir = result.filename.includes('/')
      ? result.filename.split('/')[0]
      : '';

    if (relDir && index.features.includes(relDir) && relDir !== result.feature) {
      misplaced.push({
        file: result.filename,
        current: relDir,
        suggested: result.feature,
        confidence: result.confidence,
      });
    }

    if (result.confidence < threshold) {
      lowConfidence.push({
        file: result.filename,
        confidence: result.confidence,
      });
    }
  }

  for (const f of allFiles) {
    const parts = f.relativePath.split(/[/\\]/);
    if (parts.length > 1 && index.features.includes(parts[0] ?? '')) continue;
    if (parts.length === 1) continue;
    if (f.relativePath.startsWith('uncategorized')) continue;

    const parent = parts[0] ?? '';
    if (parent && !index.features.includes(parent)) {
      orphaned.push({ file: f.relativePath });
    }
  }

  if (options.json) {
    logger.json({
      total: allFiles.length,
      misplaced,
      lowConfidence,
      orphaned,
    });
    return;
  }

  logger.info(`\nAudit Report`);
  logger.info(`Total files: ${allFiles.length}`);

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
