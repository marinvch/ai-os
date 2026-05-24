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
npm test                # Run Vitest suite
npm run test:coverage   # Coverage report (threshold: 40%)
npm run validate:fast   # build + test
npm run validate:full   # build + test + regression
npm run validate:smoke  # Feature health checks
npm run scorecard:check # Verify scorecard KPIs
npm run lint            # ESLint (src/**/*.ts)
npm run lint:fix        # Auto-fix lint issues
```

## Branch Workflow

- Default development branch: `dev`
- PRs target `dev`
- `master` is the release branch — PRs from `dev` → `master` trigger automated releases

## Testing

- **Framework:** Vitest
- **Test directory:** `src/tests/`
- **Mocking:** Use `vi.mock()` for ESM module mocking
- Coverage is reported with `@vitest/coverage-v8`

All new features should have test coverage in `src/tests/`.

## Code Conventions

- TypeScript strict mode, no `any` unless at a documented boundary
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

## Template System (Two-Layer Architecture)

AI OS has two layers of templates — understanding the distinction prevents editing the wrong copy:

| Layer | Location | Purpose |
|-------|---------|---------|
| **Source templates** | `src/templates/` | The authoritative templates shipped inside AI OS. Compiled into the bundle. Edit these to change AI OS defaults. |
| **Deployed context** | `.github/ai-os/context/templates/` | Copies deployed into the target repository. Auto-overwritten on `--refresh-existing`. **Do not edit these** — changes will be lost on the next refresh. |

**Rule:** Always edit templates in `src/templates/`. Changes there flow through to all target repos on next refresh.

**User overrides** (per-repo customization) go in `.github/ai-os/templates/<type>/<name>.md` — these are checked before falling back to built-in templates and are preserved across refreshes.

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

## Repository Structure

| Path | Purpose |
|------|---------|
| `src/` | TypeScript source — generators, detectors, MCP server, CLI |
| `bundle/` | Pre-built distribution bundles committed for `npx` installs (see `bundle/README.md`) |
| `docs/` | Product documentation (architecture, CLI reference, guides) |
| `docs/audit/` | Historical audit artifacts from May 2026 — preserved as contributor reference |
| `examples/` | Sample repo structures used for snapshot tests |
| `tools/skill-creator/` | Meta-tool for building and evaluating AI OS skills |
| `.superpowers/` | Ephemeral brainstorming and session artifacts (gitignored) |

## Install Scripts

AI OS ships two install scripts with distinct purposes:

| Script | Purpose | When to use |
|--------|---------|-------------|
| `bootstrap.sh` | **Remote bootstrap** — clones the AI OS repo to a temp dir, then runs `install.sh`. Used with `curl \| bash` or when you don't have the repo locally. | `curl -fsSL .../bootstrap.sh \| bash` |
| `install.sh` | **Local installer** — runs from inside the cloned repo. Does the actual work: runs the generator, installs skills, runs `--doctor`. | `bash install.sh --cwd /path/to/target` |

When contributing to the install scripts, edit `install.sh` for installer logic and `bootstrap.sh` only for the remote-fetch wrapper.

## Bundle Updates

Always run `npm run bundle` after source changes before committing a release. See `bundle/README.md` for details on why compiled artifacts are committed.

## Release Process

Releases are fully automated via `.github/workflows/release-automation.yml`. To release:

1. Bump `version` in `package.json` on `dev`
2. Run `npm run build && npm run bundle` to update compiled artifacts
3. Merge `dev` → `master` via PR
4. The release workflow tags and publishes the GitHub Release automatically
5. A follow-up PR bumps `package.json` to the next patch version on `dev`
