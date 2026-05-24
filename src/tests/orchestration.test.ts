import { describe, it, expect } from 'vitest';
import type { AgentRegistryEntry, AgentRegistry } from '../types.js';
import { isAgentRegistry } from '../types.js';

const validEntry: AgentRegistryEntry = {
  name: 'Payments Expert',
  file: 'expert-payments.agent.md',
  description: 'Stripe billing expert.',
  capabilities: ['stripe', 'checkout', 'webhooks'],
  triggers: ['stripe', 'payment', 'billing'],
  inputModes: ['text'],
  outputModes: ['text'],
  streaming: false,
  skills: [{ id: 'stripe', name: 'Stripe', tags: ['stripe'] }],
};

describe('AgentRegistryEntry type shape', () => {
  it('accepts a valid entry object', () => {
    expect(validEntry.name).toBe('Payments Expert');
    expect(validEntry.file).toBe('expert-payments.agent.md');
    expect(validEntry.capabilities).toHaveLength(3);
    expect(validEntry.triggers).toHaveLength(3);
    expect(validEntry.inputModes).toEqual(['text']);
    expect(validEntry.outputModes).toEqual(['text']);
    expect(validEntry.streaming).toBe(false);
    expect(validEntry.skills).toHaveLength(1);
  });

  it('accepts a valid registry object', () => {
    const registry: AgentRegistry = {
      version: '2',
      generatedAt: '2026-05-11T00:00:00.000Z',
      agents: [],
    };
    expect(registry.version).toBe('2');
    expect(Array.isArray(registry.agents)).toBe(true);
  });
});

describe('isAgentRegistry', () => {
  it('returns true for a valid registry', () => {
    expect(
      isAgentRegistry({
        version: '2',
        generatedAt: '2026-05-11T00:00:00.000Z',
        agents: [validEntry],
      })
    ).toBe(true);
  });

  it('returns true for empty agents array', () => {
    expect(
      isAgentRegistry({ version: '2', generatedAt: '2026-05-11', agents: [] })
    ).toBe(true);
  });

  it('returns false for null', () => {
    expect(isAgentRegistry(null)).toBe(false);
  });

  it('returns false for version 1 (legacy schema)', () => {
    expect(
      isAgentRegistry({ version: '1', generatedAt: '2026-05-11', agents: [] })
    ).toBe(false);
  });

  it('returns false when agents is not an array', () => {
    expect(
      isAgentRegistry({ version: '2', generatedAt: '2026-05-11', agents: {} })
    ).toBe(false);
  });

  it('returns false when an agent entry is missing A2A fields', () => {
    expect(
      isAgentRegistry({
        version: '2',
        generatedAt: '2026-05-11',
        agents: [{ name: 'Incomplete', file: 'x.agent.md', description: '', capabilities: [], triggers: [] }],
      })
    ).toBe(false);
  });

  it('returns false when streaming is not false', () => {
    expect(
      isAgentRegistry({
        version: '2',
        generatedAt: '2026-05-11',
        agents: [{ ...validEntry, streaming: true }],
      })
    ).toBe(false);
  });
});
