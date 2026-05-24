# bundle/

This directory contains the **pre-built distribution bundles** for AI OS.

## Why are compiled files committed to git?

AI OS is installed via `npx github:marinvch/ai-os` — which fetches directly from GitHub
without a build step. For this to work, the compiled `generate.js` and `server.js` bundles
**must be committed** so they are available at the ref that npx resolves.

## Files

| File | Purpose |
|------|---------|
| `generate.js` | CLI entry point — runs `ai-os` commands |
| `server.js` | MCP server entry point — started by `.mcp.json` / `.vscode/mcp.json` |
| `bundle-manifest.json` | Metadata: version, build date, tool count |

## Updating the bundle

After any source change that should be released:

```bash
npm run build    # compile TypeScript → dist/
npm run bundle   # bundle dist/ → bundle/generate.js + bundle/server.js
```

Always run `npm run bundle` before committing a release. The release automation workflow
does this automatically on merge to `master`.

## PR noise

If you see changes to `bundle/generate.js` in a PR, that means the PR includes a bundle
update. This is expected for feature PRs. For documentation-only or test-only PRs, the
bundle should not change — if it does, something went wrong in the build.
