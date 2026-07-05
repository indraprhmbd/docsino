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
  .description('Auto-classify and move docs into feature folders')
  .option('--dir <path>', 'Documentation directory', './docs')
  .option('--threshold <number>', 'Confidence threshold', '55')
  .option('--apply', 'Actually move files (default: dry-run)')
  .option('--no-interactive', 'Skip interactive prompts')
  .option('--verbose', 'Detailed output')
  .option('--json', 'JSON output')
  .action(async (opts) => {
    try {
      await organize({
        dir: opts.dir,
        threshold: Number(opts.threshold),
        apply: opts.apply,
        verbose: opts.verbose,
        json: opts.json,
        interactive: opts.interactive,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command('audit')
  .description('Check organized docs for misplacements, fix with --fix')
  .option('--dir <path>', 'Documentation directory', './docs')
  .option('--threshold <number>', 'Confidence threshold', '55')
  .option('--fix', 'Auto-fix misplaced documentation')
  .option('--no-interactive', 'Skip interactive prompts')
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
        interactive: opts.interactive,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program.parse();
