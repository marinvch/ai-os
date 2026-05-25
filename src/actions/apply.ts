import fs from 'node:fs';
import path from 'node:path';
import { analyze } from '../analyze.js';
import { generateInstructions } from '../generators/instructions.js';
import { generateMcpJson } from '../generators/mcp.js';
import { generateContextDocs, readAiOsConfig } from '../generators/context-docs.js';
import { generateAgents } from '../generators/agents.js';
import { generateSkills, deployBundledSkills } from '../generators/skills.js';
import { generatePrompts } from '../generators/prompts.js';
import { generateWorkflows } from '../generators/workflows.js';
import { generateToolsets } from '../generators/toolsets.js';
import { generateChatModes } from '../generators/chatmodes.js';
import { getMcpToolsForStack } from '../mcp-tools.js';
import {
  checkUpdateStatus,
  printUpdateBanner,
  getToolVersion,
  pruneLegacyArtifacts,
} from '../updater.js';
import { buildOnboardingPlan } from '../planner.js';
import {
  readManifest,
  writeManifest,
  getManifestPath,
  setVerboseMode,
  setDryRunMode,
  getDryRunCaptures,
  writeFileAtomic,
  setPrevHashes,
  getNewHashes,
} from '../generators/utils.js';
import { generateRecommendations, getSkillsGapReport } from '../recommendations/index.js';
import { applyProfile, describeProfile } from '../profile.js';
import { captureContextSnapshot, writeContextSnapshot } from '../detectors/freshness.js';
import { runBootstrap, formatBootstrapReport } from '../bootstrap.js';
import { runPlanAction } from './plan.js';
import { runPreviewAction } from './preview.js';
import { installLocalMcpRuntime } from './mcp-runtime.js';
import { printDryRunDiff } from '../lib/diff.js';
import { loadProtectConfig, runPruneAndProtect } from './apply-prune.js';
import {
  printSummary,
  printContextualNextSteps,
  printMemoryMaintenanceSummary,
  validateSkillRoutingCompleteness,
  printAgentFlowSetupPrompt,
  printAgentFlowStatus,
  autoInstallSuperpowers,
} from './apply-output.js';
import type { ParsedArgs, GenerateMode } from '../cli/args.js';

