import { describe, expect, it } from 'vitest';
import { getAllMcpTools as getGeneratorTools, getMcpToolsPartitioned } from '../mcp-tools.js';
import { getAllMcpTools as getRuntimeTools, getActiveToolsForProject } from '../mcp-server/tool-definitions.js';
import type { DetectedStack, DetectedPatterns } from '../types.js';

const BASE_PATTERNS: DetectedPatterns = {
  namingConvention: 'camelCase',
  hasTypeScript: true,
  packageManager: 'npm',
  hasDockerfile: false,
  hasCiCd: false,
  monorepo: false,
  srcDirectory: true,
};

function makeStack(overrides: Partial<DetectedStack> = {}): DetectedStack {
  return {
    projectName: 'test-project',
    rootDir: '/tmp/test',
    primaryLanguage: { name: 'TypeScript', percentage: 80, fileCount: 10, extensions: ['.ts', '.tsx'] },
    languages: [{ name: 'TypeScript', percentage: 80, fileCount: 10, extensions: ['.ts', '.tsx'] }],
    frameworks: [],
    keyFiles: ['package.json', 'tsconfig.json'],
    patterns: BASE_PATTERNS,
    allDependencies: [],
    ...overrides,
  };
}

describe('MCP tool definition parity', () => {
  it('runtime MCP tools match shared generator tool catalog', () => {
    const generatorTools = getGeneratorTools();
    const runtimeTools = getRuntimeTools();

    expect(runtimeTools.length).toBe(generatorTools.length);

    for (let i = 0; i < generatorTools.length; i++) {
      expect(runtimeTools[i]).toEqual({
        name: generatorTools[i].name,
        description: generatorTools[i].description,
        inputSchema: generatorTools[i].inputSchema,
      });
    }
  });
});

describe('getMcpToolsPartitioned', () => {
  it('places always-on tools in activeTools for a minimal stack', () => {
    const stack = makeStack();
    const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, true);

    // Universal tools (no condition) must always be active
    expect(activeTools.some(t => t.name === 'search_codebase')).toBe(true);
    expect(activeTools.some(t => t.name === 'get_session_context')).toBe(true);
    expect(activeTools.some(t => t.name === 'get_repo_memory')).toBe(true);

    // Conditional tools for Prisma / tRPC must be inactive for a stack that has neither
    expect(activeTools.some(t => t.name === 'get_prisma_schema')).toBe(false);
    expect(availableButInactive.some(t => t.name === 'get_prisma_schema')).toBe(true);
    expect(activeTools.some(t => t.name === 'get_trpc_procedures')).toBe(false);
    expect(availableButInactive.some(t => t.name === 'get_trpc_procedures')).toBe(true);
  });

  it('activates get_prisma_schema when prisma is in dependencies', () => {
    const stack = makeStack({ allDependencies: ['prisma', '@prisma/client'] });
    const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, true);

    expect(activeTools.some(t => t.name === 'get_prisma_schema')).toBe(true);
    expect(availableButInactive.some(t => t.name === 'get_prisma_schema')).toBe(false);
  });

  it('activates get_trpc_procedures when @trpc/server is in dependencies', () => {
    const stack = makeStack({ allDependencies: ['@trpc/server', '@trpc/client'] });
    const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, true);

    expect(activeTools.some(t => t.name === 'get_trpc_procedures')).toBe(true);
    expect(availableButInactive.some(t => t.name === 'get_trpc_procedures')).toBe(false);
  });

  it('places all tools in activeTools when strictFiltering is false', () => {
    const stack = makeStack(); // no Prisma, no tRPC
    const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, false);

    // All tools active when filtering is disabled
    expect(activeTools.some(t => t.name === 'get_prisma_schema')).toBe(true);
    expect(activeTools.some(t => t.name === 'get_trpc_procedures')).toBe(true);
    expect(availableButInactive.length).toBe(0);
  });

  it('total tool count equals all tools regardless of stack', () => {
    const stack = makeStack();
    const { activeTools, availableButInactive } = getMcpToolsPartitioned(stack, true);
    const allTools = getGeneratorTools();

    expect(activeTools.length + availableButInactive.length).toBe(allTools.length);
  });
});

describe('getActiveToolsForProject', () => {
  it('returns a non-empty array of tool definitions', () => {
    // getActiveToolsForProject() reads from tools.json if available (may be filtered),
    // or falls back to the full tool list. Either way, it must return valid tool objects.
    const activeTools = getActiveToolsForProject();
    expect(activeTools.length).toBeGreaterThan(0);
    // Each tool must have the required fields
    for (const tool of activeTools) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('never returns more tools than getAllMcpTools()', () => {
    const activeTools = getActiveToolsForProject();
    const allTools = getRuntimeTools();
    // Active tools must be a subset of or equal to all tools
    expect(activeTools.length).toBeLessThanOrEqual(allTools.length);
    // Each active tool must exist in the full catalog
    const allNames = new Set(allTools.map(t => t.name));
    for (const tool of activeTools) {
      expect(allNames.has(tool.name), `Active tool "${tool.name}" not in full catalog`).toBe(true);
    }
  });
});
