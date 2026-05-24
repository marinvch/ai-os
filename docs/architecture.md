# AI OS — Architecture

## Overview

AI OS is a portable GitHub Copilot context engine. It scans a repository, detects the tech stack, and generates an optimized AI context package. Detection is package-aware for monorepos and mixed stacks.

## Components

```
src/
  analyze.ts          — Entry point: scans repo, builds DetectedStack
  errors.ts           — AiOsError class + AiOsErrorCode union (structured errors with exit codes)
  generate.ts         — CLI + orchestration: reads flags, runs generators
  bootstrap.ts        — --bootstrap action: generate + auto-install skills
  doctor.ts           — --doctor action: post-install health validation
  profile.ts          — Install profile presets (minimal/standard/full)
  mcp-tools.ts        — MCP tool catalog and stack filtering
  types.ts            — Shared TypeScript types
  updater.ts          — --update / --refresh-existing logic
  user-blocks.ts      — USER_BLOCK hybrid content preservation

  actions/
    apply.ts          — Generation orchestrator (~345 lines; delegates to focused sub-modules below)
    apply-prune.ts    — ProtectConfig + runPruneAndProtect (prune/protect-restore/hybrid-merge loop)
    apply-output.ts   — All print* output functions + autoInstallSuperpowers
    mcp-runtime.ts    — installLocalMcpRuntime (MCP server bundle install + .gitignore wiring)
    summary.ts        — GenerationSummary type + buildGenerationSummary/formatGenerationSummary
    plan.ts           — --plan action (onboarding plan display)
    preview.ts        — --preview action (onboarding preview)

  lib/
    diff.ts           — computeLineDiff (LCS-based diff) + printDryRunDiff

  detectors/
    language.ts       — Language detection (30+ languages)
    framework.ts      — Framework detection (Next.js, Django, Spring, etc.)
    patterns.ts       — Package manager, linter, test framework
    graph.ts          — Dependency graph builder
    freshness.ts      — Context drift scoring
    drift.ts          — Artifact drift detection (missing/stale/semantic-mismatch)

  generators/
    instructions.ts   — .github/copilot-instructions.md + instructions/
    agents.ts         — .github/agents/*.agent.md
    skills.ts         — .github/copilot/skills/ai-os-*.md
    mcp.ts            — .vscode/mcp.json + .mcp.json
    workflows.ts      — .github/workflows/ (update-check)
    context-docs.ts   — .github/ai-os/context/ docs
    prompts.ts        — .github/copilot/prompts.json
    utils.ts          — writeIfChanged, writeManifest, hashContent, writeFileAtomic

  mcp-server/
    index.ts              — MCP entry point: --healthcheck, --copilot SDK mode, default stdio mode
    sdk-server.ts         — createSdkServer() factory: registers all 37 tools + 3 prompts via @modelcontextprotocol/sdk
    tool-definitions.ts   — Tool catalog (reads from .github/ai-os/)
    filesystem.ts         — readFile, listDirectory, runTests, runLint, runBuild
    memory.ts             — Repo memory CRUD (memory.jsonl)
    session.ts            — Session state: active plan, checkpoints, failure ledger, watchdog
    search.ts             — searchFiles, buildFileTree (ripgrep-backed)
    project-introspection.ts — getEnvVars, getFileSummary, getPrismaSchema, getTrpcProcedures
    freshness-bridge.ts   — getContextFreshness (delegates to detectors/freshness.ts)
    recommendations-bridge.ts — getRecommendations, suggestImprovements
    shared.ts             — ROOT resolution, readAiOsFile
    utils.ts              — Barrel re-exporter + getProjectRoot, getSessionContext, checkForUpdates

  recommendations/
    index.ts          — Stack-aware recommendation engine
    registry.ts       — Skill/tool registry with triggers
    cli-compat.ts     — Skills CLI mode detection + command builder
```

## Data Flow

```
CLI flags + cwd
      │
      ▼
  analyze(cwd)           ← detects stack, languages, frameworks, patterns
      │
      ▼
  DetectedStack          ← typed snapshot of the repo's tech profile
      │
      ├──► generateInstructions()    → .github/copilot-instructions.md
      ├──► generateContextDocs()     → .github/ai-os/context/
      ├──► generateAgents()          → .github/agents/
      ├──► generateSkills()          → .github/copilot/skills/
      ├──► generateMcpJson()         → .vscode/mcp.json + .mcp.json
      ├──► generateWorkflows()       → .github/workflows/
      ├──► generatePrompts()         → .github/copilot/prompts.json
      └──► writeManifest()           → .github/ai-os/manifest.json
            │
            ▼
      buildGenerationSummary()  ← written/skipped/pruned counts + duration
```

### apply.ts orchestration (actions/)

`apply.ts` is a pure orchestrator that delegates to focused sub-modules:

