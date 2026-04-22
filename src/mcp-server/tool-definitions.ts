import { getAllMcpTools as getSharedMcpTools } from '../mcp-tools.js';
import { readAiOsFile } from './utils.js';

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

interface ToolsJsonFormat {
  activeTools?: McpToolDefinition[];
  availableButInactive?: McpToolDefinition[];
}

/**
 * Read the pre-generated tools.json from the project's AI OS directory.
 * Returns null when the file is missing or unreadable.
 */
function readToolsJsonFromProject(): ToolsJsonFormat | null {
  const raw = readAiOsFile('tools.json');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    // New format: { activeTools: [...], availableButInactive: [...] }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'activeTools' in parsed) {
      return parsed as ToolsJsonFormat;
    }
    // Legacy format: plain array of tools — treat as activeTools only
    if (Array.isArray(parsed)) {
      return { activeTools: parsed as McpToolDefinition[] };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

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
 * Returns only the tools that are active for the current project stack.
 * Reads from the pre-generated `.github/ai-os/tools.json` which is written
 * at install/refresh time with strict stack filtering applied.
 *
 * Falls back to the full tool list (getAllMcpTools) if tools.json is not found,
 * ensuring backward compatibility with projects that haven't been refreshed yet.
 */
export function getActiveToolsForProject(): McpToolDefinition[] {
  const toolsJson = readToolsJsonFromProject();
  if (toolsJson?.activeTools && toolsJson.activeTools.length > 0) {
    return toolsJson.activeTools;
  }
  return getAllMcpTools();
}
