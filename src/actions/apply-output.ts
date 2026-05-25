import fs from 'node:fs';
import path from 'node:path';
import { analyze } from '../analyze.js';
import { getMcpToolsForStack } from '../mcp-tools.js';
import { getManifestPath } from '../generators/utils.js';
import { buildGenerationSummary, formatGenerationSummary } from './summary.js';
import { computeFreshnessReport } from '../detectors/freshness.js';
import { runMemoryMaintenance } from '../mcp-server/utils.js';
import { scanExistingAgents } from '../generators/agents.js';
import { collectRecommendations } from '../recommendations/index.js';
import { installSkill } from '../bootstrap.js';
import type { GenerateMode } from '../cli/args.js';
import type { OnboardingPlan } from '../planner.js';
import type { UpdateStatus } from '../updater.js';

export function printSummary(
  stack: ReturnType<typeof analyze>,
  outputDir: string,
  written: string[],
  skipped: string[],
  pruned: string[],
  agents: string[],
  preserved: string[],
  activeProfile?: string,
  durationMs?: number,
): void {
  const mcpToolCount = getMcpToolsForStack(stack).length;
  const fw = stack.frameworks.map((f) => f.name).join(', ') || stack.primaryLanguage.name;
  console.log(`  📦 Project:    ${stack.projectName}`);
  console.log(
    `  🔤 Language:   ${stack.primaryLanguage.name} (${stack.primaryLanguage.percentage}%)`,
  );
  console.log(`  🏗️  Framework:  ${fw}`);
  console.log(`  📦 Pkg Mgr:   ${stack.patterns.packageManager}`);
  console.log(`  🔷 TypeScript: ${stack.patterns.hasTypeScript ? 'Yes' : 'No'}`);
  if (activeProfile) {
    console.log(`  🎛️  Profile:    ${activeProfile}`);
  }
  console.log('');
  console.log('  Diff summary:');
  const summary = buildGenerationSummary({
    written,
    skipped,
    pruned: pruned.map((p) => p),
    preserved,
    durationMs: durationMs ?? 0,
  });
  console.log(formatGenerationSummary(summary));
  if (preserved.length > 0) {
    for (const p of preserved)
      console.log(`       • ${path.relative(outputDir, p).replace(/\\/g, '/')}`);
  }
  if (pruned.length > 0) {
    for (const p of pruned)
      console.log(`       • ${path.relative(outputDir, p).replace(/\\/g, '/')}`);
  }
  if (agents.length > 0) {
    console.log(`  🤖 Agents generated: ${agents.length}`);
  }
  console.log(`  🔧 MCP tools registered: ${mcpToolCount}`);
  console.log(
    `  🗳️  Manifest: ${path.relative(outputDir, getManifestPath(outputDir)).replace(/\\/g, '/')}`,
  );
  // Print previous freshness score (before this run's snapshot is written) to show drift
  try {
    const prevReport = computeFreshnessReport(outputDir);
    if (prevReport.status !== 'unknown') {
      const scorePercent = Math.round(prevReport.score * 100);
      const statusEmoji: Record<string, string> = { fresh: '✅', drifted: '⚠️', stale: '❌' };
      const emoji = statusEmoji[prevReport.status] ?? '❓';
      console.log(
        `  ${emoji} Context freshness (pre-run): ${scorePercent}/100 (${prevReport.status})`,
      );
      if (prevReport.staleArtifacts.length > 0) {
        console.log(`     Stale artifacts: ${prevReport.staleArtifacts.join(', ')}`);
      }
      if (prevReport.changedSourceFiles.length > 0) {
        console.log(`     Changed sources: ${prevReport.changedSourceFiles.join(', ')}`);
      }
    }
  } catch {
    /* non-fatal */
  }
  console.log('');
}