```
runApply(opts)
  ├──► runPruneAndProtect(opts)      ← apply-prune.ts
  │       Prune stale artifacts, protect user blocks (hybrid merge), restore protected paths
  ├──► installLocalMcpRuntime(...)   ← mcp-runtime.ts
  │       Copy bundled MCP server, wire .gitignore entry
  ├──► computeLineDiff(...)          ← lib/diff.ts (used in --dry-run mode)
  │       LCS-based line diff for per-file change preview
  └──► printSummary/printContextualNextSteps/... ← apply-output.ts
          All terminal output, skill-routing validation, autoInstallSuperpowers
```

## Error Handling

AI OS uses `AiOsError` (from `src/errors.ts`) for all known recoverable errors:

| Exit code | Meaning |
|-----------|---------|
| `0` | Success |
| `1` | Unexpected / unhandled error |
| `2` | Known `AiOsError` — user-actionable fix hint provided |

`AiOsErrorCode` values: `MISSING_CONFIG`, `INVALID_CONFIG`, `WRITE_FAILED`, `SCAN_FAILED`, `TEMPLATE_NOT_FOUND`, `MCP_RUNTIME_MISSING`, `BUNDLE_CORRUPTED`, `UNKNOWN`.

## Drift Detection

`detectDrift(cwd)` in `src/detectors/drift.ts` scans 7 artifact classes:

1. **Required files** — `copilot-instructions.md`, `COPILOT_CONTEXT.md`, `config.json`
2. **MCP config** — presence and server path validity
3. **Template placeholders** — unreplaced `{{VAR}}` in instructions
4. **Context snapshot age** — warns if older than 7 days
5. **Agent schema** — checks for required Goal/Constraints sections
6. **Skills sync** — installed skills not listed in instructions
7. **Semantic drift** — `config.json` primaryFramework vs. instructions content; `agents.json` count vs. file count

Returns a `DriftReport` with `errors`, `warnings`, `infos`, `healthy`, and `totalIssues`.

`DriftItem.kind` values: `missing`, `stale`, `unknown-file`, `schema-mismatch`, `semantic-mismatch`.

## Manifest Contract

`.github/ai-os/manifest.json` tracks every file AI OS owns:

```json
{
  "version": "0.11.0",
  "generatedAt": "2025-01-01T00:00:00.000Z",
  "files": ["...relative paths..."],
  "hashes": {
    ".github/copilot-instructions.md": "<sha256>"
  }
}
```

- On `--refresh-existing`: files in the previous manifest that are no longer generated are pruned.
- On re-run: `writeIfChanged` compares content before writing — identical files are skipped.

## MCP Config Files

AI OS manages two MCP config files:

| File | Key | Purpose |
| --- | --- | --- |
| `.vscode/mcp.json` | `servers` | VS Code MCP integration (workspace-scoped) |
| `.mcp.json` | `mcpServers` | Project-level MCP config |

Non-AI OS entries in both files are preserved on refresh.

## tools.json Format

With `strictStackFiltering: true` (default):

```json
{
  "activeTools": [...],
  "availableButInactive": [...]
}
```

With `strictStackFiltering: false`:

```json
[...flat array of all tools...]
```

## Memory Architecture

Repository memory lives in `.github/ai-os/memory/memory.jsonl`. Each entry:

```json
{
  "id": "uuid",
  "title": "...",
  "category": "...",
  "content": "...",
  "createdAt": "ISO date",
  "tags": [],
  "stale": false
}
```

Session state lives in `.github/ai-os/memory/session/`:

| File | Purpose |
| --- | --- |
| `active-plan.json` | Current session objective and progress |
| `checkpoints.jsonl` | Progress log (capped at 100) |
| `failure-ledger.jsonl` | Known failure patterns (capped at 50) |
| `compact-context.md` | Latest recovery summary |
| `runtime-state.json` | Watchdog counter and threshold |

## Content Protection

`.github/ai-os/protect.json` controls refresh behavior:

- `protected` array: files never overwritten or pruned
- `hybrid` array: files refreshed but user `USER_BLOCK` sections preserved

User blocks use `<!-- AI-OS:USER_BLOCK:START id="..." -->` / `<!-- AI-OS:USER_BLOCK:END id="..." -->` markers.

## Supported Stacks

**Languages:** TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Swift, Kotlin, 30+ more

**Frameworks:** Next.js, React, Vue, Angular, Svelte, Express, FastAPI, Django, Spring Boot, .NET, Laravel, Rails, Nuxt, Astro, Remix, tRPC, Prisma, and more

**Tools:** ESLint, Prettier, Vitest, Jest, Playwright, Docker, GitHub Actions, all major package managers

## TypeScript Compiler Configuration

`tsconfig.json` enables three extra strict flags beyond `"strict": true`:

| Flag | Effect |
|---|---|
| `noUncheckedIndexedAccess` | `arr[i]` has type `T \| undefined`; use `arr[i]!` when bounds are proven |
| `exactOptionalPropertyTypes` | `prop?: T` does not accept explicit `undefined`; use `prop?: T \| undefined` at the interface level |
| `noImplicitOverride` | Class method overrides must be annotated with `override` |

## Code Formatting

All source files are formatted with **Prettier** (enforced via lint-staged pre-commit hook):

```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all", "tabWidth": 2 }
```

Run `npm run format` to format in-place, or `npm run format:check` for CI (read-only).

