# Copilot Compatibility Notes

This file tracks which VS Code / GitHub Copilot release AI OS was last validated against, and records any known compatibility considerations.

---

## Current Validation Target

| Component | Version | Last Validated |
|-----------|---------|----------------|
| VS Code | 1.101.x | 2026-05-21 |
| GitHub Copilot Extension | 1.x (GA) | 2026-05-21 |
| MCP SDK (`@modelcontextprotocol/sdk`) | 1.29.0 | 2026-05-21 |
| `.vscode/mcp.json` schema | v1 | 2026-05-21 |
| `.github/agents/*.agent.md` format | Initial | 2026-05-21 |

---

## Known Compatibility Notes

### VS Code 1.101+

- **MCP Resources** — VS Code 1.101 added native resource picker support for MCP servers. AI OS does not yet register resources (tracked as C1 in the post-v0.21 design doc). No breakage — just an opportunity to improve discoverability.
- **MCP Elicitation** — VS Code 1.101 added elicitation support (structured input requests from tools). AI OS tools do not use elicitation yet. No impact.
- **Agent files** — `.github/agents/*.agent.md` format unchanged from 1.100.

### `.vscode/mcp.json` Schema

AI OS writes `.vscode/mcp.json` using the `mcpServers` key format (VS Code native MCP). Validated against VS Code 1.100–1.101 schema. No breaking changes detected.

---

## Monthly Review Checklist

After each VS Code minor release:

1. Check [VS Code release notes](https://code.visualstudio.com/updates) for Copilot or MCP changes.
2. If `.vscode/mcp.json` schema changed, update `src/generators/mcp.ts`.
3. If agent file format changed, update `src/templates/agents/`.
4. If MCP SDK requires an update, bump `@modelcontextprotocol/sdk` and run `npm test`.
5. Update the table above with the new validation target and date.
6. Run `npm run validate:full` to confirm all 533+ tests pass.

---

## Change Log

| Date | VS Code | Notes |
|------|---------|-------|
| 2026-05-21 | 1.101 | Initial COPILOT_COMPAT.md created. C1 (MCP Resources) identified as next enhancement. |
