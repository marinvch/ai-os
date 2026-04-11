# Contributing to AI OS

Thank you for contributing! This document explains how to commit changes and how releases are automated.

---

## Conventional Commits

AI OS uses the [Conventional Commits](https://www.conventionalcommits.org/) specification for all commit messages.
The format is:

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Version bump |
|------|-------------|--------------|
| `fix` | Bug fix | **patch** (e.g. `0.5.0` → `0.5.1`) |
| `perf` | Performance improvement | **patch** |
| `refactor` | Code refactor with no behaviour change | **patch** |
| `feat` | New feature | **minor** (e.g. `0.5.0` → `0.6.0`) |
| `BREAKING CHANGE` | Backward-incompatible change (footer or `!`) | **major** (e.g. `0.5.0` → `1.0.0`) |
| `chore`, `docs`, `style`, `test`, `ci`, `build` | Non-releasable housekeeping | none |

### Examples

```
fix(mcp): handle missing config gracefully
feat(install): add --dry-run flag
feat(api)!: rename getStack to analyzeStack
```

A commit with `BREAKING CHANGE:` in the footer **or** a `!` after the type always triggers a **major** bump regardless of the type prefix.

---

## Automated Release Workflow

The release workflow (`.github/workflows/release.yml`) runs automatically on every push to the `dev` branch.

### What it does

1. Finds the latest git tag (defaults to `v0.0.0` if none exists).
2. Scans all commits since that tag for Conventional Commit prefixes.
3. Determines the highest applicable version bump (`major > minor > patch`).
4. If one or more releasable commits are found:
   - Computes the next semantic version.
   - Builds release notes with commit SHAs and PR links.
   - Creates an annotated git tag (e.g. `v0.5.1`).
   - Publishes a GitHub Release with the generated notes.
5. If **no releasable commits** are found the workflow exits silently — no tag or release is created.

### Dry-run mode

When this workflow is triggered by a **pull request** to `dev` it runs in dry-run mode:
it reports the calculated bump and release notes but does not push a tag or create a release.
This lets you preview what will ship before merging.

### Release notes format

Each entry in the release notes follows this format:

```
- <commit subject> (<short SHA>) [#<PR number>]
```

PR links are extracted automatically from the `(#NNN)` pattern that GitHub appends to squash-merged PR titles.

---

## Versioning policy summary

| Condition | Action |
|-----------|--------|
| At least one `BREAKING CHANGE` or `!` commit | Bump **major** |
| At least one `feat:` commit (and no breaking) | Bump **minor** |
| At least one `fix:`, `perf:`, or `refactor:` (and no feat/breaking) | Bump **patch** |
| Only `chore:`, `docs:`, `style:`, `test:`, `ci:`, `build:` commits | **No release** |

---

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `dev` | Integration branch — all PRs target here; releases are cut from here |
| `main` | (if used) Stable production snapshot |
| `copilot/*` | Copilot coding agent feature branches |

Releases are always cut from `dev`. Do not push version tags manually.
