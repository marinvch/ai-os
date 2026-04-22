import fs from 'node:fs';
import path from 'node:path';
import type { DetectedStack, AiOsConfig } from '../types.js';
import { getMcpToolsPartitioned } from '../mcp-tools.js';
import { writeIfChanged } from './utils.js';

interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface WriteMcpServerConfigOptions {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface GenerateMcpOptions {
  refreshExisting?: boolean;
  config?: AiOsConfig;
}

/**
 * Merge-write an ai-os server entry into `.vscode/mcp.json`.
 * Preserves any other servers the user may have configured.
 * Uses the official VS Code MCP config format: `"servers"` top-level key.
 */
export function writeMcpServerConfig(outputDir: string, options?: WriteMcpServerConfigOptions): string {
  const mcpJsonPath = path.join(outputDir, '.vscode', 'mcp.json');
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(mcpJsonPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8')) as Record<string, unknown>;
    } catch { /* ignore parse errors, overwrite */ }
  }

  const servers = (existing.servers ?? {}) as Record<string, McpServerConfig>;
  servers['ai-os'] = {
    type: 'stdio',
    command: options?.command ?? 'node',
    args: options?.args ?? ['${workspaceFolder}/.ai-os/mcp-server/index.js'],
    env: options?.env ?? {
      AI_OS_ROOT: '${workspaceFolder}',
    },
  };
  existing.servers = servers;

  fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
  fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
  return mcpJsonPath;
}

/** Returns absolute paths of all managed files (manifest-tracked). */
export function generateMcpJson(stack: DetectedStack, outputDir: string, options?: GenerateMcpOptions): string[] {
  const strictFiltering = options?.config?.strictStackFiltering !== false;
  const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, strictFiltering);

  // Write the official VS Code MCP config (.vscode/mcp.json) with the ai-os
  // server entry. installLocalMcpRuntime() rewrites this entry with the resolved
  // local Node executable path for reliable startup, especially on Windows.
  writeMcpServerConfig(outputDir);

  // Write tool definitions for reference — new format separates active (stack-eligible)
  // tools from available-but-inactive ones so the MCP runtime can filter at startup.
  const toolsJsonPath = path.join(outputDir, '.github', 'ai-os', 'tools.json');
  writeIfChanged(toolsJsonPath, JSON.stringify({ activeTools, availableButInactive }, null, 2));

  // .vscode/mcp.json is intentionally NOT tracked in the AI OS manifest because
  // it is a shared config file that may contain user-added servers.
  return [toolsJsonPath];
}
