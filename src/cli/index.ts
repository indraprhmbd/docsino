#!/usr/bin/env node

import { Command } from 'commander';

import { organize } from './organize';
import { audit } from './audit';

const program = new Command();

program
  .name('docsino')
  .description('Repository-aware documentation organizer')
  .version('0.0.1');

program
  .command('organize')
  .description('Classify and organize documentation files')
  .option('--dir <path>', 'Documentation directory', './docs')
  .option('--threshold <number>', 'Confidence threshold', '55')
  .option('--no-dry-run', 'Actually move files')
  .option('--verbose', 'Detailed output')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      await organize({
        dir: opts.dir,
        threshold: Number(opts.threshold),
        dryRun: opts.dryRun,
        verbose: opts.verbose,
        json: opts.json,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command('audit')
  .description('Scan documentation tree for issues')
  .option('--dir <path>', 'Documentation directory', './docs')
  .option('--threshold <number>', 'Confidence threshold', '55')
  .option('--fix', 'Auto-fix misplaced documentation')
  .option('--verbose', 'Detailed output')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      await audit({
        dir: opts.dir,
        threshold: Number(opts.threshold),
        verbose: opts.verbose,
        json: opts.json,
        fix: opts.fix,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program.parse();
