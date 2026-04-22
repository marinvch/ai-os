import fs from 'node:fs';
import path from 'node:path';
import { getAllMcpTools as getSharedMcpTools } from '../mcp-tools.js';

export interface McpToolSchema {
  type: 'object';
  properties: Record<string, { type: string; description: string }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolSchema;
}

const ROOT = process.env['AI_OS_ROOT'] ?? process.cwd();

/**
 * Runtime MCP server consumes the exact same tool catalog as generators.
 * This prevents metadata drift between generated tools.json and runtime tools/list.
 */
export function getAllMcpTools(): McpToolDefinition[] {
  return getSharedMcpTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Returns only the stack-active tools for this project.
 * Reads from the pre-generated tools.json which was written with stack-aware filtering
 * during the AI OS install/refresh. Falls back to getAllMcpTools() when tools.json is missing
 * or does not contain the expected `activeTools` key.
 */
export function getActiveToolsForProject(): McpToolDefinition[] {
  const toolsJsonPath = path.join(ROOT, '.github', 'ai-os', 'tools.json');
  try {
    const raw = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf-8')) as unknown;
    if (raw && typeof raw === 'object' && 'activeTools' in raw) {
      const { activeTools } = raw as { activeTools: McpToolDefinition[] };
      if (Array.isArray(activeTools) && activeTools.length > 0) {
        return activeTools;
      }
    }
  } catch {
    // tools.json missing or unreadable — fall back to full catalog
  }
  return getAllMcpTools();
}