export function printContextualNextSteps(
  mode: GenerateMode,
  onboardingPlan: OnboardingPlan,
  updateStatus: UpdateStatus,
  recommendationsEnabled: boolean,
): void {
  const refreshCmd = `npx -y "github:marinvch/ai-os#v${updateStatus.latestVersion}" --refresh-existing`;
  const recommendationsPath = '.github/ai-os/recommendations.md';

  const printInstructionStrategy = (): void => {
    console.log('  📌 First action after install/refresh:');
    console.log(
      '     Review and optimize .github/copilot-instructions.md before asking Copilot to implement changes.',
    );

    if (onboardingPlan.detectedRepoType === 'new') {
      console.log('  🆕 Strategy for new project:');
      console.log(
        '     Build a baseline context first (stack, conventions, architecture), then keep instructions concise and task-agnostic.',
      );
      console.log('     Use AI OS MCP tools to fill context as the codebase grows.');
      return;
    }

    console.log('  🏗️  Strategy for existing/large project:');
    console.log(
      '     Compare current instructions against real project state and patch missing context before feature work.',
    );
    console.log(
      '     Prioritize architecture, build/test flow, and known pitfalls to reduce tool failures and rework.',
    );
  };

  const printRecommendationsHint = (): void => {
    if (recommendationsEnabled) {
      console.log(`  📘 Recommendations saved to ${recommendationsPath}`);
    }
  };

  if (mode === 'safe' && updateStatus.updateAvailable && !updateStatus.isFirstInstall) {
    console.log('  🧭 Recommended next step:');
    console.log(`  ${refreshCmd}`);
    console.log(
      '  Safe mode updated local MCP/runtime wiring, but left existing AI OS context artifacts in place.',
    );
    printInstructionStrategy();
    console.log('  After refresh, ask Copilot:');
    console.log(
      '     "Use all AI OS MCP tools, inspect this codebase, and improve the AI context files."',
    );
    printRecommendationsHint();
    console.log('');
    return;
  }

  if (mode === 'refresh-existing' || mode === 'update') {
    console.log('  ✅ Ready to use with Copilot.');
    printInstructionStrategy();
    console.log('  If the tools do not appear immediately, run: MCP: Restart Servers');
    console.log('  Suggested first prompt:');
    console.log(
      '     "Open and optimize .github/copilot-instructions.md for this repo state, then use AI OS MCP tools to review architecture, conventions, and missing context gaps."',
    );
    printRecommendationsHint();
    console.log('');
    return;
  }

  const firstPrompt =
    onboardingPlan.detectedRepoType === 'existing-non-ai-os'
      ? 'Use AI OS MCP tools to map this codebase, compare the existing instructions with generated context, and improve the AI context files.'
      : 'Use all AI OS MCP tools, inspect this codebase, and improve the AI context files.';

  console.log('  🧭 Next steps:');
  console.log('  1. Open this repo in VS Code with GitHub Copilot Agent mode enabled.');
  console.log(
    '  2. Review and optimize .github/copilot-instructions.md for the current project state.',
  );
  if (onboardingPlan.detectedRepoType === 'new') {
    console.log(
      '     New project strategy: bootstrap minimal context first, then expand instructions as the codebase evolves.',
    );
  } else {
    console.log(
      '     Existing/large project strategy: fill missing context first (architecture, build/test flow, pitfalls), then proceed with implementation.',
    );
  }
  console.log('  3. If the tools do not appear immediately, run: MCP: Restart Servers');
  console.log('  4. Suggested first prompt:');
  console.log(`     "${firstPrompt}"`);
  printRecommendationsHint();
  console.log('');
}

/**
 * Print the one-time agent-flow setup prompt.
 */
export function printAgentFlowSetupPrompt(
  cwd: string,
  currentMode: 'create' | 'hook' | 'skip' | null,
): void {
  const scan = scanExistingAgents(cwd);
  const hasUserAgents = scan.userDefined.length > 0;

  // Skip prompt if the user already set a mode (other than first-run undefined)
  if (currentMode !== null) return;

  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  🤖 Sequential Agent Flow — Setup                           │');
  console.log('  │                                                             │');
  console.log('  │  AI OS can generate a 3-agent sequential improvement flow:  │');
  console.log('  │                                                             │');
  console.log('  │   1. Feature Enhancement Advisor  (finds improvements)     │');
  console.log('  │      ↓                                                      │');
  console.log('  │   2. Idea Validator               (confirms before coding)  │');
  console.log('  │      ↓                                                      │');
  console.log('  │   3. Implementation Agent         (executes validated plan)  │');
  console.log('  │                                                             │');
  if (hasUserAgents) {
    console.log(
      `  │  Existing agents detected: ${scan.userDefined.join(', ').slice(0, 38).padEnd(38)} │`,
    );
    console.log('  │                                                             │');
    console.log('  │  Choose an option in .github/ai-os/config.json:            │');
    console.log('  │    "agentFlowMode": "create"  — add the 3 agents (default) │');
    console.log('  │    "agentFlowMode": "hook"    — guide to link to existing   │');
    console.log('  │    "agentFlowMode": "skip"    — do not generate agents      │');
  } else {
    console.log('  │  No existing agents found — the 3 agents will be created.  │');
    console.log('  │  Set "agentFlowMode": "skip" in config.json to opt out.    │');
  }
  console.log('  │                                                             │');
  console.log('  │  Already created: .github/agents/feature-enhancement-advisor.agent.md │');
  console.log('  │                   .github/agents/idea-validator.agent.md    │');
  console.log('  │                   .github/agents/implementation-agent.agent.md │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');

  if (currentMode === 'hook' && hasUserAgents) {
    printAgentHookGuide(scan.userDefined);
  }
}

