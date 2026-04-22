import { describe, expect, it } from 'vitest';
import { getAllMcpTools as getGeneratorTools, getMcpToolsForStack, getInactiveMcpTools } from '../mcp-tools.js';
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

describe('stack-based MCP tool filtering', () => {
  it('getMcpToolsForStack excludes Prisma tool for non-Prisma projects', () => {
    const stack = makeStack({ allDependencies: ['react', 'redux'] });
    const tools = getMcpToolsForStack(stack);
    const names = tools.map(t => t.name);
    expect(names).not.toContain('get_prisma_schema');
  });

  it('getMcpToolsForStack excludes tRPC tool for non-tRPC projects', () => {
    const stack = makeStack({ allDependencies: ['react', '@reduxjs/toolkit'] });
    const tools = getMcpToolsForStack(stack);
    const names = tools.map(t => t.name);
    expect(names).not.toContain('get_trpc_procedures');
  });

  it('getMcpToolsForStack includes Prisma tool when prisma is a dependency', () => {
    const stack = makeStack({ allDependencies: ['prisma', '@prisma/client'] });
    const tools = getMcpToolsForStack(stack);
    const names = tools.map(t => t.name);
    expect(names).toContain('get_prisma_schema');
  });

  it('getMcpToolsForStack includes tRPC tool when @trpc/server is a dependency', () => {
    const stack = makeStack({ allDependencies: ['@trpc/server'] });
    const tools = getMcpToolsForStack(stack);
    const names = tools.map(t => t.name);
    expect(names).toContain('get_trpc_procedures');
  });

  it('getInactiveMcpTools returns tools not matching the stack condition', () => {
    const stack = makeStack({ allDependencies: ['react'] }); // no Prisma/tRPC
    const inactive = getInactiveMcpTools(stack);
    const names = inactive.map(t => t.name);
    expect(names).toContain('get_prisma_schema');
    expect(names).toContain('get_trpc_procedures');
  });

  it('getInactiveMcpTools and getMcpToolsForStack are complementary', () => {
    const stack = makeStack({ allDependencies: ['react'] });
    const active = getMcpToolsForStack(stack);
    const inactive = getInactiveMcpTools(stack);
    const all = getGeneratorTools();
    // active + inactive should cover the full conditional catalog;
    // unconditional (always) tools appear only in active
    const activeNames = new Set(active.map(t => t.name));
    const inactiveNames = new Set(inactive.map(t => t.name));
    for (const tool of inactive) {
      expect(activeNames.has(tool.name)).toBe(false);
    }
    for (const tool of all) {
      expect(activeNames.has(tool.name) || inactiveNames.has(tool.name)).toBe(true);
    }
  });

  it('getActiveToolsForProject falls back to getAllMcpTools when tools.json is absent', () => {
    // In the test environment there is no deployed tools.json, so the fallback kicks in
    const active = getActiveToolsForProject();
    const all = getRuntimeTools();
    expect(active.length).toBe(all.length);
  });
});
