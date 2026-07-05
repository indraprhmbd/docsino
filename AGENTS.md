# Docsino

Documentation organizer for Next.js projects. Organizes markdown docs into `docs/<feature>/` directories based on what they document.

## Code Style

- TypeScript strict mode, ESM (`type:module`)
- `const` over `let` over `var`
- `function` keyword for module-level; arrow for callbacks
- No classes unless clearly justified
- 2-space indent, single quotes, semicolons
- Files under 300 lines
- Avoid `any`; prefer `unknown` + narrow
- Named exports only; no default exports
- No barrel exports (`index.ts` re-exports)

## Imports

Group: 1) std/node 2) npm deps 3) local modules. Blank line between groups.
Paths without `.ts` extension: `./core/scanner`.

## Module Dependencies

```
cli/ -> core/ -> utils/
cli/ -> config/
core/ -> utils/
core/ -> config/
```

## Build Process

1. `npm run build` -> tsup
2. `npm run test` -> vitest
3. `npm run lint` -> biome check
4. `npm run typecheck` -> tsc --noEmit

## Commits

Conventional Commits: `type(scope): message`. Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