export function printAgentHookGuide(userDefinedAgents: string[]): void {
  console.log('  📎 Hook Guide — connecting your existing agents to the ai-os flow:');
  console.log('');
  for (const agent of userDefinedAgents) {
    console.log(`     ${agent}`);
    console.log(
      '       → Add a "Handoff" section pointing to feature-enhancement-advisor.agent.md',
    );
    console.log('         or idea-validator.agent.md as the next step in your workflow.');
  }
  console.log('');
  console.log('  Example handoff to add at the bottom of an existing agent:');
  console.log('');
  console.log('     ## Handoff');
  console.log('     When analysis is complete, pass the findings to the');
  console.log('     **Idea Validator** agent for cross-checking before implementation.');
  console.log('');
}

export function printAgentFlowStatus(cwd: string, mode: 'create' | 'hook' | 'skip' | null): void {
  const scan = scanExistingAgents(cwd);
  const flowFiles = [
    'feature-enhancement-advisor.agent.md',
    'idea-validator.agent.md',
    'implementation-agent.agent.md',
  ];
  const present = flowFiles.filter(
    (f) => scan.aiOsGenerated.includes(f) || scan.userDefined.includes(f),
  );
  const activeMode = mode ?? 'create';

  console.log('  🤖 Agent flow status:');
  console.log(`     agent flow mode: ${activeMode}`);
  console.log(`     flow agents present: ${present.length}/3`);
  if (present.length > 0) {
    console.log(`     detected: ${present.join(', ')}`);
  }
  if (activeMode === 'hook') {
    console.log(
      '     hook mode enabled — AI OS will keep your existing agents and print handoff guidance.',
    );
  } else if (activeMode === 'skip') {
    console.log(
      '     skip mode enabled — set agentFlowMode to "create" in .github/ai-os/config.json to enable flow agents.',
    );
  }
  console.log('');
}

/**
 * Print a memory maintenance summary during refresh/update runs.
 * This is a non-destructive read-only hygiene report (does not modify the file).
 */
export function printMemoryMaintenanceSummary(cwd: string): void {
  const memoryFile = path.join(cwd, '.github', 'ai-os', 'memory', 'memory.jsonl');
  if (!fs.existsSync(memoryFile)) return;

  try {
    process.env['AI_OS_ROOT'] = cwd;
    const summary = runMemoryMaintenance();

    if (summary.totalBefore === 0) return;

    console.log('  🧠 Memory maintenance:');
    console.log(`     Active entries:       ${summary.activeAfter}`);
    if (summary.staleMarked > 0) {
      console.log(
        `     Stale entries found:  ${summary.staleMarked} (run --compact-memory to remove)`,
      );
    }
    if (summary.nearDuplicatesMarked > 0) {
      console.log(`     Near-duplicates:      ${summary.nearDuplicatesMarked}`);
    }
    if (summary.malformedSkipped > 0) {
      console.log(
        `     Malformed lines:      ${summary.malformedSkipped} (will be removed on next write)`,
      );
    }
    console.log('');
  } catch {
    // Best-effort — never fail a refresh run due to memory reporting.
  }
}

/**
 * Validate skill routing completeness: check all skill files in .github/copilot/skills/
 * and warn if any are missing required frontmatter (name/description) that would cause
 * them to be silently excluded from the prompt-quality.instructions.md routing table.
 */
