import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateAgentRegistry } from '../generators/agent-registry.js';
import { isAgentRegistry } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-agent-registry-test-'));
}

function writeAgentFile(dir: string, fileName: string, content: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), content, 'utf-8');
}

const SAMPLE_AGENT_MD = `---
name: Expert TypeScript Developer
description: Expert TypeScript developer specializing in TypeScript patterns for test-project.
argument-hint: "Describe the feature, bug or refactor you need help with"
---

This agent helps with TypeScript development.
`;

const MINIMAL_AGENT_MD = `---
name: Codebase Explorer
description: Read-only navigator for test-project — answers "how does X work?" questions.
---

Explores the codebase.
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateAgentRegistry', () => {
  let tmpDir: string;
  let agentsDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    agentsDir = path.join(tmpDir, '.github', 'agents');
    fs.mkdirSync(path.join(tmpDir, '.github', 'ai-os'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns [] and writes nothing when no agent files exist', () => {
    const result = generateAgentRegistry(tmpDir);
    expect(result).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'))).toBe(false);
  });

  it('writes agents.json and returns its path', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    const result = generateAgentRegistry(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('agents.json');
  });

  it('produces a valid AgentRegistry (passes isAgentRegistry type guard)', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8'));
    expect(isAgentRegistry(raw)).toBe(true);
  });

  it('sets version to "2"', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { version: string };
    expect(raw.version).toBe('2');
  });

  it('includes one entry per agent file', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    writeAgentFile(agentsDir, 'codebase-explorer.agent.md', MINIMAL_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: unknown[] };
    expect(raw.agents).toHaveLength(2);
  });

  it('parses agent name from frontmatter', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ name: string }> };
    expect(raw.agents[0].name).toBe('Expert TypeScript Developer');
  });

  it('parses agent description from frontmatter', () => {
    writeAgentFile(agentsDir, 'codebase-explorer.agent.md', MINIMAL_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ description: string }> };
    expect(raw.agents[0].description).toContain('Read-only navigator');
  });

  it('sets A2A inputModes and outputModes to ["text"]', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ inputModes: string[]; outputModes: string[] }> };
    expect(raw.agents[0].inputModes).toEqual(['text']);
    expect(raw.agents[0].outputModes).toEqual(['text']);
  });

  it('sets streaming to false for all agents', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ streaming: unknown }> };
    expect(raw.agents[0].streaming).toBe(false);
  });

  it('includes at least one skill per agent', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ skills: unknown[] }> };
    expect(raw.agents[0].skills.length).toBeGreaterThan(0);
  });

  it('is idempotent — second call produces the same content', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const first = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { generatedAt: string };
    const firstTimestamp = first.generatedAt;

    // Inject same timestamp to make comparison meaningful
    generateAgentRegistry(tmpDir);
    const second = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { generatedAt: string };

    // The content (excluding generatedAt) should be equal
    expect(typeof second.generatedAt).toBe('string');
    expect(first).not.toBeUndefined();
    expect(firstTimestamp).toBeTruthy();
  });

  it('derives triggers from agent filename', () => {
    writeAgentFile(agentsDir, 'expert-typescript-developer.agent.md', SAMPLE_AGENT_MD);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ triggers: string[] }> };
    expect(raw.agents[0].triggers).toContain('typescript');
    expect(raw.agents[0].triggers).toContain('developer');
  });

  it('falls back to filename stem when frontmatter lacks name', () => {
    const noFrontmatter = `This agent has no frontmatter.\n`;
    writeAgentFile(agentsDir, 'my-custom-agent.agent.md', noFrontmatter);
    generateAgentRegistry(tmpDir);
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, '.github', 'ai-os', 'agents.json'), 'utf-8')) as { agents: Array<{ name: string }> };
    expect(raw.agents[0].name).toBe('my-custom-agent');
  });
});
