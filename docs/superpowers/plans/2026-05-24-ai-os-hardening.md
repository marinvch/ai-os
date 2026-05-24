# AI OS v0.22.0 Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden ai-os by adding Prettier + lint-staged tooling, tightening TypeScript strict flags, splitting the 1,123-line `apply.ts` god file into 5 focused modules, and achieving ≥60% test coverage on previously-zero-coverage files.

**Architecture:** Four sequential feature branches, each mergeable to `dev` independently. Execution order: tooling → ts-strict → arch-refactor → test-hardening. Each phase passes build + tests before the next begins.

**Tech Stack:** TypeScript 5.7, Vitest 4.x + v8 coverage, ESLint 10 + typescript-eslint 8, `@modelcontextprotocol/sdk` 1.29, Prettier 3.x, `simple-git-hooks`, `lint-staged`

---

## File Map

### Phase 1 — Tooling Baseline
- Modify: `package.json` — add devDeps, scripts, lint-staged config
- Create: `.prettierrc` — formatter config
- Create: `.prettierignore` — formatter exclusions
- Modify: `eslint.config.mjs` — add `max-lines` rule
- Modify: `src/**/*.ts` — re-formatted by prettier (no logic change)

### Phase 2 — TypeScript Strictness
- Modify: `tsconfig.json` — add 3 strict flags
- Modify: multiple `src/**/*.ts` files — fix type errors revealed by new flags

### Phase 3 — Architecture Refactor
- Create: `src/lib/diff.ts` — LCS algorithm + dry-run diff printer
- Create: `src/actions/apply-prune.ts` — protect.json config, prune loop, hybrid merge, isCustomArtifact
- Create: `src/actions/mcp-runtime.ts` — bundled server resolution + local MCP install
- Create: `src/actions/apply-output.ts` — all `printXxx()` and `autoInstallSuperpowers()` functions
- Modify: `src/actions/apply.ts` — delete extracted functions, import from new modules; target ≤300 lines
- Modify: `eslint.config.mjs` — add `src/actions/apply.ts` to no-console exemption list

### Phase 4 — Test Hardening
- Create: `src/tests/sdk-server-tools.test.ts` — 37-tool registration + `wrap()` error boundary
- Create: `src/tests/hooks-generator.test.ts` — generateHooks() disabled/enabled + content contract
- Create: `src/tests/diff.test.ts` — computeLineDiff() edge cases
- Modify: `src/mcp-server/sdk-server.ts` — export `wrap` for direct testing
- Modify: `vitest.config.ts` — raise thresholds to 60/50/65/60

---

## Phase 1: Tooling Baseline

**Branch:** `feat/tooling-baseline`

### Task 1.1: Install Prettier

**Files:** Modify `package.json`, create `.prettierrc`, create `.prettierignore`

- [ ] **Step 1: Install Prettier**

```bash
cd D:\Projects\Personal\ai-os
git checkout -b feat/tooling-baseline dev
npm install --save-dev prettier
```

Expected: `prettier` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Create `.prettierrc`**

Create file `D:\Projects\Personal\ai-os\.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all",
  "tabWidth": 2
}
```

- [ ] **Step 3: Create `.prettierignore`**

Create file `D:\Projects\Personal\ai-os\.prettierignore`:
```
dist/
bundle/
node_modules/
*.js
*.mjs
```

- [ ] **Step 4: Add format scripts to `package.json`**

In the `scripts` block, add after the `lint:fix` entry:
```json
"format": "prettier --write \"src/**/*.ts\"",
"format:check": "prettier --check \"src/**/*.ts\"",
```

Also update the `ci` script to include format check:
```json
"ci": "npm run typecheck && npm run lint && npm run format:check && npm run test",
```

And update `validate:fast`:
```json
"validate:fast": "npm run build && npm run lint && npm run format:check && npm run test",
```

- [ ] **Step 5: Format all existing TypeScript files**

```bash
npx prettier --write "src/**/*.ts"
```

Expected: many files reformatted (no logic changes).

- [ ] **Step 6: Verify build and tests still pass**

```bash
npm run build && npm run test
```

Expected: build passes, all tests pass. Any count is fine — formatting never changes behaviour.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(tooling): add Prettier with format/format:check scripts

- Install prettier as devDependency
- Add .prettierrc (singleQuote, semi, printWidth: 100, trailingComma: all)
- Add .prettierignore (dist/, bundle/, node_modules/)
- Add format and format:check npm scripts
- Add format:check to ci and validate:fast pipelines
- Format all existing TypeScript files (no logic changes)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.2: Install lint-staged + simple-git-hooks

**Files:** Modify `package.json`

- [ ] **Step 1: Install lint-staged and simple-git-hooks**

```bash
npm install --save-dev lint-staged simple-git-hooks
```

- [ ] **Step 2: Add configuration to `package.json`**

Add after the `devDependencies` block (at top-level of package.json):
```json
"simple-git-hooks": {
  "pre-commit": "npx lint-staged"
},
"lint-staged": {
  "src/**/*.ts": [
    "eslint --fix",
    "prettier --write"
  ]
},
```

Add to the `scripts` block:
```json
"prepare": "simple-git-hooks",
```

- [ ] **Step 3: Activate the hooks**

```bash
npx simple-git-hooks
```

Expected: `.git/hooks/pre-commit` created with `npx lint-staged` content.

- [ ] **Step 4: Verify hooks are installed**

```bash
cat .git/hooks/pre-commit
```

Expected: file exists and contains `lint-staged`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tooling): add lint-staged + simple-git-hooks pre-commit

