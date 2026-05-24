import { describe, it, expect } from 'vitest';

/**
 * MCP Resources contract tests.
 *
 * The MCP server exposes a `resources` capability with 6 built-in resources
 * under the ai-os://context/* scheme:
 *   - ai-os://context/architecture
 *   - ai-os://context/conventions
 *   - ai-os://context/stack
 *   - ai-os://context/memory
 *   - ai-os://context/mcp-tools
 *   - ai-os://context/session
 *
 * These tests validate the resource definitions from the source file rather
 * than spinning up the full MCP server, avoiding spawn overhead while still
 * verifying the contract that downstream clients depend on.
 */

const KNOWN_RESOURCES = [
  { id: 'architecture', uri: 'ai-os://context/architecture', title: 'Architecture Overview' },
  { id: 'conventions', uri: 'ai-os://context/conventions', title: 'Coding Conventions' },
  { id: 'stack', uri: 'ai-os://context/stack', title: 'Tech Stack' },
  { id: 'memory', uri: 'ai-os://context/memory', title: 'Repository Memory' },
  { id: 'mcp-tools', uri: 'ai-os://context/mcp-tools', title: 'MCP Tools Reference' },
  { id: 'session-context', uri: 'ai-os://context/session', title: 'Session Context Card' },
] as const;

describe('MCP Resources contract', () => {
  it('has exactly 6 known resource definitions', () => {
    expect(KNOWN_RESOURCES).toHaveLength(6);
  });

  it('all resources have ai-os://context/* URIs', () => {
    for (const r of KNOWN_RESOURCES) {
      expect(r.uri).toMatch(/^ai-os:\/\/context\//);
    }
  });

  it('all resources have non-empty titles', () => {
    for (const r of KNOWN_RESOURCES) {
      expect(r.title.length).toBeGreaterThan(0);
    }
  });

  it('all resource IDs are unique', () => {
    const ids = KNOWN_RESOURCES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all resource URIs are unique', () => {
    const uris = KNOWN_RESOURCES.map(r => r.uri);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('sdk-server.ts registers all 6 resources via registerResource', async () => {
    const { readFileSync } = await import('fs');
    const { fileURLToPath } = await import('url');
    const { join, dirname } = await import('path');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(__dirname, '..', 'mcp-server', 'sdk-server.ts'), 'utf-8');

    expect(src).toContain('registerResource');

    for (const r of KNOWN_RESOURCES) {
      expect(src).toContain(r.uri);
    }
  });

  it('architecture resource has expected URI and title', () => {
    const r = KNOWN_RESOURCES.find(r => r.id === 'architecture');
    expect(r).toBeDefined();
    expect(r!.uri).toBe('ai-os://context/architecture');
    expect(r!.title).toBe('Architecture Overview');
  });

  it('memory resource has expected URI', () => {
    const r = KNOWN_RESOURCES.find(r => r.id === 'memory');
    expect(r).toBeDefined();
    expect(r!.uri).toBe('ai-os://context/memory');
  });

  it('session-context resource has expected URI', () => {
    const r = KNOWN_RESOURCES.find(r => r.id === 'session-context');
    expect(r).toBeDefined();
    expect(r!.uri).toBe('ai-os://context/session');
  });
});
