# AI OS

> **Give GitHub Copilot a brain. Works with any codebase, any language.**

[![npm](https://img.shields.io/npm/v/ai-os)](https://www.npmjs.com/package/ai-os)
[![CI](https://github.com/marinvch/ai-os/actions/workflows/ai-os-validate.yml/badge.svg)](https://github.com/marinvch/ai-os/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

AI OS is a framework that installs structured AI context into any repository so GitHub Copilot gets consistent, project-aware guidance — auto-detecting your language, framework, conventions, and key files.

## Install

```bash
npx -y github:marinvch/ai-os
```

For more options — `curl | bash`, local clone, profiles, pinning to a release — see [Getting Started →](docs/GETTING-STARTED.md).

## What you get

- **`copilot-instructions.md`** — tailored Copilot rules for your stack (TypeScript, Python, Java, Go, Ruby, etc.)
- **Agent files** — specialist AI agents in `.github/agents/` for common workflows
- **MCP server** — 37 project-intelligence tools accessible inside Copilot
- **14 agent skills** — production-grade skills auto-installed: `brainstorming`, `writing-plans`, `systematic-debugging`, and more
- **Drift detection** — `--check-drift` keeps your AI docs in sync as code evolves
- **Multi-editor** — generate configs for VS Code, Cursor, JetBrains, Neovim with `--editor`
- **Multi-model** — adapt instructions for Claude, Gemini, or local LLMs with `--model`
- **Workflow chaining** — YAML agent pipelines via the `run_workflow` MCP tool

## What it does

Run once in any repo. AI OS scans the codebase, detects your stack, and generates:

| Artifact | Location | What it is |
| --- | --- | --- |
| Copilot instructions | `.github/copilot-instructions.md` | System prompt optimized for your stack |
| Context docs | `.github/ai-os/context/` | Token-efficient stack, architecture, conventions docs |
| MCP tools | `.vscode/mcp.json` + `.ai-os/mcp-server/` | 37 tools for code search, memory, session continuity |
| Agents | `.github/agents/*.agent.md` | Stack-specific chat agents |
| Skills | `.github/copilot/skills/ai-os-*.md` | Per-library playbooks (Next.js, tRPC, Prisma, etc.) |
| Slash commands | `.github/copilot/prompts.json` | `/new-page`, `/new-trpc-procedure`, `/new-model`, etc. |
| Prompt Quality Pack | `.github/instructions/prompt-quality.instructions.md` | Agent routing table + prompting guide |
| Manifest | `.github/ai-os/manifest.json` | Tracks every file AI OS owns for clean pruning |

AI OS initializes a persistent repository memory store at `.github/ai-os/memory/`. Memory entries are automatically deduplicated, TTL-expired, and compacted via `--compact-memory` or the `prune_memory` MCP tool.

## Requirements

- Node.js >= 20 **or** Docker (Node.js-free fallback)
- Git
- GitHub Copilot (VS Code extension)

**Target repositories do not need Node.js** — the MCP server is a pre-built, self-contained bundle.

## Documentation

| Page | Contents |
| --- | --- |
| [Getting Started](docs/GETTING-STARTED.md) | Install guide, profiles, refresh, drift detection |
| [User Guide](docs/USER-GUIDE.md) | CLI flags, agents, skills, MCP tools |
| [MCP Tools Reference](docs/mcp-tools.md) | All 37 Copilot tools documented |
| [CLI Reference](docs/cli.md) | All CLI flags, actions, profiles, dry-run output |
| [Architecture](docs/architecture.md) | Components, data flow, manifest contract, memory |
| [Contributing](docs/contributing.md) | Dev setup, testing, conventions, release process |
| [Changelog](CHANGELOG.md) | Release history |

## Supported framework templates

**Skills:** `nextjs` · `react` · `trpc` · `prisma` · `stripe` · `auth-nextauth` · `rag-pgvector` · `supabase` · `go` · `express` · `python-fastapi` · `java-spring` · `bun` · `deno` · `solid` · `remix`

**Instructions:** `nextjs` · `react` · `nuxt` · `vue` · `svelte` · `angular` · `astro` · `express` · `nestjs` · `trpc` · `prisma` · `drizzle` · `python-fastapi` · `python-django` · `java-spring` · `dotnet` · `php-laravel` · `ruby-rails` · `go` · `rust` · `react-native` · `expo` · `bun` · `deno` · `solid` · `vite` · `remix`

## License

MIT