export async function runApply(args: ParsedArgs): Promise<void> {
  const {
    cwd,
    dryRun,
    mode: rawMode,
    action,
    prune: pruneFlag,
    verbose,
    cleanUpdate,
    regenerateContext,
    pruneCustomArtifacts,
    profile: cliProfile,
  } = args;
  let mode: GenerateMode = rawMode;

  // In --json mode, suppress all human-readable output so only the final JSON
  // object is written to stdout. Restore console.log before emitting it.
  const quiet = args.json;
  const _origConsoleLog = console.log;
  if (quiet) {
    console.log = () => {};
  }

  // Enable verbose per-file logging when --verbose / -v is passed
  if (verbose) {
    setVerboseMode(true);
    console.log('  🔍 Verbose mode enabled — per-file write/skip/prune reasons will be shown.\n');
  }

  console.log(`  📂 Scanning: ${cwd}`);
  console.log(`  🔧 Mode: ${mode}`);
  console.log(`  ▶️  Action: ${action}`);
  console.log('');

  // Version check — notify if installed artifacts are older than this tool
  const updateStatus = checkUpdateStatus(cwd);
  const installedVersionLabel = updateStatus.installedVersion ?? 'none';
  console.log(
    `  🩺 Diagnostics: tool=v${updateStatus.toolVersion}, installed=v${installedVersionLabel}, firstInstall=${updateStatus.isFirstInstall ? 'yes' : 'no'}, updateAvailable=${updateStatus.updateAvailable ? 'yes' : 'no'}`,
  );

  if (mode === 'update') {
    if (updateStatus.isFirstInstall) {
      console.log('  ℹ️  No existing AI OS installation found. Running fresh install...');
    } else if (updateStatus.updateAvailable) {
      console.log(
        `  🔄 Updating from v${updateStatus.installedVersion ?? '?'} → v${updateStatus.toolVersion}`,
      );
    } else {
      console.log(
        `  ✅ Already up-to-date (v${updateStatus.toolVersion}). Re-generating to refresh context...`,
      );
    }
    mode = 'refresh-existing';
  } else if (mode === 'safe' && !updateStatus.isFirstInstall) {
    printUpdateBanner(updateStatus);
  }

  // In refresh mode, curated context/instruction files are preserved by default.
  // Pass --regenerate-context to allow full rewrite of those files.
  const isRefresh = mode === 'refresh-existing';
  const preserveContextFiles = isRefresh && !regenerateContext;

  if (isRefresh && preserveContextFiles) {
    console.log('  🔒 Safe refresh: curated context/instruction files will be preserved.');
    console.log('     Pass --regenerate-context to allow full rewrite of those files.');
    console.log('');
  }

  // Prune legacy artifacts on every refresh/update run
  if (mode === 'refresh-existing') {
    pruneLegacyArtifacts(cwd, { fullCleanup: cleanUpdate });
  }

  // Load optional protection config for files that must never be overwritten/pruned.
  const protectConfig = loadProtectConfig(cwd);
  const protectedPaths = protectConfig.protected;
  const hybridPaths = protectConfig.hybrid;

  // Snapshot content of protect.json-listed files BEFORE generation so we can
  // restore them afterwards if a generator accidentally overwrites them.
  const protectedSnapshots = new Map<string, string>();
  for (const rel of protectedPaths) {
    const abs = path.join(cwd, rel);
    if (fs.existsSync(abs)) {
      protectedSnapshots.set(abs, fs.readFileSync(abs, 'utf-8'));
    }
  }
  if (isRefresh && protectedSnapshots.size > 0) {
    console.log(
      `  🔒 protect.json: ${protectedSnapshots.size} file(s) shielded against overwrite.`,
    );
    console.log('');
  }

  // Snapshot content of hybrid-mode files BEFORE generation so we can
  // re-insert user-authored blocks after the generator rewrites them.
  const hybridSnapshots = new Map<string, string>();
  if (isRefresh) {
    for (const rel of hybridPaths) {
      const abs = path.join(cwd, rel);
      if (fs.existsSync(abs)) {
        hybridSnapshots.set(abs, fs.readFileSync(abs, 'utf-8'));
      }
    }
    if (hybridSnapshots.size > 0) {
      console.log(
        `  🔀 protect.json: ${hybridSnapshots.size} file(s) in hybrid mode (user blocks will be preserved).`,
      );
      console.log('');
    }
  }

  const stack = analyze(cwd);
  // Track generation start time for summary duration
  const generationStartMs = Date.now();
  // Read existing config before generation to preserve user-editable fields
  const existingConfig = readAiOsConfig(cwd);
  const onboardingPlan = buildOnboardingPlan(cwd, mode, { regenerateContext });

  if (action === 'plan') {
    runPlanAction(onboardingPlan);
    return;
  }

  if (action === 'preview') {
    runPreviewAction(onboardingPlan);
    return;
  }

  if (dryRun) {
    if (action === 'bootstrap') {
      const report = runBootstrap(stack, { dryRun: true });
      console.log(formatBootstrapReport(report));
      return;
    }
    // Activate capture mode: writeIfChanged records planned writes without touching disk.
    setDryRunMode(true);
    console.log('  [DRY RUN] Detected stack:');
    console.log(JSON.stringify(stack, null, 2));
    console.log('');
    console.log('  [DRY RUN] Computing planned changes...');
    console.log('');
  }

  // Read previous manifest to allow pruning stale files (#7 / #8).
  const previousManifest = readManifest(cwd);
  const previousFiles = new Set(previousManifest?.files ?? []);
  // #115: seed the content-hash gate with hashes from the previous run
  // so writeIfChanged can skip disk reads for unchanged generated files.
  setPrevHashes(previousManifest?.hashes ?? {});

  // Phase 1: Core context files (config.json is written here, with user fields preserved)
  const contextFiles = generateContextDocs(stack, cwd, { preserveContextFiles });
  // Read the freshly-written config to get feature flags for remaining generators.
  // If a --profile flag was passed, apply it now (it overrides individual flags but is
  // written back into config.json so subsequent refreshes inherit the same density level).
  let config = readAiOsConfig(cwd) ?? existingConfig;

  // Resolve the effective profile: CLI flag > persisted config > none
  const effectiveProfile = cliProfile ?? config?.profile ?? null;
  if (effectiveProfile) {
    if (cliProfile) {
      console.log(`\n  🎛️  Applying profile: ${cliProfile}`);
      console.log(describeProfile(cliProfile));
      console.log('');
    }
    if (config) {
      config = applyProfile(config, effectiveProfile);
      // Persist the profile-applied config back to disk (skip in dry-run).
      if (!dryRun) {
        const configPath = path.join(cwd, '.github', 'ai-os', 'config.json');
        writeFileAtomic(configPath, JSON.stringify(config, null, 2) + '\n');
      }
    }
  }

  const skillsStrategy = config?.skillsStrategy ?? 'creator-only';
  const instructionFiles = generateInstructions(stack, cwd, {
    refreshExisting: mode === 'refresh-existing',
    preserveContextFiles,
    config: config ?? undefined,
  });
  const mcpFiles = generateMcpJson(stack, cwd, {
    refreshExisting: mode === 'refresh-existing',
    config: config ?? undefined,
  });

  // Phase 2: Agents, Skills, Prompts
  const agentFiles = await generateAgents(stack, cwd, {
    refreshExisting: mode === 'refresh-existing',
    preserveExistingAgents: preserveContextFiles,
    config: config ?? undefined,
  });
  const skillFiles = await generateSkills(stack, cwd, {
    refreshExisting: mode === 'refresh-existing',
    strategy: skillsStrategy,
  });
  const promptFiles = await generatePrompts(stack, cwd);
  const toolsetFiles = generateToolsets(stack, cwd);
  const chatModeFiles = generateChatModes(stack, cwd);
  const workflowFiles = generateWorkflows(cwd, { config: config ?? undefined });
  if (!dryRun) {
    await deployBundledSkills(cwd, { refreshExisting: mode === 'refresh-existing' });
  }

  console.log(`  🧠 Skills strategy: ${skillsStrategy}`);

  // Phase 3: Recommendations (if enabled in config, default: true)
  const recommendationFiles: string[] = [];
  if (config?.recommendations !== false) {
    const recPath = generateRecommendations(stack, cwd);
    recommendationFiles.push(recPath);
    // Skills gap report (stdout only, not written to disk)
    const skillsLockPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      'skills-lock.json',
    );
    const gapReport = getSkillsGapReport(stack, skillsLockPath);
    if (gapReport) console.log(`\n${gapReport}\n`);
  }

  // Collect all managed absolute paths and convert to repo-relative forward-slash keys.
  const allManagedAbs = [
    ...contextFiles,
    ...instructionFiles,
    ...mcpFiles,
    ...agentFiles,
    ...skillFiles,
    ...promptFiles,
    ...toolsetFiles,
    ...chatModeFiles,
    ...workflowFiles,
    ...recommendationFiles,
  ];
  const toRel = (p: string) => path.relative(cwd, p).replace(/\\/g, '/');
  const currentRelFiles = allManagedAbs.map(toRel);

  // Also track the manifest itself.
  const manifestRel = toRel(getManifestPath(cwd));
  currentRelFiles.push(manifestRel);

  // #7 / #8 — Prune stale files, restore protected files, apply hybrid-merge.
  //            Pruning only happens in refresh/update mode, or when --prune is explicit.
  const shouldPrune = pruneFlag || mode === 'refresh-existing';
  const { pruned: prunedAbs, preserved: preservedAbs } = runPruneAndProtect({
    cwd,
    shouldPrune,
    previousFiles,
    currentRelFiles,
    protectedPaths,
    hybridPaths,
    protectedSnapshots,
    hybridSnapshots,
    pruneCustomArtifacts,
    dryRun,
    verbose,
  });

  // Write updated manifest (#8 / #11).
  if (!dryRun) writeManifest(cwd, getToolVersion(), currentRelFiles, getNewHashes());

  // ── Capture context freshness snapshot ──────────────────────────────────
  // After a successful generation run, record a new baseline snapshot so that
  // future `--check-freshness` / `get_context_freshness` calls can detect drift.
  if (!dryRun) {
    try {
      const snapshot = captureContextSnapshot(cwd, getToolVersion());
      writeContextSnapshot(cwd, snapshot);
      if (verbose) {
        console.log('  ✏️  write   .github/ai-os/context-snapshot.json  (freshness baseline)');
      }
    } catch {
      // Non-fatal: freshness snapshot is best-effort
    }
  }

  // Diff counts for summary (#11).
  // A file is "written" when it exists but may have changed; we track via comparing
  // against previous manifest (new entry = written) plus the fact that writeIfChanged
  // inside generators only wrote when content differed. We use a simple heuristic:
  // files not in the previous manifest are "new" (written); the rest may be skipped or updated.
  const newFiles = currentRelFiles.filter((r) => r !== manifestRel && !previousFiles.has(r));
  const existingFiles = currentRelFiles.filter((r) => r !== manifestRel && previousFiles.has(r));

  if (!dryRun) installLocalMcpRuntime(cwd, verbose);

  // ── Dry-run diff output ───────────────────────────────────────────────────
  if (dryRun) {
    const captures = getDryRunCaptures();
    printDryRunDiff(cwd, captures, args.fullDiff);
    return;
  }

  if (isRefresh) {
    printMemoryMaintenanceSummary(cwd);
    validateSkillRoutingCompleteness(cwd);
  }

  if (quiet) {
    // Restore console.log and emit a single structured JSON object
    console.log = _origConsoleLog;
    const mcpToolCount = getMcpToolsForStack(stack).length;

    if (action === 'bootstrap') {
      const bootstrapReport = runBootstrap(stack, { dryRun: false });
      console.log(
        JSON.stringify({
          action: 'bootstrap',
          cwd,
          mode,
          project: stack.projectName,
          language: stack.primaryLanguage.name,
          frameworks: stack.frameworks.map((f) => f.name),
          packageManager: stack.patterns.packageManager,
          typescript: stack.patterns.hasTypeScript,
          profile: effectiveProfile ?? null,
          mcpToolCount,
          written: newFiles,
          skipped: existingFiles,
          pruned: prunedAbs.map((p) => path.relative(cwd, p).replace(/\\/g, '/')),
          agents: agentFiles,
          preserved: preservedAbs.map((p) => path.relative(cwd, p).replace(/\\/g, '/')),
          bootstrap: bootstrapReport,
        }),
      );
      return;
    }

    console.log(
      JSON.stringify({
        action,
        cwd,
        mode,
        project: stack.projectName,
        language: stack.primaryLanguage.name,
        frameworks: stack.frameworks.map((f) => f.name),
        packageManager: stack.patterns.packageManager,
        typescript: stack.patterns.hasTypeScript,
        profile: effectiveProfile ?? null,
        mcpToolCount,
        written: newFiles,
        skipped: existingFiles,
        pruned: prunedAbs.map((p) => path.relative(cwd, p).replace(/\\/g, '/')),
        agents: agentFiles,
        preserved: preservedAbs.map((p) => path.relative(cwd, p).replace(/\\/g, '/')),
      }),
    );
    return;
  }

  printSummary(
    stack,
    cwd,
    newFiles,
    existingFiles,
    prunedAbs,
    agentFiles,
    preservedAbs,
    effectiveProfile ?? undefined,
    Date.now() - generationStartMs,
  );
  printContextualNextSteps(mode, onboardingPlan, updateStatus, config?.recommendations !== false);

  // ── Bootstrap action: auto-install skills after full generation ──────────
  if (action === 'bootstrap') {
    console.log('  🚀 Running codebase-aware bootstrap...');
    console.log('');
    const bootstrapReport = runBootstrap(stack, { dryRun: false });
    console.log(formatBootstrapReport(bootstrapReport));
    return;
  }

  // ── Auto-install Superpowers skills on first install ─────────────────────
  // On a brand-new AI OS setup, install obra/superpowers agentic-methodology
  // skills automatically so users get the core workflow out of the box.
  // (On subsequent refreshes users can run `--bootstrap` for a full skill sync.)
  const isFirstInstall = updateStatus.isFirstInstall;
  if (!dryRun && isFirstInstall) {
    const spLockPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      'skills-lock.json',
    );
    autoInstallSuperpowers(stack, spLockPath);
  }

  // ── Agent-flow setup prompt ──────────────────────────────────────────────
  // On first install (no prior config) or when agentFlowMode is not explicitly
  // set, scan for existing agents and print a one-time setup suggestion.
  const agentFlowMode = config?.agentFlowMode;
  if (isFirstInstall || agentFlowMode === undefined) {
    printAgentFlowSetupPrompt(cwd, config?.agentFlowMode ?? null);
  }
  printAgentFlowStatus(cwd, config?.agentFlowMode ?? null);
}
