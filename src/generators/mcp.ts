import fs from 'node:fs';
import path from 'node:path';
import type { DetectedStack } from '../types.js';

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

const BASE_MCP_TOOLS: McpTool[] = [
  {
    name: 'search_codebase',
    description: 'Search for patterns, symbols, or text across the project codebase. Respects .gitignore. Returns matching file paths and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The pattern or text to search for' },
        filePattern: { type: 'string', description: 'Optional glob pattern to limit search (e.g. "*.ts", "src/**/*.py")' },
        caseSensitive: { type: 'boolean', description: 'Whether search is case-sensitive (default: false)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_project_structure',
    description: 'Returns an annotated file tree of the project (respects .gitignore, skips node_modules/build/dist). Useful for understanding project layout before making changes.',
    inputSchema: {
      type: 'object',
      properties: {
        depth: { type: 'number', description: 'Max directory depth to show (default: 4)' },
        path: { type: 'string', description: 'Subdirectory to start from (default: project root)' },
      },
    },
  },
  {
    name: 'get_conventions',
    description: 'Returns the detected coding conventions for this project: naming rules, file structure, testing patterns, forbidden practices.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_stack_info',
    description: 'Returns the complete tech stack inventory: languages, frameworks, key dependencies, build tools, and test setup.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_file_summary',
    description: 'Returns a structured summary of a specific file: key exports, types, functions, and brief description. Token-efficient alternative to reading the full file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the file relative to project root' },
      },
      required: ['filePath'],
    },
  },
];

function buildStackTools(stack: DetectedStack): McpTool[] {
  const extra: McpTool[] = [];
  const packages = stack.allDependencies;
  const frameworks = stack.frameworks.map(f => f.name.toLowerCase());

  // Prisma schema reader
  if (packages.includes('prisma') || packages.includes('@prisma/client')) {
    extra.push({
      name: 'get_prisma_schema',
      description: 'Returns the full Prisma schema file contents. Use before making any database model changes.',
      inputSchema: { type: 'object', properties: {} },
    });
  }

  // tRPC procedure lister
  if (packages.includes('@trpc/server') || frameworks.includes('trpc')) {
    extra.push({
      name: 'get_trpc_procedures',
      description: 'Returns a summary of all tRPC procedures (name, input type, public/private). Avoids reading the entire router file.',
      inputSchema: { type: 'object', properties: {} },
    });
  }

  // API routes lister
  if (frameworks.some(f => f.includes('next') || f.includes('express') || f.includes('fastapi'))) {
    extra.push({
      name: 'get_api_routes',
      description: 'Returns a list of all API routes in the project with their HTTP methods and file paths.',
      inputSchema: {
        type: 'object',
        properties: {
          filter: { type: 'string', description: 'Optional substring to filter routes (e.g. "auth", "webhook")' },
        },
      },
    });
  }

  // Env vars reader
  extra.push({
    name: 'get_env_vars',
    description: 'Returns all required environment variable names (from .env.example or code). Shows which are set vs. missing. Never returns values.',
    inputSchema: { type: 'object', properties: {} },
  });

  // Package info
  extra.push({
    name: 'get_package_info',
    description: 'Returns installed package versions and direct dependencies. Useful before suggesting library usage to avoid API mismatch.',
    inputSchema: {
      type: 'object',
      properties: {
        packageName: { type: 'string', description: 'Optional: specific package to look up (e.g. "@trpc/server")' },
      },
    },
  });

  return extra;
}

interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpJson {
  version: number;
  servers: Record<string, McpServerConfig>;
  tools?: McpTool[];
}

export function generateMcpJson(stack: DetectedStack, outputDir: string): void {
  const mcpServerPath = path.join('.ai-os', 'mcp-server', 'index.js').replace(/\\/g, '/');

  const allTools = [...BASE_MCP_TOOLS, ...buildStackTools(stack)];

  const config: McpJson = {
    version: 1,
    servers: {
      'ai-os': {
        type: 'stdio',
        command: 'node',
        args: [mcpServerPath],
        env: {
          AI_OS_ROOT: '.',
        },
      },
    },
    tools: allTools,
  };

  const copilotDir = path.join(outputDir, '.github', 'copilot');
  fs.mkdirSync(copilotDir, { recursive: true });
  fs.writeFileSync(
    path.join(copilotDir, 'mcp.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  // Also write tool definitions for reference
  const aiOsDir = path.join(outputDir, '.ai-os');
  fs.mkdirSync(aiOsDir, { recursive: true });
  fs.writeFileSync(
    path.join(aiOsDir, 'tools.json'),
    JSON.stringify(allTools, null, 2),
    'utf-8'
  );
}