- Install lint-staged and simple-git-hooks as devDependencies
- Pre-commit hook: eslint --fix + prettier --write on staged .ts files
- Add prepare script to activate hooks after npm install

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.3: Add ESLint max-lines rule

**Files:** Modify `eslint.config.mjs`

- [ ] **Step 1: Add `max-lines` rule to `eslint.config.mjs`**

In the second config block (files: `['src/**/*.ts']`), add to the `rules` object after `'no-fallthrough'`:

```js
// Warn when a file grows large; error when it crosses the hard limit.
// Thresholds will be tightened to warn:300/error:600 after arch-refactor.
'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
```

- [ ] **Step 2: Run lint and check for violations**

```bash
npm run lint 2>&1 | head -40
```

Expected: `apply.ts` and possibly `sdk-server.ts` get `max-lines` warnings but NOT errors (since the `warn` threshold is 500 and `apply.ts` is ~1123 lines — wait, it would exceed 500 so this will warn).

Note: `apply.ts` (1123 lines) will emit warnings. These are expected and will be resolved in Phase 3. `sdk-server.ts` (728 lines) will also warn. These are tracked in Phase 3 / Phase 4.

- [ ] **Step 3: Confirm lint runs without errors (only warnings)**

```bash
npm run lint; echo "Exit code: $?"
```

