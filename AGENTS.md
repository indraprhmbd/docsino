# Docsino AGENTS.md

## Identity
You are building a documentation organizer CLI called Docsino.
This is a personal project by indraprhmbd.
Previous prototype in scripts/docsino/ (CommonJS, no tests, proof-of-concept).
Current project is standalone npm package.

## Coding Rules (FAILURE = BAD)

### No AIisms
- No emojis in code, output, logs, or comments
- No em dashes or en dashes; use hyphen or nothing
- No "under the hood", "under the hood", "leverage", "utilize", "robust", "seamless", "seamlessly", "streamline", "holistic", "empower"
- No overly descriptive comments; comment only when intent is unclear
- No verbose docstrings on every function; short inline comments only
- No `// TODO:`, `// FIXME:`, `// HACK:` unless the task explicitly asks
- No unnecessary abstractions (no factory pattern, no strategy pattern for one implementation)

### Code Style
- TypeScript strict mode, ESM (`import/export`, `type:module`)
- `const` over `let` over `var`
- `function` keyword for module-level functions; arrow for callbacks
- No classes unless clearly justified (most modules export plain functions)
- 2-space indent
- Single quotes for strings
- Semicolons
- Keep files under 300 lines; split if longer
- Avoid `any`; prefer `unknown` + narrow
- No barrel exports (`index.ts` re-exports); import directly from module

### Imports
- `import` only, no `require`
- Group: 1) std/node 2) npm deps 3) local modules. Blank line between groups
- Paths: `./core/scanner` not `./core/scanner.ts`
- Named exports for everything; no default exports

### Error Handling
- No try/catch wrappers around every operation; let errors propagate to CLI handler
- CLI handler catches and prints with `console.error` + exits code 1
- Validate user input at CLI layer, not deep in core

### Output
- Logger uses `picocolors` for color, respects `NO_COLOR` and `--json`
- No chalk, no ink, no ora
- No progress bars in v0

### Commits
- Conventional Commits: `type(scope): message`
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`
- No commit unless user says so

## Architecture Constraints

### Module Dependencies (strict direction)
```
cli/ -> core/ -> utils/
cli/ -> config/
utils/ -> (nothing)
config/ -> (nothing)
core/ -> utils/
core/ -> config/
```
No reverse imports. No circular imports.

### File Layout
```
src/
  cli/        - commander program + command handlers
  core/       - business logic (scanner, classifier, repository, indexer, learning, cache)
  utils/      - filesystem, logger, tokenizer
  config/     - defaults, validation
test/
  unit/       - one test per module
  fixtures/   - fake repo structure for integration tests
```

### Core Contracts (Do Not Change Without Plan Update)
```
RepositoryIndex {
  projectType: string
  features: string[]
  routes: string[]
  symbols: Map<string, string>
}

ClassificationResult {
  filename: string
  feature: string
  confidence: number
  ranking: Array<{ feature: string; score: number }>
  evidence: Array<{ token: string; weight: number }>
}
```

### Dependency Versions (Pinned)
- commander: ^15.0.0 (ESM, Node 22+)
- @clack/prompts: latest
- okapibm25: latest
- picocolors: ^1.1.1
- tsup: latest (dev)
- vitest: latest (dev)
- biome: latest (dev)
- typescript: ^5.8 (dev)

## Build Process
1. `npm run build` -> tsup
2. `npm run test` -> vitest
3. `npm run lint` -> biome check
4. `npm run typecheck` -> tsc --noEmit

## Communication
- Keep answers short, technical, no pleasantries
- No markdown in user-facing tool output (plain text only)
- No explanations of what code does unless asked
- When user asks "what next", suggest next sprint from SPRINTS.md