export function validateSkillRoutingCompleteness(cwd: string): void {
  const skillsDir = path.join(cwd, '.github', 'copilot', 'skills');
  if (!fs.existsSync(skillsDir)) return;

  const issues: string[] = [];
  try {
    for (const file of fs.readdirSync(skillsDir)) {
      if (!file.endsWith('.md')) continue;
      try {
        const raw = fs.readFileSync(path.join(skillsDir, file), 'utf-8');
        const hasName = /^name:\s*.+$/m.test(raw);
        const hasDescription = /^description:\s*.+$/m.test(raw);
        if (!hasName || !hasDescription) {
          const missing = [!hasName && 'name', !hasDescription && 'description']
            .filter(Boolean)
            .join(', ');
          issues.push(`     ⚠️  ${file} — missing frontmatter: ${missing}`);
        }
      } catch {
        issues.push(`     ⚠️  ${file} — unreadable`);
      }
    }
  } catch {
    return; // Non-fatal
  }

  if (issues.length > 0) {
    console.log('  🔍 Skill routing validation:');
    for (const issue of issues) console.log(issue);
    console.log(
      '     Skills with missing frontmatter are excluded from routing in prompt-quality.instructions.md',
    );
    console.log('');
  }
}

/**
 * Print the Superpowers harness-level plugin install instructions.
 * Shown on first install so users know how to activate the full plugin experience.
 */
export function printSuperpowersPluginSetup(): void {
  console.log('  📎 Superpowers plugin — activate in your agent harness:');
  console.log('');
  console.log('     GitHub Copilot CLI:');
  console.log('       copilot plugin marketplace add obra/superpowers-marketplace');
  console.log('       copilot plugin install superpowers@superpowers-marketplace');
  console.log('');
  console.log('     Claude Code (official marketplace):');
  console.log('       /plugin install superpowers@claude-plugins-official');
  console.log('');
  console.log('     Cursor:  /add-plugin superpowers');
  console.log('     Gemini:  gemini extensions install https://github.com/obra/superpowers');
  console.log('');
}

/**
 * Auto-install Superpowers skills (obra/superpowers-sourced universal skills) on first install.
 * Idempotent: reads skills-lock.json and skips skills already installed.
 * Gives every AI OS project the core agentic development methodology out of the box.
 */
export function autoInstallSuperpowers(
  stack: ReturnType<typeof analyze>,
  skillsLockPath: string,
): void {
  const recs = collectRecommendations(stack);
  const allSuperpowers = recs.universalSkills.filter((s) => s.source === 'obra/superpowers');

  if (allSuperpowers.length === 0) return;

  // Read installed skills from lock file to skip already-installed ones
  let installedSet = new Set<string>();
  try {
    const lock = JSON.parse(fs.readFileSync(skillsLockPath, 'utf-8')) as {
      skills?: string[] | Record<string, unknown>;
    };
    const names = Array.isArray(lock.skills) ? lock.skills : Object.keys(lock.skills ?? {});
    installedSet = new Set(names.map((n) => n.toLowerCase()));
  } catch {
    // Lock file missing — treat all as uninstalled
  }

  const toInstall = allSuperpowers.filter((s) => !installedSet.has(s.name.toLowerCase()));
  const alreadyInstalled = allSuperpowers.length - toInstall.length;

  if (toInstall.length === 0) {
    console.log('  🦸 All Superpowers skills already installed.');
    console.log('');
    return;
  }

  console.log('');
  console.log('  ┌────────────────────────────────────────────────────────────────────┐');
  console.log('  │  🦸 Superpowers — Agentic Development Methodology                  │');
  console.log('  │                                                                    │');
  console.log('  │  Auto-installing core Superpowers skills for your coding agent...  │');
  console.log('  └────────────────────────────────────────────────────────────────────┘');
  console.log('');

  if (alreadyInstalled > 0) {
    console.log(`  ✅ ${alreadyInstalled} skill(s) already installed — skipping.`);
  }

  const results: Array<{ name: string; success: boolean; error?: string }> = [];
  for (const skill of toInstall) {
    const result = installSkill(skill.name, skill.source);
    results.push({ name: skill.name, ...result });
    const icon = result.success ? '  ✅' : '  ⚠️ ';
    const label = result.success
      ? skill.name
      : `${skill.name}  (${result.error ?? 'install failed'})`;
    console.log(`${icon} ${label}`);
  }

  console.log('');
  const installed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (installed > 0) {
    console.log(`  ✅ ${installed} Superpowers skill(s) installed.`);
  }
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} skill(s) could not be auto-installed. Run manually:`);
    for (const r of results.filter((r) => !r.success)) {
      console.log(`     npx -y skills add obra/superpowers@${r.name} -g -a github-copilot`);
    }
  }
  console.log('');
  printSuperpowersPluginSetup();
}
