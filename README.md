# AI OS

> **Portable GitHub Copilot context engine** — scan any repository and auto-generate an optimized AI context package: instructions, agents, skills, MCP tools, and slash-command prompts.

## What it does

Run once in any repo. AI OS scans the codebase, detects your stack, and generates:

| Artifact | Location | What it is |
|----------|----------|------------|
| Copilot instructions | `.github/copilot-instructions.md` | System prompt optimized for your stack |
| Context docs | `.ai-os/context/` | Token-efficient stack, architecture, conventions docs |
| MCP tools | `.github/copilot/mcp.json` + `.ai-os/mcp-server/` | 10 tools for code search, schema reading, route listing |
| Agents | `.github/agents/*.agent.md` | Stack-specific chat agents (framework expert, DB expert, auth, payments, explorer) |
| Skills | `.github/copilot/skills/*.md` | Per-library how-to playbooks (Next.js, tRPC, Prisma, Stripe, etc.) |
| Slash commands | `.github/copilot/prompts.json` | `/new-page`, `/new-trpc-procedure`, `/new-model`, `/rag-query`, etc. |

## Requirements

- Node.js ≥ 20
- Git
- GitHub Copilot (VS Code extension)

## Install on any repo

```bash
# Clone ai-os somewhere on your machine (once)
git clone https://github.com/marinvch/ai-os ~/ai-os

# Then run from inside any target repo:
bash ~/ai-os/install.sh

# Or point it at a specific repo:
bash ~/ai-os/install.sh --cwd /path/to/your/repo
```

## What gets detected

- **Languages:** TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, Swift, Kotlin, and 30+ more
- **Frameworks:** Next.js, React, Vue, Angular, Svelte, Express, FastAPI, Django, Spring Boot, .NET, Laravel, Rails, Nuxt, Astro, Remix, tRPC, Prisma, and more
- **Tools:** ESLint, Prettier, Vitest, Jest, Playwright, Docker, GitHub Actions, package managers

## Generated MCP tools

| Tool | Purpose |
|------|---------|
| `search_codebase` | Ripgrep across project |
| `get_project_structure` | Annotated file tree |
| `get_conventions` | Naming + architecture rules |
| `get_stack_info` | Full tech stack inventory |
| `get_file_summary` | Token-efficient file summary |
| `get_prisma_schema` | Full schema (if Prisma detected) |
| `get_trpc_procedures` | All tRPC procedures (if tRPC detected) |
| `get_api_routes` | All API routes with methods |
| `get_env_vars` | Required env vars (never values) |
| `get_package_info` | Installed package versions |

## Re-running (idempotent)

Safe to run multiple times:
- Existing **agents** and **skills** are never overwritten
- Existing **prompts** are kept; only new IDs are added
- `copilot-instructions.md` is backed up to `.bak` before overwrite

## Development

```bash
npm install
# Run generator on a target repo
npm run generate -- --cwd /path/to/target-repo
# Dry run (shows detected stack, no files written)
npm run generate:dry -- --cwd /path/to/target-repo
```

## Supported framework skill templates

`nextjs` · `react` · `trpc` · `prisma` · `stripe` · `auth-nextauth` · `rag-pgvector` · `supabase` · `go` · `express` · `python-fastapi`

## License

MIT
