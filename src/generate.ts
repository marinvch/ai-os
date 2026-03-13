#!/usr/bin/env node
import path from 'node:path';
import { analyze } from './analyze.js';
import { generateInstructions } from './generators/instructions.js';
import { generateMcpJson } from './generators/mcp.js';
import { generateContextDocs } from './generators/context-docs.js';
import { generateAgents } from './generators/agents.js';
import { generateSkills } from './generators/skills.js';
import { generatePrompts } from './generators/prompts.js';

function parseArgs(): { cwd: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let cwd = process.cwd();
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { cwd, dryRun };
}

function printBanner(): void {
  console.log('');
  console.log('  ╔═══════════════════════════════════╗');
  console.log('  ║          AI OS  v0.2.0            ║');
  console.log('  ║  Portable Copilot Context Engine  ║');
  console.log('  ╚═══════════════════════════════════╝');
  console.log('');
}

function printSummary(
  stack: ReturnType<typeof analyze>,
  outputDir: string,
  agents: string[],
  skills: string[],
  promptsAdded: number,
): void {
  const fw = stack.frameworks.map(f => f.name).join(', ') || stack.primaryLanguage.name;
  console.log(`  📦 Project:    ${stack.projectName}`);
  console.log(`  🔤 Language:   ${stack.primaryLanguage.name} (${stack.primaryLanguage.percentage}%)`);
  console.log(`  🏗️  Framework:  ${fw}`);
  console.log(`  📦 Pkg Mgr:   ${stack.patterns.packageManager}`);
  console.log(`  🔷 TypeScript: ${stack.patterns.hasTypeScript ? 'Yes' : 'No'}`);
  console.log('');
  console.log('  Generated files:');
  console.log(`  ✅ .github/copilot-instructions.md`);
  console.log(`  ✅ .github/copilot/mcp.json (${5 + 5} tools)`);
  console.log(`  ✅ .ai-os/context/ (stack, architecture, conventions)`);

  if (agents.length > 0) {
    console.log(`  ✅ .github/agents/ → ${agents.length} new agent(s):`);
    for (const a of agents) console.log(`       • ${a}`);
  } else {
    console.log(`  ℹ️  .github/agents/ — all agents already exist, skipped`);
  }

  if (skills.length > 0) {
    console.log(`  ✅ .github/copilot/skills/ → ${skills.length} new skill(s):`);
    for (const s of skills) console.log(`       • ${s}`);
  } else {
    console.log(`  ℹ️  .github/copilot/skills/ — all skills already exist, skipped`);
  }

  if (promptsAdded > 0) {
    console.log(`  ✅ .github/copilot/prompts.json → +${promptsAdded} new prompt(s)`);
  } else {
    console.log(`  ℹ️  .github/copilot/prompts.json — all prompts already exist, skipped`);
  }

  console.log('');
  console.log('  🚀 AI OS installed! Open this repo in VS Code with GitHub Copilot enabled.');
  console.log(`  💡 Try @workspace, /new-page, /new-trpc-procedure, or any agent from Chat.`);
  console.log('');
}

async function main(): Promise<void> {
  printBanner();

  const { cwd, dryRun } = parseArgs();
  console.log(`  📂 Scanning: ${cwd}`);
  console.log('');

  const stack = analyze(cwd);

  if (dryRun) {
    console.log('  [DRY RUN] Detected stack:');
    console.log(JSON.stringify(stack, null, 2));
    return;
  }

  // Phase 1: Core context files
  generateContextDocs(stack, cwd);
  generateInstructions(stack, cwd);
  generateMcpJson(stack, cwd);

  // Phase 2: Agents, Skills, Prompts
  const agents = await generateAgents(stack, cwd);
  const skills = await generateSkills(stack, cwd);
  const promptsAdded = await generatePrompts(stack, cwd);

  printSummary(stack, cwd, agents, skills, promptsAdded);
}

main().catch(err => {
  console.error('  ❌ Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
