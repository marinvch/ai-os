import fs from 'node:fs';
import path from 'node:path';
import { mergeUserBlocks } from '../user-blocks.js';
import type { ConflictReport } from '../user-blocks.js';

/**
 * Parsed result of `.github/ai-os/protect.json`.
 *
 * - `protected` — whole-file shield: file is never overwritten or pruned.
 * - `hybrid`    — block-level merge: file is regenerated but
 *                 `<!-- AI-OS:USER_BLOCK:START id="..." -->` sections authored
 *                 by the user are preserved and re-inserted after generation.
 */
export interface ProtectConfig {
  protected: Set<string>;
  hybrid: Set<string>;
}

/**
 * Convert an unknown JSON array value into a Set of normalised forward-slash paths.
 * Non-array values and non-string elements are silently ignored.
 */
export function toPathSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    (value as unknown[])
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.replace(/\\/g, '/')),
  );
}

export function loadProtectConfig(cwd: string): ProtectConfig {
  const empty: ProtectConfig = { protected: new Set(), hybrid: new Set() };
  const protectPath = path.join(cwd, '.github', 'ai-os', 'protect.json');
  if (!fs.existsSync(protectPath)) return empty;
  try {
    const raw = JSON.parse(fs.readFileSync(protectPath, 'utf-8')) as {
      protected?: unknown;
      hybrid?: unknown;
    };

    return {
      protected: toPathSet(raw.protected),
      hybrid: toPathSet(raw.hybrid),
    };
  } catch {
    console.warn('  ⚠ Could not parse .github/ai-os/protect.json — ignoring protection config');
    return empty;
  }
}

/**
 * Directories whose contents are considered "custom artifacts" (user-created or user-edited).
 * Files under these paths are NOT pruned during refresh unless --prune-custom-artifacts is passed.
 */
const CUSTOM_ARTIFACT_DIRS = ['.github/agents/', '.agents/skills/'];

export function isCustomArtifact(relPath: string): boolean {
  return CUSTOM_ARTIFACT_DIRS.some((dir) => relPath.startsWith(dir));
}

export interface PruneOptions {
  cwd: string;
  shouldPrune: boolean;
  previousFiles: Set<string>;
  currentRelFiles: string[];
  protectedPaths: Set<string>;
  hybridPaths: Set<string>;
  protectedSnapshots: Map<string, string>;
  hybridSnapshots: Map<string, string>;
  pruneCustomArtifacts: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export interface PruneResult {
  pruned: string[];
  preserved: string[];
  conflicts: Array<ConflictReport & { file: string }>;
}

export function runPruneAndProtect(opts: PruneOptions): PruneResult {
  const {
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
  } = opts;

  const prunedAbs: string[] = [];
  const preservedAbs: string[] = [];

  if (shouldPrune && previousFiles.size > 0) {
    const currentSet = new Set(currentRelFiles);
    for (const rel of previousFiles) {
      if (!currentSet.has(rel)) {
        // Skip files protected by protect.json (full shield)
        if (protectedPaths.has(rel)) {
          if (verbose) console.log(`  🔒 protect  ${rel}  (in protect.json)`);
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        // Skip files in hybrid mode — they are managed but user blocks survive
        if (hybridPaths.has(rel)) {
          if (verbose)
            console.log(`  🔀 hybrid   ${rel}  (in protect.json hybrid — user blocks preserved)`);
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        // Skip custom artifacts unless --prune-custom-artifacts is passed
        if (!pruneCustomArtifacts && isCustomArtifact(rel)) {
          if (verbose) {
            console.log(
              `  🔒 preserve ${rel}  (custom artifact — pass --prune-custom-artifacts to remove)`,
            );
          }
          preservedAbs.push(path.join(cwd, rel));
          continue;
        }
        const abs = path.join(cwd, rel);
        if (fs.existsSync(abs)) {
          try {
            if (!dryRun) fs.rmSync(abs);
            prunedAbs.push(abs);
            if (verbose) {
              console.log(`  🗑️  prune   ${rel}  (stale — not in current generation)`);
            } else {
              console.log(`  🗑️  Pruned stale artifact: ${rel}`);
            }
          } catch {
            console.warn(`  ⚠ Could not prune: ${rel}`);
          }
        } else if (verbose) {
          console.log(`  🗑️  prune   ${rel}  (already missing, skipping delete)`);
        }
      }
    }
  }

  // Restore any files that were overwritten during generation despite being in protect.json.
  // This ensures protect.json guards both prune and write paths.
  if (!dryRun) {
    for (const [abs, originalContent] of protectedSnapshots) {
      if (!fs.existsSync(abs)) continue;
      const currentContent = fs.readFileSync(abs, 'utf-8');
      if (currentContent !== originalContent) {
        fs.writeFileSync(abs, originalContent, 'utf-8');
        const rel = path.relative(cwd, abs).replace(/\\/g, '/');
        if (verbose) console.log(`  🔒 restored ${rel}  (protect.json: overwrite reverted)`);
        if (!preservedAbs.some((p) => p === abs)) preservedAbs.push(abs);
      }
    }
  }

  // Apply hybrid-mode user-block merge: for each file in the hybrid list, merge
  // user blocks from the pre-generation snapshot back into the newly written content.
  const conflicts: Array<ConflictReport & { file: string }> = [];
  for (const [abs, snapshot] of hybridSnapshots) {
    if (!fs.existsSync(abs)) continue;
    const generated = fs.readFileSync(abs, 'utf-8');
    const {
      content: merged,
      preserved: mergedIds,
      conflicts: blockConflicts,
    } = mergeUserBlocks(generated, snapshot);
    if (mergedIds.length > 0 || blockConflicts.length > 0) {
      const rel = path.relative(cwd, abs).replace(/\\/g, '/');
      if (merged !== generated) {
        fs.writeFileSync(abs, merged, 'utf-8');
      }
      if (mergedIds.length > 0) {
        if (verbose) {
          console.log(
            `  🔀 merged   ${rel}  (${mergedIds.length} user block(s) preserved: ${mergedIds.join(', ')})`,
          );
        } else {
          console.log(`  🔀 Hybrid merge: ${mergedIds.length} user block(s) preserved in ${rel}`);
        }
      }
      for (const conflict of blockConflicts) {
        conflicts.push({ file: rel, ...conflict });
        console.warn(
          `  ⚠ Hybrid conflict in ${rel}: block "${conflict.blockId}" — ${conflict.detail}`,
        );
      }
    }
  }

  if (conflicts.length > 0) {
    console.log('');
    console.log(`  ⚠ ${conflicts.length} user block conflict(s) require manual reconciliation.`);
    console.log(
      '     Each block has been appended to its file wrapped in <!-- AI-OS:CONFLICT --> markers.',
    );
    console.log(
      '     Review and move them to the correct location, then remove the conflict markers.',
    );
    console.log('');
  }

  return { pruned: prunedAbs, preserved: preservedAbs, conflicts };
}
