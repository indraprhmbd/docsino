# Sprints (Subagent Tasks)

## Sprint A1: Project Scaffolding
set up package, configs, entry point.

- `package.json` with bin, type:module, deps
- `tsconfig.json` (strict, ESM)
- `tsup.config.ts` (single entry: src/cli/index.ts)
- `biome.json`
- `src/cli/index.ts` Commander program with --version, --help
- Verify `npx tsup` builds without error

## Sprint A2: Core - Repository Detection
detect project type and extract features.

- `src/core/repository.ts`
  - Scan package.json dependencies
  - Detect next.config.*, vite.config.*, tsconfig.json
  - Return project type + feature list from route folders / src dirs
- `src/core/indexer.ts`
  - Walk src/ for symbols, imports, route files
  - Build RepositoryIndex
- `src/core/cache.ts`
  - Read/write .docsino-index.json
  - Timestamp-based incremental updates

## Sprint A3: Core — Scanner & Classifier
scan docs and classify against repo index.

- `src/core/scanner.ts`
  - Recursive glob for *.md in docs/
  - Respect IGNORE_DIRS
- `src/utils/tokenizer.ts`
  - Word boundary tokenization
  - Stop word removal, lowercase, min token length
- `src/core/classifier.ts`
  - Tokenize doc content
  - BM25 score against each feature's tokens
  - Calculate confidence from BM25 scores
  - Return Classification result
- `src/core/learning.ts`
  - Read .docsino-learning.json for overrides
  - Write corrections

## Sprint A4: Utils & CLI Commands
wire CLI handlers to core.

- `src/utils/filesystem.ts` safeMove with collision check
- `src/utils/logger.ts` picocolors, verbose/quiet/json modes
- `src/cli/organize.ts` handler calls scanner -> classifier -> mover
- `src/cli/audit.ts` handler calls scanner -> classifier -> reporter
- `src/config/defaults.ts` sensible defaults

## Sprint A5: Polish & Test
hardening.

- `vitest.config.ts`
- Unit tests: scanner, classifier, repository, tokenizer
- Integration test: organize flow with fixture repo
- `biome check` pass
- Verify `docsino organize --help` and `docsino audit --help` work

## Sprint A6: Git & Publish Prep
versioning, changelog, npm publish.

- `.gitignore` (node_modules, dist, .docsino-*)
- Initial commit
- npm publish dry-run
- README.md with install/usage
