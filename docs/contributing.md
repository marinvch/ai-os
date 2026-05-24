# Contributing to AI OS

## Development Setup

```bash
git clone https://github.com/marinvch/ai-os
cd ai-os
npm install
npm run build
npm test
```

## Project Structure

See [docs/architecture.md](architecture.md) for the full component map and data flow.

## Key Commands

```bash
npm run build           # Compile TypeScript
npm test                # Run Vitest suite (548 tests, 42 files)
npm run test:coverage   # Coverage report (thresholds: 60% stmts / 50% branches / 65% fns / 60% lines)
npm run format          # Prettier format all src/**/*.ts files
npm run format:check    # CI Prettier check (non-destructive)
npm run validate:fast   # build + test
npm run validate:full   # build + test + regression
npm run validate:smoke  # Feature health checks
npm run scorecard:check # Verify scorecard KPIs
npm run lint            # ESLint (src/**/*.ts)
npm run lint:fix        # Auto-fix lint issues
npm run ci              # format:check + lint + build + test
```

## Branch Workflow

- Default development branch: `dev`
- **All feature work must be on `feat/*`, `fix/*`, or `docs/*` branches — never commit directly to `dev` or `master`**
- PRs target `dev`
- `master` is the release branch — PRs from `dev` → `master` trigger automated releases

## Testing

- **Framework:** Vitest
- **Test directory:** `src/tests/`
- **Mocking:** Use `vi.mock()` for ESM module mocking
- Coverage is reported with `@vitest/coverage-v8`
- Coverage thresholds: `statements: 60`, `branches: 50`, `functions: 65`, `lines: 60`

All new features should have test coverage in `src/tests/`.

## Code Conventions

- **TypeScript strict mode**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` are all enabled — `arr[i]` has type `T | undefined`; use `arr[i]!` when bounds are guaranteed
- **No `any`** unless at a documented external boundary
- **Prettier** enforced on every commit via lint-staged pre-commit hook (`.prettierrc`: singleQuote, semi, printWidth:100, trailingComma:all, tabWidth:2)
- **ESLint** max-lines rule warns at 500 lines — prefer splitting large files into focused modules
- Prefer `spawnSync(cmd, argsArray)` over `execSync(shellString)` for shell injection prevention
- Use `writeIfChanged()` from `src/generators/utils.ts` for all file writes
- Use `writeFileAtomic()` for writes that must not be partially written
- Prefer early returns (guard clauses) over deep nesting
- No silent fallback for core runtime failures — return explicit diagnostics

## Adding a New Generator

1. Create your generator function in `src/generators/`
2. Import and call it from `src/generate.ts`
3. Add entries to the manifest via `writeManifest()`
4. Add tests in `src/tests/generators-extended.test.ts` or a new test file
5. Run `npm run build && npm test` to verify

## Adding a New MCP Tool

1. Add the tool definition to `MCP_TOOL_DEFINITIONS` in `src/mcp-tools.ts`
2. Implement the handler in `src/mcp-server/utils.ts`
3. Register the tool in `src/mcp-server/tool-definitions.ts`
4. Add stack condition if it's stack-specific (for `strictStackFiltering`)

## Commit Message Format

```
<type>: <description> (#<issue>)
```

Types: `feat`, `fix`, `ci`, `chore`, `docs`, `test`, `refactor`

## Release Process

Releases are fully automated via `.github/workflows/release-automation.yml`. To release:

1. Bump `version` in `package.json` on `dev`
2. Merge `dev` → `master` via PR
3. The release workflow tags and publishes the GitHub Release automatically
4. A follow-up PR bumps `package.json` to the next patch version on `dev`
