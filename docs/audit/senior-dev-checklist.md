> **Historical Audit Artifact** — This document was produced during the AI OS codebase audit (May 2026).
> It is preserved as contributor reference. All action items have been resolved as of v0.21.0.
> See the [CHANGELOG](../CHANGELOG.md) for implementation details.

---
# AI OS — Senior Developer Prioritized Checklist

> Based on: security audit × github-issues.md × vscode-copilot-updates.md × result.md  
> Branch: `feat/codebase-improvements` | Updated: June 2025

Legend: ✅ Done · 🔄 In Progress · ❌ Not Started · ⚠️ Blocked

---

## P0 — Critical (Security / Must Ship)

> Block any public release until all P0 items are green.

| # | Item | Issue | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Shell injection in `searchFiles` — switch to `spawnSync` array args | #105 | ✅ Done | `src/mcp-server/search.ts` uses `spawnSync(['rg', ...args])` — verified |
| 2 | Audit and remove all string-form `execSync` callsites | #106 | ✅ Done | No `execSync` in production source — confirmed |
| 3 | Sanitize stack-derived inputs before rendering into Copilot instructions | #107 | ✅ Done | `sanitizeForInstructions()` in `src/generators/utils.ts` — 20 callsites confirmed |
| 4 | Atomic file writes for manifest / config / tools / memory | #110 | ✅ Done | `writeFileAtomic()` + `writeIfChanged()` in `src/generators/utils.ts`; `writeTextAtomic()` in `src/mcp-server/shared.ts` |

---

## P1 — High (Necessary for Production Quality)

> Ship before v1.0. Each item is either a user-facing breakage or a security/reliability regression waiting to happen.

| # | Item | Issue | Status | Notes |
| --- | --- | --- | --- | --- |
| 5 | Generate `.vscode/toolsets.json` — VS Code v1.101 Tool Sets | result.md §2 | ✅ Done | `src/generators/toolsets.ts` — 4 sets (context/explore/plan/backend), wired into `apply.ts` |
| 6 | Generate `.vscode/*.chatprompt.md` — VS Code v1.101 Custom Chat Modes | result.md §2 | ✅ Done | `src/generators/chatmodes.ts` — 3 modes (plan/review/explore), wired into `apply.ts` |
| 7 | Schema-validate all JSON artifacts at read + write time | #109 | ✅ Done | `isMcpToolDefinition()` guard added in `src/mcp-server/tool-definitions.ts`; `isAiOsManifest()` in `utils.ts` and `isAiOsConfig()` in `types.ts` were already present. All read paths validated. |
| 8 | Expand unit test coverage to >40% on critical paths | #114 | ✅ Done | Coverage is **65.71%** across all files (27 test files, 376 tests). All critical paths covered. |
| 9 | Add public `--uninstall` action | #117 | ✅ Done | `src/uninstall.ts` + `src/tests/uninstall.test.ts`. Wired in `src/cli/dispatch.ts`. Respects `protect.json` and user-block markers. |
| 10 | Add `npm audit --omit=dev --audit-level=high` gate in CI | #119 | ✅ Done | Already present in both `validate-fast` and `validate-full` jobs in `.github/workflows/ai-os-validate.yml`. |

---

## P2 — Important (Should Ship in v0.15.x)

> Real value gaps vs. the VS Code v1.100–v1.101 feature set. None are blocking but each leaves discoverability and UX on the table.

| # | Item | Issue | Status | Notes |
| --- | --- | --- | --- | --- |
| 11 | Migrate lifecycle prompts to `.prompt.md` format with `mode:` + `tools:` front matter | result.md §2 | ✅ Done | `src/generators/prompts.ts` now writes individual `.github/copilot/<name>.prompt.md` files with `description:` frontmatter. `prompts.json` removed. |
| 12 | Add MCP prompt definitions as slash commands (`/mcp.ai-os.session_start` etc.) | result.md §2 | ✅ Done | `prompts/list` + `prompts/get` handlers added to `src/mcp-server/index.ts`. 3 prompts: `session_start`, `pre_commit_check`, `architecture_review`. Capabilities advertise `prompts: {}`. |
| 13 | Auto-generate Prompt Quality Pack (`prompt-quality.instructions.md`) | #127 | ✅ Done | `generatePromptQualityPack()` in `src/generators/instructions.ts` (line 468). Controlled by `config.promptQualityPack` flag in `AiOsConfig`. |
| 14 | Auto-run `--doctor` at end of `install.sh` | #123 | ✅ Done | `install.sh` runs `--doctor` post-install (line 622–629). Prints actionable fix command on failure. |
| 15 | Add `examples/` snapshot fixture tests | #124 | ✅ Done | `src/tests/examples.test.ts` — snapshot tests for `nextjs-trpc-prisma`, `python-fastapi`, `go-service`. All pass. |

---

## P3 — Nice to Have (Roadmap / v1.0)

> Valuable but not blocking. Schedule based on user demand.

| # | Item | Issue | Status | Notes |
| --- | --- | --- | --- | --- |
| 16 | PHP / WordPress stack support | #104 | ✅ Done | PHP in `src/detectors/language.ts`; WordPress detection in `src/detectors/framework.ts` (wp-config.php + wp-content); test in `src/tests/wordpress-detection.test.ts`. |
| 17 | Architecture migration workflow integration | #128 | ✅ Done | Phase 3 Step 4 added to both `.github/agents/architecture-migration.agent.md` and `src/templates/agents/architecture-migration.md`: run `--refresh-existing` after hygiene check. Template also fixed stale `prompts.json` → `*.prompt.md` reference. |
| 18 | Publish bundle provenance / SLSA attestation on releases | #120 | ✅ Done | `actions/attest-build-provenance@v2` added to `.github/workflows/release-automation.yml`. Attests `bundle/generate.js` + `bundle/server.js` on every release. Added `id-token: write` + `attestations: write` permissions. |
| 19 | Self-host OpenSSF Scorecard regression check in CI | #121 | ✅ Done | `.github/workflows/scorecard.yml` — weekly schedule (Mon 06:00 UTC) + push-to-master trigger. Publishes SARIF to GitHub Security tab and badge to securityscorecards.dev. |

---

## Progress Summary

```text
P0 Critical:   4/4  ████████████ 100%
P1 High:       6/6  ████████████ 100%
P2 Important:  5/5  ████████████ 100%
P3 Roadmap:    4/4  ████████████ 100%

Overall:       19/19 ████████████ 100%
```

---

## Suggested Next Sprint

All 19 checklist items are complete. The codebase is at 100% on the original roadmap.

Potential next directions:
- Open new issues for VS Code v1.102+ features as they are released
- Monitor OpenSSF Scorecard badge and address any new findings
- Review `npm audit` output for new CVEs as they are disclosed
- Revisit P1 test coverage targets as new generators are added

