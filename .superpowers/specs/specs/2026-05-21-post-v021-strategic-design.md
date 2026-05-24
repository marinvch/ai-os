# AI OS — Post-v0.21 Strategic Design

> **Status:** Draft — v0.21.0 audit session  
> **Date:** 2026-05-21  
> **Scope:** Remaining C+D audit items not yet implemented

---

## Overview

This doc records the strategic items discovered during the May 2026 deep audit of ai-os v0.21.0. Implementable items (A1-A6, B1-B4, C2-C5, C8) were executed during the audit session. The items below require either VS Code API validation, broader ecosystem coordination, or multi-sprint scoping before implementation.

---

## C1 — MCP Resources: Expose Context Docs in VS Code Resource Picker

**Priority:** High  
**Effort:** Medium

### Background

VS Code 1.101+ added native MCP Resources support. Resources appear in the Copilot `@` resource picker, letting users attach project context to any chat session without copy-pasting file paths.

### Proposed Design

Register three MCP Resources in `sdk-server.ts`:

| Resource URI | Content | Description |
|---|---|---|
| `ai-os://context/stack` | `stack.md` | Tech stack, dependencies, package manager |
| `ai-os://context/architecture` | `architecture.md` | Component map, data flow, key files |
| `ai-os://context/conventions` | `conventions.md` | Naming rules, patterns, forbidden practices |

**Implementation sketch:**

```typescript
server.resource('ai-os://context/stack', 'AI OS Stack Context', () => ({
  contents: [{ uri: 'ai-os://context/stack', text: readContextFile('stack.md') }]
}));
```

### Constraints

- Requires `@modelcontextprotocol/sdk` version that exposes `server.resource()` — verify the v1.29.0 API surface before implementing.
- Context files must exist at `.github/ai-os/context/`; guard with `existsSync`.
- Non-breaking: if files are absent, resource returns a friendly error, not a crash.

### Acceptance Criteria

- Resources appear in VS Code Copilot resource picker as `AI OS Stack Context`, etc.
- Content is read fresh from disk on each request (no caching).
- MCP docs freshness CI check updated to note resource count.

---

## C6 — Context Versioning and Rollback

**Priority:** Medium  
**Effort:** High

### Background

When `--refresh-existing` rewrites AI context files, there is no way to roll back if the generated output degrades. Users have to rely on `git diff` manually.

### Proposed Design

**Phase 1 — Snapshot on refresh:**

Before any `--refresh-existing` or `--update` run, copy existing `.github/ai-os/context/` files to `.github/ai-os/context/.snapshots/YYYYMMDD-HHMMSS/`. Keep the last 3 snapshots; prune older ones.

**Phase 2 — Rollback command:**

Add `--rollback` action that:
1. Lists available snapshots.
2. Restores the selected snapshot to `.github/ai-os/context/`.
3. Updates `manifest.json` checksums to match restored files.

**Phase 3 — Diff flag:**

Add `--diff-context` action that shows a unified diff between the current context and the last snapshot.

### Constraints

- Snapshots are gitignored by default (`.github/ai-os/context/.snapshots/` added to `.gitignore`).
- Total snapshot storage is bounded: 3 max, oldest pruned automatically.
- Rollback does not change `config.json` version — user must re-run to re-detect.

### Acceptance Criteria

- After `--refresh-existing`, a snapshot exists in `.snapshots/`.
- `--rollback` without a snapshot argument lists available snapshots.
- `--rollback --to <timestamp>` restores and confirms.

---

## C7 — Full Copilot Extensions API Integration

**Priority:** Low (VS Code API is still evolving)  
**Effort:** Very High

### Background

GitHub Copilot Extensions (now GA) provide a chat extension protocol for registering `@agents` that appear inside Copilot Chat. This would allow AI OS tools to surface as first-class chat participants (`@ai-os`).

### Proposed Design

**Phase 1 — Research gate:**

- Validate current Extensions API against MCP overlap. If `@mention` in agent mode and MCP tools cover the same surface, deprioritize.
- Track GitHub's Extensions changelog for breaking changes.

**Phase 2 — `@ai-os` chat participant:**

Register an `@ai-os` chat participant that:
- Routes `@ai-os doctor` → runs `--doctor` and returns markdown report.
- Routes `@ai-os drift` → runs `--check-drift` and returns report.
- Routes `@ai-os context` → returns current `stack.md` + `architecture.md`.

### Constraints

- Must not duplicate MCP tool functionality. Extensions are for chat-native UX; MCP tools are for agent-native use.
- Extensions require a published GitHub App — out of scope for OSS solo maintainer pattern.

### Decision

**Defer to v0.23+.** Monitor GitHub Extensions API stability. Implement C1 (MCP Resources) first as it delivers similar discoverability with lower complexity.

---

## D1 — Org/Team-Level Context Sharing

**Priority:** Medium  
**Effort:** High

### Background

Currently every repo gets its own `.github/ai-os/` context. Teams want to share conventions, agent templates, and memory entries across repos.

### Proposed Design

**Option A — Org-level context repo:**

A dedicated repo (e.g., `acme-org/ai-os-context`) contains:
- `conventions/` — shared instruction fragments
- `agents/` — shared agent templates
- `memory/` — shared memory entries (read-only)

