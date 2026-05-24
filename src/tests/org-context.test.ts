import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fetchOrgContext } from '../generators/org-context.js';
import type { AiOsConfig } from '../types.js';

const BASE_CONFIG = {
  version: '0.21.0',
  installedAt: '2024-01-01T00:00:00Z',
  projectName: 'test',
  primaryLanguage: 'TypeScript',
  packageManager: 'npm',
  hasTypeScript: true,
  persistentRules: [],
  exclude: [],
} as unknown as AiOsConfig;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aios-org-ctx-test-'));
}

function makeConfig(orgContextRepo?: string): AiOsConfig {
  return { ...BASE_CONFIG, orgContextRepo } as unknown as AiOsConfig;
}

function mockFetch(statusCode: number, body: string): typeof globalThis.fetch {
  return async (url: string | URL | Request) => {
    return {
      ok: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      text: async () => body,
    } as unknown as Response;
  };
}

function mockFetchMap(map: Record<string, { status: number; body: string }>): typeof globalThis.fetch {
  return async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const entry = map[url];
    if (!entry) {
      return { ok: false, status: 404, text: async () => 'not found' } as unknown as Response;
    }
    return { ok: entry.status >= 200 && entry.status < 300, status: entry.status, text: async () => entry.body } as unknown as Response;
  };
}

function mockFetchThrows(): typeof globalThis.fetch {
  return async () => {
    throw new Error('network error');
  };
}

describe('fetchOrgContext', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.github', 'ai-os', 'context'), { recursive: true });
  });

  it('returns [] when orgContextRepo is not set', async () => {
    const result = await fetchOrgContext(tmpDir, { config: makeConfig(undefined) });
    expect(result).toEqual([]);
  });

  it('returns [] when config is undefined', async () => {
    const result = await fetchOrgContext(tmpDir, {});
    expect(result).toEqual([]);
  });

  it('fetches conventions/shared.md first', async () => {
    const fetched: string[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).href;
      fetched.push(url);
      return { ok: true, status: 200, text: async () => '# Shared conventions' } as unknown as Response;
    };

    const result = await fetchOrgContext(tmpDir, { config: makeConfig('acme-org/ai-os-context'), fetch });
    expect(result).toHaveLength(1);
    expect(fetched[0]).toBe('https://raw.githubusercontent.com/acme-org/ai-os-context/HEAD/conventions/shared.md');
  });

  it('falls back to instructions/shared.md when conventions/shared.md returns 404', async () => {
    const fetched: string[] = [];
    const fetch = mockFetchMap({
      'https://raw.githubusercontent.com/acme-org/ai-os-context/HEAD/conventions/shared.md': { status: 404, body: 'not found' },
      'https://raw.githubusercontent.com/acme-org/ai-os-context/HEAD/instructions/shared.md': { status: 200, body: '# Shared instructions' },
    });
    const wrappedFetch: typeof globalThis.fetch = async (input) => {
      const url = typeof input === 'string' ? input : (input as URL).href;
      fetched.push(url);
      return fetch(url);
    };

    const result = await fetchOrgContext(tmpDir, { config: makeConfig('acme-org/ai-os-context'), fetch: wrappedFetch });
    expect(result).toHaveLength(1);
    expect(fetched).toContain('https://raw.githubusercontent.com/acme-org/ai-os-context/HEAD/instructions/shared.md');
  });

  it('writes org-context.md with [org] markers', async () => {
    const fetch = mockFetch(200, '# Team Conventions\nAlways test your code.');

    const result = await fetchOrgContext(tmpDir, { config: makeConfig('acme-org/ai-os-context'), fetch });
    expect(result).toHaveLength(1);

    const content = fs.readFileSync(result[0]!, 'utf8');
    expect(content).toContain('<!-- [org]');
    expect(content).toContain('<!-- [org:end] -->');
    expect(content).toContain('Shared from acme-org/ai-os-context');
    expect(content).toContain('# Team Conventions');
    expect(content).toContain('Always test your code.');
  });

  it('returns [] when all fetch paths fail', async () => {
    const fetch = mockFetch(404, 'not found');
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('acme-org/ai-os-context'), fetch });
    expect(result).toEqual([]);
  });

  it('returns [] without throwing on network error', async () => {
    const fetch = mockFetchThrows();
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('acme-org/ai-os-context'), fetch });
    expect(result).toEqual([]);
  });

  it('is idempotent — re-running overwrites same file', async () => {
    const fetch1 = mockFetch(200, '# Version 1');
    const fetch2 = mockFetch(200, '# Version 2');

    await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch: fetch1 });
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch: fetch2 });

    const content = fs.readFileSync(result[0]!, 'utf8');
    expect(content).toContain('# Version 2');
    expect(content).not.toContain('# Version 1');
  });

  it('returns the absolute path to org-context.md', async () => {
    const fetch = mockFetch(200, '# Content');
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch });

    expect(result[0]).toBe(path.join(tmpDir, '.github', 'ai-os', 'context', 'org-context.md'));
    expect(path.isAbsolute(result[0]!)).toBe(true);
  });

  it('includes source URL in generated file header', async () => {
    const fetch = mockFetch(200, '# Content');
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch });

    const content = fs.readFileSync(result[0]!, 'utf8');
    expect(content).toContain('<!-- Source:');
    expect(content).toContain('raw.githubusercontent.com/org/repo');
  });

  it('includes disable instructions in generated file header', async () => {
    const fetch = mockFetch(200, '# Content');
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch });

    const content = fs.readFileSync(result[0]!, 'utf8');
    expect(content).toContain('orgContextRepo');
  });

  it('includes timestamp in generated file header', async () => {
    const fetch = mockFetch(200, '# Content');
    const result = await fetchOrgContext(tmpDir, { config: makeConfig('org/repo'), fetch });

    const content = fs.readFileSync(result[0]!, 'utf8');
    // ISO timestamp YYYY-MM-DD pattern
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('returns [] when fetch function is not available', async () => {
    const result = await fetchOrgContext(tmpDir, {
      config: makeConfig('org/repo'),
      fetch: undefined as unknown as typeof globalThis.fetch,
    });
    expect(result).toEqual([]);
  });
});
