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

function resolveBundledServerSource(): string | null {
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

  // Write the official VS Code MCP config (.vscode/mcp.json) with the resolved
  // Node executable path. This avoids shell alias/PATH issues when VS Code
  // launches the MCP server directly, especially on Windows.
  writeFileAtomic(
    runtimeManifest,
    JSON.stringify(
      {
        name: 'ai-os-mcp-server',
        runtime: 'bundled',
        sourceVersion: getToolVersion(),
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  writeMcpServerConfig(cwd, {
    command: nodePath,
    args: [runtimeEntry],
    env: {
      AI_OS_ROOT: cwd,
    },
  });

  ensureGitignoreEntry(cwd, '.ai-os/mcp-server/node_modules');
  ensureGitignoreEntry(cwd, '.github/ai-os/memory/.memory.lock');

  // Clean up legacy .github/copilot/mcp.local.json if present
  const legacyLocalMcp = path.join(cwd, '.github', 'copilot', 'mcp.local.json');
  if (fs.existsSync(legacyLocalMcp)) {
    try {
      fs.rmSync(legacyLocalMcp);
    } catch {
      /* ignore */
    }
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
