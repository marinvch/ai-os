# AI Coding Assistant — Project Instructions

## Project: {{PROJECT_NAME}}

**Primary Language:** {{PRIMARY_LANGUAGE}}  
**Framework(s):** {{FRAMEWORKS}}  
**Package Manager:** {{PACKAGE_MANAGER}}  
**TypeScript:** {{HAS_TYPESCRIPT}}

---

## Tech Stack

{{STACK_SUMMARY}}

---

## Detected Conventions

- **Naming:** {{NAMING_CONVENTION}} for files and identifiers
- **Linter:** {{LINTER}}
- **Formatter:** {{FORMATTER}}
- **Test Framework:** {{TEST_FRAMEWORK}}
- **Test Directory:** {{TEST_DIRECTORY}}

---

## Key Files

{{KEY_FILES}}

---

## Architecture

See `.ai-os/context/architecture.md` for the full architecture overview.  
See `.ai-os/context/conventions.md` for detailed coding conventions.  
See `.ai-os/context/stack.md` for the complete dependency inventory.

---

## General Rules

- Prefer **early returns** (guard clauses) over deep nesting
- Validate all external inputs at the boundary (API/form/webhook)
- Scope database queries by the current user/owner when applicable
- Keep business logic out of UI components — delegate to services/utilities
- Use async/await over .then() chains
- Never commit secrets or credentials
- Only comment code that genuinely needs clarification

---

## MCP Tools Available

Use these tools to fetch project-specific context on demand:

- `search_codebase` — semantic search over project files
- `get_project_structure` — annotated file tree
- `get_conventions` — this project's coding conventions
- `get_stack_info` — full dependency/tech stack details
- `get_file_summary` — key exports and purpose of a specific file

---

{{FRAMEWORK_OVERLAY}}
