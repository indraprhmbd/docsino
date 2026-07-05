docsino

Organize docs/ by feature, not by accident.

Documentation organizer for Next.js projects. Reads markdown files, analyzes them against your project's feature structure, and moves them into `docs/<feature>/` directories. Currently optimized for Next.js App Router.

[![npm version](https://img.shields.io/npm/v/docsino?style=flat&color=blue)](https://www.npmjs.com/package/docsino)
[![License](https://img.shields.io/github/license/indraprhmbd/docsino?style=flat&color=green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen?style=flat)](package.json)

---

Contents

- [What it does](#what-it-does)
- [When to use it](#when-to-use-it)
- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
- [How classification works](#how-classification-works)
- [Limitations (read this)](#limitations-read-this)
- [Why this approach](#why-this-approach)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Alternatives](#alternatives)
- [Contributing](#contributing)
- [License](#license)

---

## What it does

Your Next.js project has markdown files for every feature: PRDs, API specs, architecture decisions, sprint plans. All in one `docs/` directory. Over time, nobody knows which doc belongs to which feature.

docsino discovers features from your codebase (`src/features/`, route groups), then classifies each markdown file into its matching feature directory based on filename and content.

Project features (auto-discovered):
- `src/features/competition/` -> feature: `competition`
- `app/(auth)/` -> feature: `auth`
- `app/(api)/` -> feature: `api`

```
before:                          after:
docs/                            docs/
  COMPETITION-FLOW-PLAN.md        competition/
  AUTH-STRATEGY.md                  COMPETITION-FLOW-PLAN.md
  DEPLOY-RUNBOOK.md               auth/
  API-REFERENCE.md                  AUTH-STRATEGY.md
  SALES-OVERVIEW.md               api/
                                    API-REFERENCE.md
                                  deploy/
                                    DEPLOY-RUNBOOK.md
                                  SALES-OVERVIEW.md
```

Files matching discovered features get organized. Files with no matching feature (like `SALES-OVERVIEW.md` when `sales` is not a discovered feature) stay in place.

---

## When to use it

- You have a Next.js project with 10+ markdown files in one directory
- You want feature-based organization (`docs/competition/`, `docs/auth/`) but dont want to sort by hand
- Your team puts docs in one place but cannot maintain the structure
- You need a reproducible way to organize docs across multiple projects

Not for you if: you have 3 markdown files, you use a dedicated documentation platform (Notion, GitBook), or you want an AI that writes docs for you.

---

## Install

```bash
npm install -g docsino
```

Requires Node.js 22.12 or later.

---

## Quick start

```bash
cd your-nextjs-project

# 1. See what docsino finds
docsino audit

# 2. Preview what would happen (dry run)
docsino organize

# 3. Actually organize docs
docsino organize --apply
```

---

## Commands

### docsino organize

Auto-classify and move markdown files into feature folders.

| Option | Description | Default |
|--------|-------------|---------|
| `--dir <path>` | Documentation directory to scan | `./docs` |
| `--threshold <number>` | Confidence threshold (0-100) | `55` |
| `--apply` | Actually move files | dry-run mode |
| `--no-interactive` | Skip confirmation prompts | interactive |
| `--verbose` | Show per-file classification details | off |
| `--json` | Output as JSON | off |

### docsino audit

Check already-organized docs for misplacements.

| Option | Description | Default |
|--------|-------------|---------|
| `--dir <path>` | Documentation directory | `./docs` |
| `--threshold <number>` | Confidence threshold | `55` |
| `--fix` | Auto-fix misplaced files | audit only |
| `--no-interactive` | Skip confirmation | interactive |
| `--verbose` | Detailed output | off |
| `--json` | JSON output | off |

---

## How classification works

Two-pass classification system. Deterministic, no external API calls, no training data.

### Pass 1: Dice coefficient (filename)

Compares filename tokens (split on hyphens, underscores, camelCase) against feature names using the Sorensen-Dice coefficient. Dice coefficient measures set overlap: `2 * |intersection| / (|a| + |b|)`.

Example: `COMPETITION-FLOW-PLAN.md` splits to `["competition", "flow", "plan"]`. Feature `competition` has tokens `["competition"]`. Intersection = 1, total = 4. Dice = 2*1/4 = 0.5. Above the 0.3 threshold, so auto-classified as `competition` with 100% confidence.

If multiple features match at Dice >= 0.3, the earliest position wins. If tied, shortest feature name wins.

### Pass 2: Naive Bayes (content)

For files that pass 1 cannot classify confidently, docsino applies a Naive Bayes classifier with additive (Laplace) smoothing.

Each feature has a token frequency map built from:
- File names in the feature's source directory
- Exported symbols (function names, component names)
- Import paths (relative module references)
- PascalCase identifiers in source files

P(doc | feature) is calculated using Bayes' theorem. Scores are compared across features in log-probability space to avoid floating-point underflow.

Confidence = (top match count - second match count) / top match count * 100, where "match count" is how many document tokens appear in the feature's frequency map.

### Feature discovery

docsino finds features from three sources:

1. **src/features/<name>/** -- canonical feature-sliced structure. Always a feature.
2. **app/(<name>)/** -- Next.js route groups. Always a feature.
3. Other top-level `app/` directories are NOT auto-discovered (see limitations).

---

## Limitations (read this)

This tool is a v0 prototype. It works on some projects and fails on others. Here is what you should know.

### Classification limits

The Naive Bayes classifier compares document vocabulary against source-code vocabulary. These two vocabularies have low overlap. A doc about "competition lifecycle architecture" uses tokens like "lifecycle" and "architecture" that rarely appear in source code. When most doc tokens are unseen in the feature corpus, the Laplace smoothing term dominates all scores, producing near-identical confidence values for every feature.

This means:
- Pass 1 (Dice on filename) is reliable for obvious filenames like `COMPETITION-*.md`.
- Pass 2 (Naive Bayes on content) has low effective accuracy on most real-world docs.
- Confidence values near 0% indicate the classifier is guessing. The tool still works -- it falls back to prompting the user for ambiguous files.

### Feature discovery limits

docsino was designed for feature-sliced architectures (src/features/). If your project does not use this pattern, feature auto-discovery is limited:

- Route groups `app/(group)/` are reliably detected as features.
- Flat top-level directories in `app/` (like `app/competitions/`, `app/registration-closed/`) are NOT auto-discovered. Next.js conflates feature modules with single page routes, and there is no reliable algorithmic way to distinguish them.

Workaround: restructure your project to use route groups or src/features/, or accept that some features will need to be manually designated.

### Scope limits

- Does not write documentation. Only organizes existing markdown files.
- Single-user CLI tool. No collaboration, no web UI, no server.
- Currently optimized for Next.js App Router. Other frameworks use a generic src/ scanner with limited accuracy.
- No TypeScript/JavaScript doc string extraction or API documentation generation.
- No support for images, assets, or binary files alongside markdown.

---

## Why this approach

Two alternatives exist for doc organization, and both were rejected:

**LLM classification** (Claude/GPT) -- would be more accurate but requires API keys, costs money per doc, is slow for large projects, and introduces non-determinism. Not suitable for a CLI tool that should work offline.

**Manual organization** -- most accurate but does not scale. For projects with 50+ docs, no one maintains the structure. docsino is the middle ground: automated enough to handle the obvious cases, interactive enough to ask when unsure.

The two-pass design (Dice + Naive Bayes) was chosen because it is deterministic, has zero external dependencies, and works offline. The algorithms are transparent and debuggable -- you can trace exactly why a file was classified a certain way.

---

## Architecture

```
src/
  cli/        - Commander.js program + command handlers
    index.ts    Entry point
    organize.ts Organize command
    audit.ts    Audit command
  core/       - Business logic
    scanner.ts  Markdown file discovery
    classifier.ts  Two-pass classification
    indexer.ts  Feature discovery + token extraction
    cache.ts    Index persistence
    repository.ts  Next.js project detection
  utils/      - Helpers
    tokenizer.ts  Dice coefficient, token splitting
    logger.ts     picocolors logger
test/
  unit/       - One test per module
```

Dependency direction: `cli/ -> core/ -> utils/`. No reverse imports.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22+ (ESM) |
| CLI framework | Commander.js |
| Build | tsup |
| Tests | vitest |
| Linting | Biome |
| Classification | Dice coefficient + Naive Bayes |
| No external AI APIs | By design |

---

## Alternatives

| Tool | Approach | Difference |
|------|----------|------------|
| GitBook, Notion | Hosted documentation platforms | Web-based, collaborative, not codebase-aware |
| Docusaurus | Documentation site generator | Builds a site from docs, does not organize them |
| MKDocs, Sphinx | Documentation generators | Python-based, require config, not Next.js aware |
| Manual sorting | Human decision | Most accurate, does not scale |

docsino fills the gap: it lives in your repo, understands your code structure, and enforces a consistent doc layout without human effort on every file.

---

## Contributing

Issues and pull requests welcome. See [AGENTS.md](AGENTS.md) for code style and conventions.

```bash
git clone https://github.com/indraprhmbd/docsino
cd docsino
npm install
npm run build
npm run test
```

---

## License

MIT. See [LICENSE](LICENSE).
