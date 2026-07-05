# Architecture

## Layer Diagram
```
┌─────────────┐
│   CLI Layer  │  Commander.js subcommands
├─────────────┤
│  Core Layer  │  Scanner, Classifier, Repository, Indexer
├─────────────┤
│  Util Layer  │  Filesystem, Logger, Tokenizer
├─────────────┤
│   Config     │  Defaults, Schema
└─────────────┘
```

## Module Responsibilities

### CLI Layer
- **index.ts**: Define program, register commands, parse argv
- **organize.ts**: Orchestrate organize flow (scan -> classify -> move)
- **audit.ts**: Orchestrate audit flow (scan -> classify -> report)

### Core Layer
- **scanner.ts**: Recursive directory walk, gitignore-aware, file type filter
- **classifier.ts**: BM25 scoring, confidence calculation, ranking
- **repository.ts**: Detect project type (Next.js, React, Vite), extract features
- **indexer.ts**: Build repository index from source code signals
- **learning.ts**: Read/write manual classification overrides
- **cache.ts**: Persist/load .docsino-index.json for incremental runs

### Util Layer
- **filesystem.ts**: safeMove, copy, ensureDir, path helpers
- **logger.ts**: picocolors output, level-based (verbose/quiet), JSON mode
- **tokenizer.ts**: Word boundary tokenization, stemming, stop word removal

## Key Contracts
```
RepositoryIndex {
  projectType: 'nextjs' | 'react' | 'react-vite' | 'unknown'
  features: Feature[]          // detected feature folders
  routes: Route[]              // app routes
  symbols: Map<string, Symbol> // exported symbols across codebase
}

Classification {
  filename: string
  feature: string              // winning feature
  confidence: number           // 0-100
  ranking: { feature: string; score: number }[]
  evidence: { token: string; weight: number }[]
}
```
