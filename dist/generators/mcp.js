import path from 'node:path';
import { getMcpToolsForStack } from '../mcp-tools.js';
import { writeIfChanged } from './utils.js';
/** Returns absolute paths of all managed files. */
export function generateMcpJson(stack, outputDir, _options) {
    const allTools = getMcpToolsForStack(stack);
    // Committed file — no servers block so VCS-hosted copies and the Copilot cloud agent
    // never try to spawn a stdio process that relies on local runtime artifacts.
    // The local server entry is written separately by install.sh into mcp.local.json.
    const committedConfig = { version: 1 };
    const mcpJsonPath = path.join(outputDir, '.github', 'copilot', 'mcp.json');
    writeIfChanged(mcpJsonPath, JSON.stringify(committedConfig, null, 2));
    // Also write tool definitions for reference
    const toolsJsonPath = path.join(outputDir, '.github', 'ai-os', 'tools.json');
    writeIfChanged(toolsJsonPath, JSON.stringify(allTools, null, 2));
    return [mcpJsonPath, toolsJsonPath];
}
