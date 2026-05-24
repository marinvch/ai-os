import fs from 'node:fs';
import path from 'node:path';
import type { AgentRegistry, AgentRegistryEntry, A2ASkill } from '../types.js';
import { writeIfChanged } from './utils.js';

const AGENTS_DIR = '.github/agents';
const REGISTRY_PATH = '.github/ai-os/agents.json';

/**
 * YAML frontmatter parsed from a .agent.md file.
 * Only the fields AI OS uses are extracted; others are ignored.
 */
interface AgentFrontmatter {
  name?: string;
  description?: string;
  tools?: string[];
}

/**
 * Minimal YAML frontmatter parser.
 * Handles scalar strings, single-quoted strings, and string[] YAML arrays.
 * Does NOT handle multi-line values, anchors, or complex YAML.
 */
function parseFrontmatter(content: string): AgentFrontmatter {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};

  const block = match[1];
  const result: AgentFrontmatter = {};

  const nameMatch = /^name:\s*(.+)$/m.exec(block);
  if (nameMatch) result.name = nameMatch[1].replace(/^['"]|['"]$/g, '').trim();

  const descMatch = /^description:\s*(.+)$/m.exec(block);
  if (descMatch) result.description = descMatch[1].replace(/^['"]|['"]$/g, '').trim();

  const toolsMatch = /^tools:\s*\[([^\]]*)\]/m.exec(block);
  if (toolsMatch) {
    result.tools = toolsMatch[1]
      .split(',')
      .map(t => t.replace(/^['"\s]+|['"\s]+$/g, ''))
      .filter(Boolean);
  }

  return result;
}

/**
 * Derive trigger keywords from an agent filename.
 * "expert-typescript-developer.agent.md" → ["typescript", "developer", "expert"]
 */
function triggersFromFile(fileName: string): string[] {
  return fileName
    .replace('.agent.md', '')
    .split('-')
    .filter(w => w.length > 3 && !['agent', 'from', 'with', 'that', 'this', 'your'].includes(w));
}

/**
 * Derive capability strings from an agent's description and tools.
 */
function capabilitiesFromAgent(frontmatter: AgentFrontmatter): string[] {
  const caps: string[] = [];

  if (frontmatter.description) {
    // Extract noun phrases after key verbs to describe what the agent does
    const verbs = ['scan', 'validate', 'execute', 'implement', 'maintain', 'explore', 'migrate'];
    for (const verb of verbs) {
      const re = new RegExp(`${verb}\\s+(\\w+(?:\\s+\\w+)?)`, 'i');
      const m = re.exec(frontmatter.description);
      if (m) caps.push(m[1].toLowerCase());
    }
  }

  if (frontmatter.tools?.length) {
    caps.push(...frontmatter.tools.map(t => t.toLowerCase()));
  }

  return caps.length > 0 ? caps : ['general-assistance'];
}

/**
 * Map capabilities to A2A skill objects.
 */
function skillsFromCapabilities(capabilities: string[]): A2ASkill[] {
  return capabilities.map(cap => ({
    id: cap.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    name: cap
      .split(/[-\s]/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    tags: cap.split(/[-\s]/),
  }));
}

/**
 * Scan `.github/agents/*.agent.md` files, parse frontmatter, and build a
 * full A2A-compliant agent registry entry for each file.
 */
function buildRegistryEntries(agentsDir: string): AgentRegistryEntry[] {
  if (!fs.existsSync(agentsDir)) return [];

  const agentFiles = fs.readdirSync(agentsDir)
    .filter(f => f.endsWith('.agent.md'))
    .sort();

  return agentFiles.map((fileName): AgentRegistryEntry => {
    const filePath = path.join(agentsDir, fileName);
    const content = fs.readFileSync(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    const capabilities = capabilitiesFromAgent(fm);

    return {
      name: fm.name ?? fileName.replace('.agent.md', ''),
      file: fileName,
      description: fm.description ?? '',
      capabilities,
      triggers: triggersFromFile(fileName),
      inputModes: ['text'],
      outputModes: ['text'],
      streaming: false,
      skills: skillsFromCapabilities(capabilities),
    };
  });
}

/**
 * Generates `.github/ai-os/agents.json` — a full A2A-compliant AgentCard registry
 * derived from all `.agent.md` files found in `.github/agents/`.
 *
 * The registry is written on every AI OS run (not gated behind a config flag)
 * because it is a core artifact consumed by the drift detector and MCP tools.
 *
 * @returns Array containing the absolute path of the written registry file,
 *          or an empty array if no agent files are found.
 */
export function generateAgentRegistry(cwd: string): string[] {
  const agentsDir = path.join(cwd, AGENTS_DIR);
  const entries = buildRegistryEntries(agentsDir);

  if (entries.length === 0) return [];

  const registry: AgentRegistry = {
    version: '2',
    generatedAt: new Date().toISOString(),
    agents: entries,
  };

  const registryPath = path.join(cwd, REGISTRY_PATH);
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  writeIfChanged(registryPath, JSON.stringify(registry, null, 2) + '\n');

  return [registryPath];
}
