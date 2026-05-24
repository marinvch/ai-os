# AI OS v0.22.0 Hardening — Design Spec

**Date:** 2026-05-24  
**Author:** Audit-driven (brainstorming + Feature Enhancement Advisor + Idea Validator)  
**Status:** Approved for implementation

---

## Executive Summary

A three-source audit (manual code review, Feature Enhancement Advisor, Idea Validator) confirmed
that ai-os v0.21.0 is **functional but has four structural gaps** that limit its reliability and
maintainability as the codebase grows. The gaps are independent and can be addressed in parallel
by separate branches.

**What the audit found is NOT broken:** CI pipeline (comprehensive matrix + scorecard), security
(ESLint bans shell injection, spawnSync-only, no exec), dependabot (configured), zod (present as
dep), monorepo (partially supported), error handling (AiOsError + exit codes).

**What genuinely needs fixing (4 confirmed gaps):**

1. **God-file architecture** — `apply.ts` (1,123 lines) and `sdk-server.ts` (728 lines, 0% coverage)
2. **Critical test coverage gaps** — `sdk-server.ts`: 0%, `hooks.ts`: 0%, `index.ts`: 0%,
   `project-introspection.ts`: 10%; coverage threshold only `statements: 40`
3. **TypeScript incomplete strictness** — missing `noUncheckedIndexedAccess`,
   `exactOptionalPropertyTypes`
4. **Tooling baseline** — no Prettier, no lint-staged pre-commit hooks

---

## Area 1: Architecture Refactor — apply.ts

### Problem

`apply.ts` (1,123 lines) violates single-responsibility. It currently owns:
- Orchestration of all generators (correct — keep)
- Inline O(m×n) LCS diff algorithm + dry-run diff printer (~100 lines)
- MCP runtime installation + healthcheck (~65 lines)
- Prune + protect.json logic + hybrid-merge conflict reporting (~100 lines)
- Console summary/output formatting (~160 lines)
- Bootstrap action side effects, auto-superpowers install, agent flow prompts (~80 lines)

### Design

Extract into focused modules. `apply.ts` keeps only orchestration logic.

**New files:**

| File | Responsibility | Est. lines |
|------|---------------|------------|
| `src/lib/diff.ts` | `computeLineDiff()` + `lcs()` | ~50 |
| `src/actions/apply-output.ts` | `printDryRunDiff()`, `printSummary()`, `printContextualNextSteps()`, `printAgentFlowSetupPrompt()`, `printAgentFlowStatus()` | ~200 |
| `src/actions/apply-prune.ts` | `loadProtectConfig()`, prune loop, protect restore, hybrid merge | ~150 |
| `src/actions/mcp-runtime.ts` | `resolveBundledServerSource()`, `installLocalMcpRuntime()` | ~80 |

**Resulting `apply.ts`:** ~200-250 lines of pure orchestration (`runApply()` function only).

### Rules

- All extracted modules export named functions only (no class hierarchies)
- `apply.ts` imports from all 4 new modules; no circular deps
- All utility exports must be re-exported from `apply.ts` if used by tests (backward compat)
- `src/lib/diff.ts` is framework-agnostic: `(before: string, after: string) → DiffHunk[]`

---

## Area 2: Test Hardening

### Problem

Coverage report (actual measurements):

| File | Statements | Branches | Functions |
|------|-----------|---------|-----------|
| `mcp-server/sdk-server.ts` | **0%** | 0% | 0% |
| `mcp-server/index.ts` | **0%** | 0% | 0% |
| `generators/hooks.ts` | **0%** | 0% | 0% |
| `mcp-server/project-introspection.ts` | **10%** | 5% | 10% |
| `generators/utils.ts` | 52% | 45% | 50% |
| Overall | 59% | 50% | 65% |

Threshold is `statements: 40` — far too low.

### Design

**New test files:**

1. **`src/tests/sdk-server-tools.test.ts`** — Contract tests for MCP tool registration
   - Verify all 37 tools are registered by name
   - Verify each tool has a description and input schema
   - Verify tools return `{ content: [{ type: 'text', text }] }` shape
   - Verify `wrap()` error boundary returns `isError: true` on thrown errors
   - **Strategy:** Import `createSdkServer()` directly; test the registered handler functions
     via internal inspection using the SDK's `server.listTools()` equivalent