During install, AI OS fetches from the org context repo and merges with local context. Implemented via a new `orgContextRepo` config field.

**Option B — Extend AI OS manifest:**

Add a `--org-context` flag pointing to a local or remote manifest file. AI OS merges its entries as read-only "org context" layer, overlaid by repo-specific customizations.

### Recommendation

**Option A** (org context repo) aligns with how teams already use shared GitHub config repos (`.github` repos). Lower friction.

### Acceptance Criteria

- `orgContextRepo: "acme-org/ai-os-context"` in config.json causes install to pull shared fragments.
- Shared fragments are marked `[org]` in generated files and preserved on refresh.
- Opt-in; no change in behavior for repos without `orgContextRepo`.

---

## D2 — A2A Protocol Full Integration

**Priority:** Medium  
**Effort:** High

### Background

AI OS already generates an `agents.json` registry and a `--plan` action. The A2A Protocol (Google DeepMind open spec) describes a richer agent card format with capability declarations and task streaming. Full integration would make AI OS agents interoperable with any A2A-compatible orchestrator.

### Current State

- `agents.json` already follows a subset of the A2A AgentCard schema.
- `run_workflow` MCP tool can orchestrate sequential agent chains.
- Full A2A requires: skill declarations, streaming responses, OAuth-secured agent endpoints.

### Proposed Design

**Phase 1 — AgentCard compliance:**

Extend `agents.json` to include all required A2A AgentCard fields:
- `inputModes`: `["text"]`
- `outputModes`: `["text"]`
- `streaming`: `false` (static agents don't stream)
- `skills`: mapped from existing agent capabilities array

**Phase 2 — Discovery endpoint:**

Add an optional `--serve-registry` mode that starts a local HTTP server exposing `GET /.well-known/agent.json` — the A2A discovery endpoint for each agent.

### Acceptance Criteria

- `agents.json` validates against A2A AgentCard schema v0.2.
- `--serve-registry` starts a server that returns compliant agent cards.
- Existing `run_workflow` behavior unchanged.

---

## D3 — VS Code v1.102+ Alignment

**Priority:** Ongoing  
**Effort:** Low/Medium per release

### Background

VS Code releases monthly with Copilot API changes. AI OS must track:
- New MCP capabilities (resources, sampling, elicitation)
- Changes to `.vscode/mcp.json` schema
- New agent file formats in `.github/agents/`
- Copilot instructions format changes

### Proposed Process

1. Add a `COPILOT_COMPAT.md` doc that tracks the VS Code version AI OS was last validated against.
2. Add a `#` stanza to the monthly release checklist in `CHANGELOG.md`:
   - Check VS Code release notes for MCP or Copilot changes
   - Update `.vscode/mcp.json` template if schema changed
   - Run `npm run scorecard:check` with the new VS Code release

### Acceptance Criteria

- `COPILOT_COMPAT.md` exists with current VS Code version and known compatibility notes.
- Monthly review added to release checklist.

---

## D4 — Copilot Cloud Agent Optimization

**Priority:** Medium  
**Effort:** Medium

### Background

GitHub Copilot Cloud Agent (formerly coding agent, now GA) runs AI OS MCP tools in a cloud execution environment with different constraints:
- No persistent filesystem between runs
- Network access patterns differ from local dev
- `copilot-setup-steps.yml` controls environment setup

### Current State

AI OS already has `copilot-setup-steps.yml` in `.github/workflows/` for this repo. Target repos do not get this file automatically.

### Proposed Design

**Phase 1 — copilot-setup-steps.yml generator:**

Add a new generator that writes `.github/workflows/copilot-setup-steps.yml` to target repos when AI OS detects GitHub Actions CI (already tracked in `patterns.hasCiCd`). The generated workflow:
- Sets up Node.js (for MCP server)
- Installs dependencies
- Runs `--doctor` as a validation step

**Phase 2 — Cloud-mode detection in MCP server:**

Detect `GITHUB_ACTIONS=true` + `COPILOT_AGENT=true` env vars and switch the MCP server to a read-only "cloud mode" that skips write-heavy operations.

### Acceptance Criteria

- Target repos with CI get `.github/workflows/copilot-setup-steps.yml`.
- MCP server `--doctor` action reports cloud-mode status.
- Cloud mode is documented in `docs/architecture.md`.

---

## Summary

| Item | Priority | Effort | Status | Recommended Next |
|------|---------|--------|--------|----------------|
| C1 MCP Resources | High | Medium | Not started | Next sprint |
| C6 Context Versioning | Medium | High | Not started | v0.22+ |
| C7 Copilot Extensions | Low | Very High | Deferred | v0.23+ |
| D1 Org Context Sharing | Medium | High | Not started | v0.22+ |
| D2 A2A Full Integration | Medium | High | In progress | Phase 1 next sprint |
| D3 VS Code Alignment | Ongoing | Low | Ongoing | Add COPILOT_COMPAT.md |
| D4 Cloud Agent Optimization | Medium | Medium | Not started | Next sprint |

**Recommended immediate next action:** Implement C1 (MCP Resources) — highest impact, bounded scope, unlocks VS Code resource picker for all AI OS users.