Expected: exit code 0 (warnings don't fail the build). If exit code is non-zero, check if `max-lines` was set to `error` instead of `warn`.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "feat(tooling): add ESLint max-lines rule (warn at 500 lines)

Warns when a file exceeds 500 non-blank, non-comment lines.
apply.ts and sdk-server.ts currently exceed this threshold —
both are refactored in feat/arch-refactor.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Phase 2: TypeScript Strictness

**Branch:** `feat/ts-strict`

### Task 2.1: Add strict flags and fix resulting errors

**Files:** Modify `tsconfig.json`, then modify any `src/**/*.ts` files with type errors

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/ts-strict dev
```

- [ ] **Step 2: Add strict flags to `tsconfig.json`**

Replace the current `tsconfig.json` with:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Run typecheck to see all errors**

```bash
npm run typecheck 2>&1 | head -60
```

Expected: a list of TS errors. Common patterns:
- `noUncheckedIndexedAccess`: `arr[i]` where result might be `undefined`
- `exactOptionalPropertyTypes`: assigning `undefined` to optional property

- [ ] **Step 4: Fix `noUncheckedIndexedAccess` errors**

For each error of type "Object is possibly 'undefined'" on array/record index access:
- If the index is guaranteed in-bounds (e.g., after a `.length` check), add `!` non-null assertion: `arr[i]!`
- If the value is used in a condition (e.g., `if (arr[i])`), TypeScript already narrows it — leave as-is
- For `dp[i][j]` style DP arrays: use `!` assertion since bounds are guaranteed by the loop
- For record lookups: add `?? default` or `!` where semantics are clear

Example fixes (apply to all matches of this pattern in the codebase):
```ts
// BEFORE (in computeLineDiff dp array):
dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
// AFTER:
dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
```

- [ ] **Step 5: Fix `exactOptionalPropertyTypes` errors**

For each error like "Type 'undefined' is not assignable to type X | undefined":
- Replace `obj.optionalProp = undefined` with `delete obj.optionalProp`
- OR change the type from `foo?: T` to `foo?: T | undefined` (where semantically correct)
- The most common pattern in this codebase: config spread objects where `undefined` is assigned to optional fields

- [ ] **Step 6: Fix `noImplicitOverride` errors**

For each error "Method overrides a base class method but lacks the 'override' modifier":
- Add the `override` keyword before the method signature

If no class hierarchies exist in the codebase, there will be zero such errors.

- [ ] **Step 7: Verify build and tests pass**

```bash
npm run build && npm run test
```

Expected: zero type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ts-strict): add noUncheckedIndexedAccess + exactOptionalPropertyTypes

Adds three TypeScript strict compiler flags:
- noUncheckedIndexedAccess: catches silent undefined from array/record indexing
- exactOptionalPropertyTypes: prevents assigning undefined to optional props
- noImplicitOverride: enforces explicit override keyword in class hierarchies

All resulting type errors fixed with minimal assertion additions.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Phase 3: Architecture Refactor

**Branch:** `feat/arch-refactor`

### Task 3.1: Extract diff logic to `src/lib/diff.ts`

**Files:**
- Create: `src/lib/diff.ts`
- Modify: `src/actions/apply.ts` (remove lines 188–287, add import)

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/arch-refactor dev
```

- [ ] **Step 2: Create `src/lib/diff.ts`**

Create file `src/lib/diff.ts` with these exports (cut from `apply.ts` lines 188–287):

```ts
import path from 'node:path';
import type { DryRunCapture } from '../generators/utils.js';

export type DiffHunk = { type: '+' | '-' | ' '; line: string };

/** LCS-based line diff. Returns ordered array of add/remove/context hunks. */
export function computeLineDiff(before: string, after: string): DiffHunk[] {
  const bLines = before.split('\n');
  const aLines = after.split('\n');
  const result: DiffHunk[] = [];

  function lcs(a: string[], b: string[]): Array<[number, number]> {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i]![j] = a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    const pairs: Array<[number, number]> = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) { pairs.unshift([i - 1, j - 1]); i--; j--; }
      else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) i--;
      else j--;
    }
    return pairs;
  }

  const common = lcs(bLines, aLines);
  let bi = 0, ai = 0, ci = 0;
  while (ci <= common.length) {
    const bEnd = ci < common.length ? common[ci]![0] : bLines.length;
    const aEnd = ci < common.length ? common[ci]![1] : aLines.length;
    while (bi < bEnd) result.push({ type: '-', line: bLines[bi++]! });
    while (ai < aEnd) result.push({ type: '+', line: aLines[ai++]! });
    if (ci < common.length) {
      result.push({ type: ' ', line: bLines[common[ci]![0]]! });
      bi = common[ci]![0]! + 1;
      ai = common[ci]![1]! + 1;
    }
    ci++;
  }
  return result;
}

/** Print a colored unified diff of dry-run captures to stdout. */
export function printDryRunDiff(cwd: string, captures: DryRunCapture[], fullDiff: boolean): void {
  const CONTEXT = 3;
  const MAX_LINES = fullDiff ? Infinity : 40;
  let totalAdded = 0, totalRemoved = 0, changedCount = 0, newCount = 0;

  process.stdout.write('\n  🔍 Dry-run diff (no files written)\n\n');

  for (const cap of captures) {
    const rel = path.relative(cwd, cap.filePath).replace(/\\/g, '/');
    if (cap.existingContent === null) {
      newCount++;
      const lines = cap.newContent.split('\n');
      totalAdded += lines.length;
      process.stdout.write(`  \x1b[32m[NEW]\x1b[0m ${rel}\n`);
      if (fullDiff) {
        for (const line of lines) process.stdout.write(`  \x1b[32m+${line}\x1b[0m\n`);
      }
    } else if (cap.existingContent === cap.newContent) {
      // unchanged — skip
    } else {
      changedCount++;
      const hunks = computeLineDiff(cap.existingContent, cap.newContent);
      const added = hunks.filter(h => h.type === '+').length;
      const removed = hunks.filter(h => h.type === '-').length;
      totalAdded += added;
      totalRemoved += removed;
      process.stdout.write(`  \x1b[33m[CHANGED]\x1b[0m ${rel}  (+${added}/-${removed})\n`);

      if (fullDiff) {
        let linesPrinted = 0;
        let i = 0;
        while (i < hunks.length && linesPrinted < MAX_LINES) {
          if (hunks[i]!.type !== ' ') {
            const start = Math.max(0, i - CONTEXT);
            const end = Math.min(hunks.length, i + CONTEXT + 1);
            for (let j = start; j < end && linesPrinted < MAX_LINES; j++) {
              const h = hunks[j]!;
              const color = h.type === '+' ? '\x1b[32m' : h.type === '-' ? '\x1b[31m' : '';
              process.stdout.write(`    ${color}${h.type}${h.line}\x1b[0m\n`);
              linesPrinted++;
            }
            i = end;
          } else {
            i++;
          }
        }
        if (linesPrinted >= MAX_LINES) {
          process.stdout.write(`    ... (truncated, use --full-diff to see all)\n`);
        }
      }
    }
  }

  process.stdout.write(`\n  Summary: ${newCount} new, ${changedCount} changed | +${totalAdded} lines, -${totalRemoved} lines\n`);
  if (!fullDiff && (newCount > 0 || changedCount > 0)) {
    process.stdout.write('  Run with --full-diff to see full diffs.\n');
  }
  process.stdout.write('\n');
}
```

- [ ] **Step 3: Delete lines 188–287 from `apply.ts` and replace with import**

In `apply.ts`, delete the entire `// ── Dry-run unified diff printer ──...` section (lines 188–287 inclusive). Then add to the imports at the top:
```ts
import { printDryRunDiff } from '../lib/diff.js';
```

- [ ] **Step 4: Run build + tests**

```bash
npm run build && npm run test
```

Expected: zero errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/diff.ts src/actions/apply.ts
git commit -m "refactor: extract LCS diff algorithm to src/lib/diff.ts

Move computeLineDiff(), lcs() (nested), and printDryRunDiff() from
the apply.ts god file into a focused, independently-testable module.

apply.ts now imports printDryRunDiff from ../lib/diff.js.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.2: Extract MCP runtime installation to `src/actions/mcp-runtime.ts`

**Files:**
- Create: `src/actions/mcp-runtime.ts`
- Modify: `src/actions/apply.ts`

- [ ] **Step 1: Create `src/actions/mcp-runtime.ts`**

Cut `resolveBundledServerSource()` and `installLocalMcpRuntime()` from `apply.ts` (lines 105–186) into a new file:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeMcpServerConfig } from '../generators/mcp.js';
import { writeFileAtomic } from '../generators/utils.js';
import { getToolVersion } from '../updater.js';

function ensureGitignoreEntry(cwd: string, entry: string): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;
  const current = fs.readFileSync(gitignorePath, 'utf-8');
  const lines = current.split(/\r?\n/);
  if (lines.includes(entry)) return;
  const next = `${current.replace(/\s*$/, '')}\n${entry}\n`;
  fs.writeFileSync(gitignorePath, next, 'utf-8');
}

export function resolveBundledServerSource(): string | null {
  const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(runtimeDir, 'server.js'),
    path.join(runtimeDir, '..', 'bundle', 'server.js'),
    path.join(runtimeDir, '..', 'dist', 'server.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function installLocalMcpRuntime(cwd: string, verbose: boolean): void {
  const bundledServerSource = resolveBundledServerSource();
  if (!bundledServerSource) {
    console.warn('  ⚠ Could not locate bundled MCP server; local ai-os tools may be unavailable.');
    return;
  }

  const runtimeDir = path.join(cwd, '.ai-os', 'mcp-server');
  const runtimeEntry = path.join(runtimeDir, 'index.js');
  const runtimeManifest = path.join(runtimeDir, 'runtime-manifest.json');
  const nodePath = process.execPath;

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(bundledServerSource, runtimeEntry);
  fs.chmodSync(runtimeEntry, 0o755);

  writeFileAtomic(runtimeManifest, JSON.stringify({
    name: 'ai-os-mcp-server',
    runtime: 'bundled',
    sourceVersion: getToolVersion(),
    installedAt: new Date().toISOString(),
  }, null, 2));

  writeMcpServerConfig(cwd, {
    command: nodePath,
    args: [runtimeEntry],
    env: { AI_OS_ROOT: cwd },
  });

  ensureGitignoreEntry(cwd, '.ai-os/mcp-server/node_modules');
  ensureGitignoreEntry(cwd, '.github/ai-os/memory/.memory.lock');

  const legacyLocalMcp = path.join(cwd, '.github', 'copilot', 'mcp.local.json');
  if (fs.existsSync(legacyLocalMcp)) {
    try { fs.rmSync(legacyLocalMcp); } catch { /* ignore */ }
  }

  const healthcheck = spawnSync(nodePath, [runtimeEntry, '--healthcheck'], {
    cwd,
    env: { ...process.env, AI_OS_ROOT: cwd },
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (healthcheck.status !== 0) {
    const details = [healthcheck.stdout, healthcheck.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`MCP runtime healthcheck failed after install${details ? `: ${details}` : ''}`);
  }

  if (verbose) {
    console.log(`  ✏️  write   ${runtimeEntry}`);
    console.log(`  ✏️  write   ${runtimeManifest}`);
    console.log(`  ✏️  write   .vscode/mcp.json`);
  } else {
    console.log('  ✓ MCP runtime installed to .ai-os/mcp-server');
    console.log('  ✓ MCP config written to .vscode/mcp.json');
  }
}
```

Note: `ensureGitignoreEntry` is duplicated here from `apply.ts`. The original in `apply.ts` is also used by the snapshot flow (line 804). Keep both copies for now; they will be deduplicated when apply.ts is cleaned up.

- [ ] **Step 2: Update `apply.ts` imports**

Delete `resolveBundledServerSource()`, `installLocalMcpRuntime()` from `apply.ts`, and delete the old `ensureGitignoreEntry()` function from `apply.ts` (lines 93–103). Then keep `ensureGitignoreEntry` only in `mcp-runtime.ts` and re-export it, OR inline the one call remaining in `apply.ts` line 804.

The simplest approach: in `apply.ts`, replace the call `ensureGitignoreEntry(cwd, ...)` at line 804 with direct inline code:
```ts
const gitignorePath = path.join(cwd, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const current = fs.readFileSync(gitignorePath, 'utf-8');
  if (!current.split(/\r?\n/).includes(`${SNAPSHOTS_DIR_REL}/`)) {
    fs.writeFileSync(gitignorePath, `${current.replace(/\s*$/, '')}\n${SNAPSHOTS_DIR_REL}/\n`, 'utf-8');
  }
}
```

OR export `ensureGitignoreEntry` from `mcp-runtime.ts` and import it in `apply.ts`. Either approach is acceptable; pick whichever produces cleaner code.

Add import to `apply.ts`:
```ts
import { installLocalMcpRuntime } from './mcp-runtime.js';
```

- [ ] **Step 3: Run build + tests**

```bash
npm run build && npm run test
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/actions/mcp-runtime.ts src/actions/apply.ts
git commit -m "refactor: extract MCP runtime install to src/actions/mcp-runtime.ts

Move resolveBundledServerSource() and installLocalMcpRuntime() out of
apply.ts into a focused module. apply.ts imports installLocalMcpRuntime.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.3: Extract output functions to `src/actions/apply-output.ts`

**Files:**
- Create: `src/actions/apply-output.ts`
- Modify: `src/actions/apply.ts`
- Modify: `eslint.config.mjs` (add apply-output.ts to no-console exemption)

- [ ] **Step 1: Create `src/actions/apply-output.ts`**

Cut these functions from `apply.ts` and move them to the new file:
- `printSummary()` (lines 289–348 in the original file; shifts after previous extractions)
- `printContextualNextSteps()` (lines 350–421)
- `printAgentFlowSetupPrompt()` (lines 423–465)
- `printAgentHookGuide()` (lines 467–482)
- `printAgentFlowStatus()` (lines 484–506)
- `printMemoryMaintenanceSummary()` (lines 512–537)
- `validateSkillRoutingCompleteness()` (lines 544–573)
- `printSuperpowersPluginSetup()` (lines 580–593)
- `autoInstallSuperpowers()` (lines 600–665)

The new file needs these imports:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { analyze } from '../analyze.js';
import { getMcpToolsForStack } from '../mcp-tools.js';
import { getManifestPath } from '../generators/utils.js';
import { buildGenerationSummary, formatGenerationSummary } from './summary.js';
import { computeFreshnessReport } from '../detectors/freshness.js';
import { runMemoryMaintenance } from '../mcp-server/utils.js';
import { collectRecommendations } from '../recommendations/index.js';
import { installSkill } from '../bootstrap.js';
import { scanExistingAgents } from '../generators/agents.js';
import type { OnboardingPlan } from '../planner.js';
import type { UpdateStatus } from '../updater.js';
import type { GenerateMode } from '../cli/args.js';
import type { AiOsConfig } from '../types.js';
```

All functions retain their existing signatures. Export all of them with `export function`.

- [ ] **Step 2: Add to ESLint no-console exemption**

In `eslint.config.mjs`, add `'src/actions/apply-output.ts'` to the files array that has `'no-console': 'off'`:
```js
files: [
  'src/cli/**/*.ts',
  'src/generate.ts',
  'src/mcp-server/index.ts',
  'src/actions/apply.ts',
  'src/actions/apply-output.ts',
  'src/actions/mcp-runtime.ts',
],
```

(Also add `apply.ts` to this list since it uses console.log throughout.)

- [ ] **Step 3: Update `apply.ts` imports**

Delete all the extracted functions from `apply.ts`. Add import:
```ts
import {
  printSummary,
  printContextualNextSteps,
  printAgentFlowSetupPrompt,
  printAgentFlowStatus,
  printMemoryMaintenanceSummary,
  validateSkillRoutingCompleteness,
  autoInstallSuperpowers,
} from './apply-output.js';
```

- [ ] **Step 4: Run build + tests + lint**

```bash
npm run build && npm run test && npm run lint
```

Expected: zero errors. Lint warnings on `max-lines` for `sdk-server.ts` are acceptable.

- [ ] **Step 5: Commit**

```bash
git add src/actions/apply-output.ts src/actions/apply.ts eslint.config.mjs
git commit -m "refactor: extract output/print functions to src/actions/apply-output.ts

Move all printXxx() and autoInstallSuperpowers() functions out of
apply.ts into a focused output module. apply.ts imports them.
Add apply-output.ts + apply.ts to ESLint no-console exemption list.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.4: Extract prune/protect logic to `src/actions/apply-prune.ts`

**Files:**
- Create: `src/actions/apply-prune.ts`
- Modify: `src/actions/apply.ts`

- [ ] **Step 1: Create `src/actions/apply-prune.ts`**

Create `src/actions/apply-prune.ts` with the following content. This extracts:
- `ProtectConfig` interface + `toPathSet()` + `loadProtectConfig()` (apply.ts lines 44–81)
- `CUSTOM_ARTIFACT_DIRS` + `isCustomArtifact()` (lines 87–91)
- The inline prune+protect+hybrid-merge block (apply.ts lines 902–1003) extracted into `runPruneAndProtect()`

```ts
import fs from 'node:fs';
import path from 'node:path';
import { mergeUserBlocks } from '../user-blocks.js';

export interface ProtectConfig {
  protected: Set<string>;
  hybrid: Set<string>;
}

function toPathSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    (value as unknown[])
      .filter((p): p is string => typeof p === 'string')
      .map(p => p.replace(/\\/g, '/')),
  );
}

export function loadProtectConfig(cwd: string): ProtectConfig {
  const empty: ProtectConfig = { protected: new Set(), hybrid: new Set() };
  const protectPath = path.join(cwd, '.github', 'ai-os', 'protect.json');
  if (!fs.existsSync(protectPath)) return empty;
  try {
    const raw = JSON.parse(fs.readFileSync(protectPath, 'utf-8')) as {
      protected?: unknown;
      hybrid?: unknown;
    };
    return {
      protected: toPathSet(raw.protected),
      hybrid: toPathSet(raw.hybrid),
    };
  } catch {
    console.warn('  ⚠ Could not parse .github/ai-os/protect.json — ignoring protection config');
    return empty;
  }
}

const CUSTOM_ARTIFACT_DIRS = ['.github/agents/', '.agents/skills/'];

export function isCustomArtifact(relPath: string): boolean {
  return CUSTOM_ARTIFACT_DIRS.some(dir => relPath.startsWith(dir));
}

export interface PruneOptions {
  cwd: string;
  shouldPrune: boolean;
  currentRelFiles: string[];
  previousFiles: Set<string>;
  protectedPaths: Set<string>;
  hybridPaths: Set<string>;
  protectedSnapshots: Map<string, string>;
  hybridSnapshots: Map<string, string>;
  pruneCustomArtifacts: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export interface PruneResult {
  prunedAbs: string[];
  preservedAbs: string[];
  allConflicts: Array<{ file: string; blockId: string; reason: string; detail: string }>;
}

export function runPruneAndProtect(opts: PruneOptions): PruneResult {
  const {
    cwd, shouldPrune, currentRelFiles, previousFiles,
    protectedPaths, hybridPaths, protectedSnapshots, hybridSnapshots,
    pruneCustomArtifacts, dryRun, verbose,
  } = opts;

  const prunedAbs: string[] = [];
  const preservedAbs: string[] = [];

  if (shouldPrune && previousFiles.size > 0) {
    const currentSet = new Set(currentRelFiles);
    for (const rel of previousFiles) {
      if (!currentSet.has(rel)) {
        if (protectedPaths.has(rel)) {
          if (verbose) console.log(`  🔒 protect  ${rel}  (in protect.json)`);
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        if (hybridPaths.has(rel)) {
          if (verbose) console.log(`  🔀 hybrid   ${rel}  (in protect.json hybrid — user blocks preserved)`);
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        if (!pruneCustomArtifacts && isCustomArtifact(rel)) {
          if (verbose) {
            console.log(`  🔒 preserve ${rel}  (custom artifact — pass --prune-custom-artifacts to remove)`);
          }
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        const abs = path.join(cwd, rel);
        if (fs.existsSync(abs)) {
          try {
            if (!dryRun) fs.rmSync(abs);
            prunedAbs.push(abs);
            if (verbose) {
              console.log(`  🗑️  prune   ${rel}  (stale — not in current generation)`);
            } else {
              console.log(`  🗑️  Pruned stale artifact: ${rel}`);
            }
          } catch {
            console.warn(`  ⚠ Could not prune: ${rel}`);
          }
        } else if (verbose) {
          console.log(`  🗑️  prune   ${rel}  (already missing, skipping delete)`);
        }
      }
    }
  }

  // Restore files overwritten despite being in protect.json
  if (!dryRun) {
    for (const [abs, originalContent] of protectedSnapshots) {
      if (!fs.existsSync(abs)) continue;
      const currentContent = fs.readFileSync(abs, 'utf-8');
      if (currentContent !== originalContent) {
        fs.writeFileSync(abs, originalContent, 'utf-8');
        const rel = path.relative(cwd, abs).replace(/\\/g, '/');
        if (verbose) console.log(`  🔒 restored ${rel}  (protect.json: overwrite reverted)`);
        if (!preservedAbs.some(p => p === abs)) preservedAbs.push(abs);
      }
    }
  }

  // Apply hybrid-mode user-block merge
  const allConflicts: Array<{ file: string; blockId: string; reason: string; detail: string }> = [];
  for (const [abs, snapshot] of hybridSnapshots) {
    if (!fs.existsSync(abs)) continue;
    const generated = fs.readFileSync(abs, 'utf-8');
    const { content: merged, preserved: mergedIds, conflicts } = mergeUserBlocks(generated, snapshot);
    if (mergedIds.length > 0 || conflicts.length > 0) {
      const rel = path.relative(cwd, abs).replace(/\\/g, '/');
      if (merged !== generated) {
        fs.writeFileSync(abs, merged, 'utf-8');
      }
      if (mergedIds.length > 0) {
        if (verbose) {
          console.log(`  🔀 merged   ${rel}  (${mergedIds.length} user block(s) preserved: ${mergedIds.join(', ')})`);
        } else {
          console.log(`  🔀 Hybrid merge: ${mergedIds.length} user block(s) preserved in ${rel}`);
        }
      }
      for (const conflict of conflicts) {
        allConflicts.push({ file: rel, ...conflict });
        console.warn(`  ⚠ Hybrid conflict in ${rel}: block "${conflict.blockId}" — ${conflict.detail}`);
      }
    }
  }

  if (allConflicts.length > 0) {
    console.log('');
    console.log(`  ⚠ ${allConflicts.length} user block conflict(s) require manual reconciliation.`);
    console.log('     Each block has been appended to its file wrapped in <!-- AI-OS:CONFLICT --> markers.');
    console.log('     Review and move them to the correct location, then remove the conflict markers.');
    console.log('');
  }

  return { prunedAbs, preservedAbs, allConflicts };
}
```

- [ ] **Step 2: Update `apply.ts`**

Remove the `ProtectConfig`, `toPathSet`, `loadProtectConfig`, `CUSTOM_ARTIFACT_DIRS`, `isCustomArtifact` declarations from `apply.ts`.

Remove the inline prune loop block (the block from `// #7 / #8 — Prune stale files` to the end of the hybrid conflict report around line 1003) and replace it with a call to `runPruneAndProtect()`:

```ts
import {
  loadProtectConfig,
  isCustomArtifact,
  runPruneAndProtect,
} from './apply-prune.js';
import type { ProtectConfig } from './apply-prune.js';

// ... in runApply(), replace the inline prune block with:
const { prunedAbs, preservedAbs, allConflicts } = runPruneAndProtect({
  cwd,
  shouldPrune: pruneFlag || mode === 'refresh-existing',
  currentRelFiles,
  previousFiles,
  protectedPaths,
  hybridPaths,
  protectedSnapshots,
  hybridSnapshots,
  pruneCustomArtifacts,
  dryRun,
  verbose: verbose ?? false,
});
```

- [ ] **Step 3: Run build + tests + lint**

```bash
npm run build && npm run test && npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Verify apply.ts line count is now ≤350 lines**

```bash
(Get-Content src\actions\apply.ts).Count
```

Expected: ≤350 lines. If still above 350, check whether all extractions were fully committed.

- [ ] **Step 5: Commit**

```bash
git add src/actions/apply-prune.ts src/actions/apply.ts
git commit -m "refactor: extract prune/protect logic to src/actions/apply-prune.ts

Move ProtectConfig, loadProtectConfig(), isCustomArtifact(), and the
full prune+protect+hybrid-merge loop out of apply.ts into a focused
module with a clean PruneOptions/PruneResult interface.

apply.ts calls runPruneAndProtect() replacing ~100 lines of inline logic.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.5: Verify apply.ts final state

- [ ] **Step 1: Check final line count of apply.ts**

```bash
(Get-Content src\actions\apply.ts).Count
```

Expected: ≤300 lines (orchestration only).

- [ ] **Step 2: Run full validation**

```bash
npm run build && npm run test && npm run lint
```

Expected: all pass.

- [ ] **Step 3: Tighten max-lines in ESLint (now that apply.ts is split)**

In `eslint.config.mjs`, change the `max-lines` rule to:
```js
'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
```

Run lint again to confirm no new errors appear.

- [ ] **Step 4: Final commit for Phase 3**

```bash
git add -A
git commit -m "refactor: tighten ESLint max-lines to 400 post arch-refactor

apply.ts is now ≤300 lines. Tighten max-lines warn threshold from 500
to 400 so future god files are caught early.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Phase 4: Test Hardening

**Branch:** `feat/test-hardening`

### Task 4.1: Write `generateHooks()` tests

**Files:**
- Create: `src/tests/hooks-generator.test.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/test-hardening dev
```

Note: This branch is based on `dev`. If Phase 3 is not yet merged, base it on `feat/arch-refactor` instead, but merge order should be: arch-refactor → test-hardening.

- [ ] **Step 2: Create `src/tests/hooks-generator.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateHooks } from '../generators/hooks.js';
import type { AiOsConfig } from '../types.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-hooks-test-'));
}

function makeConfig(overrides: Partial<AiOsConfig> = {}): AiOsConfig {
  return { gitHooks: false, ...overrides } as unknown as AiOsConfig;
}

describe('generateHooks()', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('returns empty array when gitHooks is false', () => {
    const result = generateHooks(tmpDir, { config: makeConfig({ gitHooks: false }) });
    expect(result).toEqual([]);
  });

  it('returns empty array when no config is provided', () => {
    const result = generateHooks(tmpDir, {});
    expect(result).toEqual([]);
  });

  it('returns empty array when options are undefined', () => {
    const result = generateHooks(tmpDir);
    expect(result).toEqual([]);
  });

  it('returns the pre-push hook path when gitHooks is true', () => {
    const result = generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('.githooks');
    expect(result[0]).toContain('pre-push');
  });

  it('writes the pre-push hook file to disk', () => {
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const hookPath = path.join(tmpDir, '.githooks', 'pre-push');
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it('pre-push hook starts with bash shebang', () => {
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const hookPath = path.join(tmpDir, '.githooks', 'pre-push');
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  it('pre-push hook contains drift detection command', () => {
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const hookPath = path.join(tmpDir, '.githooks', 'pre-push');
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('--check-drift');
  });

  it('pre-push hook exits 0 (non-blocking)', () => {
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const hookPath = path.join(tmpDir, '.githooks', 'pre-push');
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('exit 0');
  });

  it('is idempotent — calling twice produces the same file', () => {
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const hookPath = path.join(tmpDir, '.githooks', 'pre-push');
    const first = fs.readFileSync(hookPath, 'utf-8');
    generateHooks(tmpDir, { config: makeConfig({ gitHooks: true }) });
    const second = fs.readFileSync(hookPath, 'utf-8');
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -E "hooks|PASS|FAIL"
```

Expected: all hooks-generator tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/tests/hooks-generator.test.ts
git commit -m "test: add generateHooks() contract tests (was 0% coverage)

9 tests covering: disabled/enabled/undefined config, file creation,
shebang content, drift-check command, exit-0 non-blocking, idempotency.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.2: Write `computeLineDiff()` tests

**Files:**
- Create: `src/tests/diff.test.ts`

Note: This task requires Phase 3 to be complete (so `src/lib/diff.ts` exists). If Phase 3 is not merged, skip this task and return to it after merging.

- [ ] **Step 1: Create `src/tests/diff.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeLineDiff } from '../lib/diff.js';

describe('computeLineDiff()', () => {
  it('returns empty array for two empty strings', () => {
    const result = computeLineDiff('', '');
    // Single empty-string line in both: one context hunk
    const changed = result.filter(h => h.type !== ' ');
    expect(changed).toHaveLength(0);
  });

  it('returns only context hunks for identical strings', () => {
    const result = computeLineDiff('hello\nworld', 'hello\nworld');
    const changed = result.filter(h => h.type !== ' ');
    expect(changed).toHaveLength(0);
  });

  it('detects a single added line', () => {
    const result = computeLineDiff('line1', 'line1\nline2');
    const added = result.filter(h => h.type === '+');
    expect(added).toHaveLength(1);
    expect(added[0]!.line).toBe('line2');
  });

  it('detects a single removed line', () => {
    const result = computeLineDiff('line1\nline2', 'line1');
    const removed = result.filter(h => h.type === '-');
    expect(removed).toHaveLength(1);
    expect(removed[0]!.line).toBe('line2');
  });

  it('detects a changed line as remove + add', () => {
    const result = computeLineDiff('old', 'new');
    const removed = result.filter(h => h.type === '-');
    const added = result.filter(h => h.type === '+');
    expect(removed).toHaveLength(1);
    expect(removed[0]!.line).toBe('old');
    expect(added).toHaveLength(1);
    expect(added[0]!.line).toBe('new');
  });

  it('handles multi-line add with context', () => {
    const before = 'a\nb\nc';
    const after = 'a\nb\nx\ny\nc';
    const result = computeLineDiff(before, after);
    const added = result.filter(h => h.type === '+').map(h => h.line);
    expect(added).toContain('x');
    expect(added).toContain('y');
  });

  it('is deterministic — same input always produces same output', () => {
    const before = 'foo\nbar\nbaz';
    const after = 'foo\nquux\nbaz';
    const first = computeLineDiff(before, after);
    const second = computeLineDiff(before, after);
    expect(first).toEqual(second);
  });

  it('counts added and removed lines correctly', () => {
    const before = 'a\nb\nc\nd';
    const after = 'a\nX\nY\nd';
    const result = computeLineDiff(before, after);
    const added = result.filter(h => h.type === '+').length;
    const removed = result.filter(h => h.type === '-').length;
    expect(added).toBe(2); // X, Y
    expect(removed).toBe(2); // b, c
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -E "diff|PASS|FAIL"
```

Expected: all diff tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tests/diff.test.ts
git commit -m "test: add computeLineDiff() unit tests

8 tests covering: empty input, identical strings, single add/remove,
line change, multi-line add, determinism, and count accuracy.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.3: Write MCP SDK server registration tests

**Files:**
- Modify: `src/mcp-server/sdk-server.ts` (export `wrap`)
- Create: `src/tests/sdk-server-tools.test.ts`

- [ ] **Step 1: Export `wrap` from `sdk-server.ts`**

In `src/mcp-server/sdk-server.ts`, change line 54 from:
```ts
function wrap(
```
to:
```ts
export function wrap(
```

- [ ] **Step 2: Create `src/tests/sdk-server-tools.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the MCP SDK before importing sdk-server ──────────────────────────
const registeredTools: Array<{ name: string; description: string }> = [];
const registerToolSpy = vi.fn((name: string, config: { description: string }) => {
  registeredTools.push({ name, description: config.description });
});

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: registerToolSpy,
    registerPrompt: vi.fn(),
    connect: vi.fn(),
  })),
}));
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Import after mocks are hoisted
const { createSdkServer, wrap } = await import('../mcp-server/sdk-server.js');

describe('createSdkServer()', () => {
  beforeEach(() => {
    registeredTools.length = 0;
    registerToolSpy.mockClear();
    createSdkServer();
  });

  it('registers exactly 37 tools', () => {
    expect(registerToolSpy).toHaveBeenCalledTimes(37);
  });

  it('registers search_codebase tool', () => {
    expect(registeredTools.some(t => t.name === 'search_codebase')).toBe(true);
  });

  it('registers get_project_structure tool', () => {
    expect(registeredTools.some(t => t.name === 'get_project_structure')).toBe(true);
  });

  it('registers get_session_context tool', () => {
    expect(registeredTools.some(t => t.name === 'get_session_context')).toBe(true);
  });

  it('registers remember_repo_fact tool', () => {
    expect(registeredTools.some(t => t.name === 'remember_repo_fact')).toBe(true);
  });

  it('registers get_repo_memory tool', () => {
    expect(registeredTools.some(t => t.name === 'get_repo_memory')).toBe(true);
  });

  it('registers get_file_summary tool', () => {
    expect(registeredTools.some(t => t.name === 'get_file_summary')).toBe(true);
  });

  it('all registered tools have non-empty descriptions', () => {
    expect(registeredTools.every(t => t.description && t.description.length > 0)).toBe(true);
  });

  it('tool names are unique', () => {
    const names = registeredTools.map(t => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe('wrap()', () => {
  it('returns text content for successful handler', async () => {
    const handler = wrap('test-tool', () => 'hello');
    const result = await handler({});
    expect(result.content[0]!.type).toBe('text');
    expect(result.content[0]!.text).toBe('hello');
  });

  it('returns isError: true when handler throws', async () => {
    const handler = wrap('test-tool', () => { throw new Error('boom'); });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe('boom');
  });

  it('handles non-Error throws', async () => {
    const handler = wrap('test-tool', () => { throw 'string error'; });
    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe('string error');
  });

  it('returns text content shape: array with type and text', async () => {
    const handler = wrap('test-tool', () => 'output');
    const result = await handler({});
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.any(String) });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npm run test -- --reporter=verbose 2>&1 | grep -E "sdk-server|wrap|PASS|FAIL"
```

Expected: all sdk-server-tools tests pass.

If you see a module resolution error (e.g., the dynamic import pattern doesn't work with vi.mock hoisting), use static import instead and restructure the mock:
```ts
import { createSdkServer, wrap } from '../mcp-server/sdk-server.js';
```
and ensure `vi.mock()` calls appear before any imports that trigger the mocked module.

- [ ] **Step 4: Commit**

```bash
git add src/mcp-server/sdk-server.ts src/tests/sdk-server-tools.test.ts
git commit -m "test: add MCP SDK server tool registration + wrap() tests

13 tests covering:
- 37-tool registration count
- Presence of key tool names (6 checks)
- All tools have non-empty descriptions
- Tool name uniqueness
- wrap() happy path: text content shape
- wrap() error boundary: isError:true on Error/non-Error throws

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.4: Raise coverage thresholds

**Files:** Modify `vitest.config.ts`

- [ ] **Step 1: Run current coverage baseline**

```bash
npm run test:coverage 2>&1 | tail -30
```

Expected: see current statement %, branch %, function %, line % columns.

- [ ] **Step 2: Update thresholds in `vitest.config.ts`**

Replace the `thresholds` block:
```ts
thresholds: {
  statements: 60,
  branches: 50,
  functions: 65,
  lines: 60,
},
```

- [ ] **Step 3: Run coverage to verify thresholds are met**

```bash
npm run test:coverage
```

Expected: all 4 thresholds pass. If a threshold fails, check which file is dragging coverage below the limit and add targeted tests or lower the threshold by 5 points with a TODO comment explaining why.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "test: raise coverage thresholds to 60/50/65/60

statements: 40 → 60
branches: (none) → 50
functions: (none) → 65
lines: (none) → 60

New hooks, diff, and sdk-server tests bring previously-zero-coverage
files above the thresholds.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.5: Final validation across all phases

- [ ] **Step 1: Run full validate:fast**

```bash
npm run validate:fast
```

Expected: build ✅ + lint ✅ (max-lines warns only on sdk-server.ts) + format:check ✅ + test ✅ with all coverage thresholds met.

- [ ] **Step 2: Check apply.ts final line count**

```bash
(Get-Content src\actions\apply.ts).Count
```

Expected: ≤300 lines.

- [ ] **Step 3: Final commit and branch summary**

```bash
git log --oneline feat/test-hardening ^dev
```

Shows all commits in this phase.

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 spec areas have corresponding tasks (Tooling → 1, TS-strict → 2, Arch → 3, Tests → 4)
- [x] **No placeholders:** Every step contains actual code or an exact command
- [x] **Type consistency:** `PruneOptions`/`PruneResult` interfaces defined in Task 3.4 and used in the same task; `DiffHunk` defined in Task 3.1 and used in Task 4.2
- [x] **apply.ts ESLint:** `no-console: 'off'` exemption added for `apply.ts` and `apply-output.ts` in Task 3.3
- [x] **noUncheckedIndexedAccess in diff.ts:** Task 3.1 shows `!` assertions on `dp[i]![j]` patterns
- [x] **mcp-runtime.ts ensureGitignoreEntry conflict:** Noted and resolution strategy given in Task 3.2