2. **`src/tests/hooks-generator.test.ts`** — Generator contract tests
   - Returns `[]` when `gitHooks: false` or no config
   - Writes `pre-push` hook when `gitHooks: true`
   - Hook file starts with `#!/usr/bin/env bash`
   - Hook is idempotent (write twice → same file)

3. **`src/tests/diff.test.ts`** — Diff algorithm contract tests (after Area 1 extraction)
   - Empty strings produce no hunks
   - Identical strings produce only context hunks
   - Single-line add/remove
   - Multi-line add/remove with context
   - Deterministic output (same input → same output)

**Coverage thresholds update in `vitest.config.ts`:**

```ts
thresholds: {
  statements: 60,
  branches: 50,
  functions: 65,
  lines: 60,
}
```

**Rationale:** 60/50/65/60 is achievable immediately after new tests. Raises the bar without
requiring heroic effort. Branch threshold is lower (50) because many branches are error guards
in generator code that are hard to trigger in unit tests.

---

## Area 3: TypeScript Strict Flags

### Problem

`tsconfig.json` enables `strict: true` but omits:
- `noUncheckedIndexedAccess` — array/record indexing can silently be `undefined`
- `exactOptionalPropertyTypes` — `{ a?: string }` allows `{ a: undefined }` incorrectly

These options catch real bugs (e.g., `arr[i].property` crashing at runtime when `i` is
out-of-bounds, optional props being explicitly set to `undefined` in config objects).

### Design

Add to `tsconfig.json`:
```json
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true
```

Fix all resulting type errors. Common patterns:
- `arr[i]` → `arr[i]!` (when bounds are known) or add bounds check
- `if (arr[i]) { ... }` → type-safe (good — these are already safe)
- Optional prop assignments: `obj.foo = undefined` → `delete obj.foo` or use `Partial<>`

`noImplicitOverride` enforces explicit `override` keyword when overriding class methods.
This is low-noise but prevents silent breakage in subclasses.

---

## Area 4: Tooling Baseline

### Problem

No Prettier = formatting inconsistency accumulates over time. No lint-staged = malformed
commits bypass lint. As the project grows and accepts PRs, this becomes a real issue.

### Design

**Prettier:**
- Install `prettier` as devDependency
- `.prettierrc` with minimal opinionated config:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "printWidth": 100,
    "trailingComma": "all",
    "tabWidth": 2
  }
  ```
- Add `format` script: `prettier --write "src/**/*.ts"`
- Add `format:check` script: `prettier --check "src/**/*.ts"`
- Add `format:check` to `npm run ci` and `validate:fast`
- `.prettierignore`: `dist/ bundle/ node_modules/`

**lint-staged + simple-git-hooks:**
- Use `simple-git-hooks` (lighter than husky, no post-install scripts needed)
- `lint-staged` config: on `*.ts` staged files → `eslint --fix` + `prettier --write`
- Pre-commit hook: run `lint-staged`
- Add `prepare` script: `simple-git-hooks`

**ESLint addition:**
- Add `max-lines` rule: `warn` at 400 lines (gives early warning), `error` at 600 lines
- This prevents new god files from forming

---

## Implementation Order

Execute in this sequence (each is a separate feature branch):

| Phase | Branch | What | Risk |
|-------|--------|------|------|
| 1 | `feat/tooling-baseline` | Prettier + lint-staged + ESLint max-lines | Low |
| 2 | `feat/ts-strict` | noUncheckedIndexedAccess + exactOptionalPropertyTypes | Low-Med |
| 3 | `feat/test-hardening` | sdk-server tests, hooks tests, diff tests, thresholds | Low |
| 4 | `feat/arch-refactor` | Split apply.ts into 5 focused modules | Med |

Phases 1–3 are independent and can be merged to `dev` in any order.
Phase 4 depends on Phase 3 (tests act as regression guard for the refactor).

---

## Acceptance Criteria

- [ ] `npm run build` passes with zero errors
- [ ] `npm run test` passes with all thresholds met (60/50/65/60)
- [ ] `npm run lint` passes with zero errors (including max-lines)
- [ ] `npm run format:check` passes
- [ ] `apply.ts` ≤ 300 lines
- [ ] `sdk-server.ts` has ≥ 40% statement coverage
- [ ] `hooks.ts` has 100% statement coverage
- [ ] All 4 new branches merge cleanly to `dev` without conflicts
