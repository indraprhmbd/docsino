# Docsino v0 Build Plan

## Vision
Intelligent documentation organizer. Repository-aware, deterministic, no AI.
Source code is source of truth.

## Tech Stack
- Runtime: Node 22+ (ESM)
- CLI: Commander.js ^15
- Prompts/Spinner: @clack/prompts
- Scoring: okapibm25 (BM25)
- Bundler: tsup
- Output: picocolors
- Testing: vitest
- Lint: biome

## Package Structure
```
docsino/
├── package.json          # type:module, bin: docsino -> dist/cli.js
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── cli/
│   │   ├── index.ts      # program def, --version, --help
│   │   ├── organize.ts   # organize command handler
│   │   └── audit.ts      # audit command handler
│   ├── core/
│   │   ├── scanner.ts    # recursive scan, ignore rules
│   │   ├── classifier.ts # BM25 document classifier
│   │   ├── repository.ts # repo detection (Next.js, React, Vite)
│   │   ├── indexer.ts    # repo index (features, routes, symbols)
│   │   ├── learning.ts   # manual correction store
│   │   └── cache.ts      # .docsino-index.json persistence
│   ├── utils/
│   │   ├── filesystem.ts # file ops
│   │   ├── logger.ts     # colored output
│   │   └── tokenizer.ts  # text tokenization
│   └── config/
│       ├── defaults.ts   # default settings
│       └── schema.ts     # .docsino.json validation
├── test/
│   ├── unit/
│   │   ├── scanner.test.ts
│   │   ├── classifier.test.ts
│   │   ├── repository.test.ts
│   │   └── tokenizer.test.ts
│   └── fixtures/
└── README.md
```

## CLI Interface
```
docsino organize [options]
  --dry-run         Preview only (default: true)
  --dir <path>      Docs directory (default: ./docs)
  --threshold <n>   Confidence % to auto-move (default: 55)
  --verbose         Detailed output

docsino audit [options]
  --dir <path>      Docs directory (default: ./docs)
  --json            JSON output
  --verbose         Detailed output
  --fix             Auto-fix misplaced docs (confidence > threshold)

Global: --version, --help
```

## Data Flow
```
user -> cli/index.ts (Commander.parse)
         -> cli/organize.ts handler
              -> core/repository.ts  (detect project, find features)
              -> core/indexer.ts     (build repo index)
              -> core/scanner.ts     (scan docs/*.md)
              -> core/classifier.ts  (BM25 rank docs vs features)
                   -> utils/tokenizer.ts
                   -> okapibm25
              -> core/learning.ts    (manual overrides)
              -> utils/filesystem.ts (move file)
              -> utils/logger.ts     (output)
```

## Design Decisions
1. DRY_RUN default true - safety first
2. Deterministic only - no AI/embeddings in v0
3. CLI-only in v0 - programmatic API later
4. Incremental indexing - cache to .docsino-index.json
5. Cross-platform - Node path, line endings agnostic

## What's Not In v0
- docsino fix command
- Plugin system
- IDE extension
- Semantic embeddings
- Config file support (CLI flags only)
