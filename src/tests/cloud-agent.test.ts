import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateCloudAgent } from '../generators/cloud-agent.js';
import type { DetectedStack, AiOsConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-cloud-agent-test-'));
}

function makeStack(overrides: Partial<DetectedStack> = {}): DetectedStack {
  return {
    projectName: 'test-project',
    primaryLanguage: { name: 'TypeScript', percentage: 80, fileCount: 10, extensions: ['.ts'] },
    languages: [],
    frameworks: [],
    patterns: {
      namingConvention: 'camelCase',
      packageManager: 'npm',
      hasTypeScript: true,
      hasDockerfile: false,
      hasCiCd: false,
      monorepo: false,
      srcDirectory: true,
    },
    keyFiles: ['package.json', 'README.md'],
    rootDir: '/tmp/project',
    allDependencies: [],
    buildCommands: {},
    ...overrides,
  } as DetectedStack;
}

function makeConfig(overrides: Partial<AiOsConfig> = {}): AiOsConfig {
  return {
    version: '0.21.0',
    installedAt: '2026-01-01T00:00:00Z',
    projectName: 'test',
    primaryLanguage: 'TypeScript',
    ...overrides,
  } as AiOsConfig;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateCloudAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.github'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns [] and writes nothing when cloudAgent is false/unset', () => {
    const result = generateCloudAgent(tmpDir, makeStack(), { config: makeConfig({ cloudAgent: false }) });
    expect(result).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'))).toBe(false);
  });

  it('returns [] when no config is provided', () => {
    const result = generateCloudAgent(tmpDir, makeStack());
    expect(result).toHaveLength(0);
  });

  it('returns the output file path when cloudAgent is true', () => {
    const result = generateCloudAgent(tmpDir, makeStack(), { config: makeConfig({ cloudAgent: true }) });
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('copilot-setup-steps.yml');
  });

  it('writes a valid YAML file to .github/copilot-setup-steps.yml', () => {
    generateCloudAgent(tmpDir, makeStack(), { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('steps:');
    expect(content).toContain('actions/setup-node');
  });

  it('includes npm ci install step for npm projects', () => {
    const stack = makeStack({ patterns: { ...makeStack().patterns, packageManager: 'npm' } });
    generateCloudAgent(tmpDir, stack, { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('npm ci');
  });

  it('includes pnpm setup step for pnpm projects', () => {
    const stack = makeStack({ patterns: { ...makeStack().patterns, packageManager: 'pnpm' } });
    generateCloudAgent(tmpDir, stack, { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('pnpm/action-setup');
    expect(content).toContain('pnpm install');
  });

  it('includes setup-python step for Python projects', () => {
    const stack = makeStack({
      primaryLanguage: { name: 'Python', percentage: 80, fileCount: 10, extensions: ['.py'] },
      patterns: { ...makeStack().patterns, packageManager: 'pip' },
    });
    generateCloudAgent(tmpDir, stack, { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('actions/setup-python');
    expect(content).toContain('pip install');
  });

  it('includes setup-go step for Go projects', () => {
    const stack = makeStack({
      primaryLanguage: { name: 'Go', percentage: 80, fileCount: 10, extensions: ['.go'] },
      patterns: { ...makeStack().patterns, packageManager: 'go' },
    });
    generateCloudAgent(tmpDir, stack, { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('actions/setup-go');
  });

  it('includes rust-toolchain step for Rust projects', () => {
    const stack = makeStack({
      primaryLanguage: { name: 'Rust', percentage: 80, fileCount: 10, extensions: ['.rs'] },
      patterns: { ...makeStack().patterns, packageManager: 'cargo' },
    });
    generateCloudAgent(tmpDir, stack, { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('dtolnay/rust-toolchain');
  });

  it('includes documentation header comment', () => {
    generateCloudAgent(tmpDir, makeStack(), { config: makeConfig({ cloudAgent: true }) });
    const content = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(content).toContain('Generated by AI OS');
    expect(content).toContain('copilot-setup-steps');
  });

  it('is idempotent — second call does not change file', () => {
    const stack = makeStack();
    const config = makeConfig({ cloudAgent: true });
    generateCloudAgent(tmpDir, stack, { config });
    const contentBefore = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    generateCloudAgent(tmpDir, stack, { config });
    const contentAfter = fs.readFileSync(path.join(tmpDir, '.github', 'copilot-setup-steps.yml'), 'utf-8');
    expect(contentBefore).toEqual(contentAfter);
  });
});
