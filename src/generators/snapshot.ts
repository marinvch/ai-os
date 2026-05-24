/**
 * snapshot.ts — Context versioning for AI OS.
 *
 * Before each refresh, captures a timestamped snapshot of the context files
 * under `.github/ai-os/snapshots/<timestamp>/`. Keeps the last N snapshots
 * and prunes older ones automatically.
 *
 * Directory snapshotted:
 *   .github/ai-os/context/           → snapshots/<ts>/context/
 *   .github/copilot-instructions.md  → snapshots/<ts>/copilot-instructions.md
 *   .github/COPILOT_CONTEXT.md       → snapshots/<ts>/COPILOT_CONTEXT.md
 */
import fs from 'node:fs';
import path from 'node:path';

export const SNAPSHOTS_DIR_REL = '.github/ai-os/snapshots';
const KEEP_LAST = 5;

/** Timestamp format safe for directory names on all platforms (no colons). */
function makeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
}

/** Recursively copy a directory, creating dest if needed. */
function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Copy a single file into dest directory, preserving the filename. */
function copyFileTo(src: string, destDir: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, path.basename(src)));
}

/**
 * Take a timestamped snapshot of the AI OS context files.
 *
 * @returns The absolute path of the created snapshot directory, or null if
 *   nothing was snapshotted (no context files exist yet).
 */
export function takeContextSnapshot(cwd: string, keepLast = KEEP_LAST): string | null {
  const contextDir = path.join(cwd, '.github', 'ai-os', 'context');
  if (!fs.existsSync(contextDir)) return null;

  const snapshotsRoot = path.join(cwd, SNAPSHOTS_DIR_REL);
  const ts = makeTimestamp();
  const snapshotDir = path.join(snapshotsRoot, ts);

  fs.mkdirSync(snapshotDir, { recursive: true });

  // Snapshot the context/ subdirectory.
  copyDirRecursive(contextDir, path.join(snapshotDir, 'context'));

  // Snapshot the top-level instruction files.
  copyFileTo(path.join(cwd, '.github', 'copilot-instructions.md'), snapshotDir);
  copyFileTo(path.join(cwd, '.github', 'COPILOT_CONTEXT.md'), snapshotDir);

  // Prune excess snapshots (oldest first).
  pruneOldSnapshots(snapshotsRoot, keepLast);

  return snapshotDir;
}

/**
 * List all snapshot directories in chronological order (oldest first).
 */
export function listSnapshots(cwd: string): string[] {
  const snapshotsRoot = path.join(cwd, SNAPSHOTS_DIR_REL);
  if (!fs.existsSync(snapshotsRoot)) return [];
  return fs.readdirSync(snapshotsRoot)
    .filter(name => fs.statSync(path.join(snapshotsRoot, name)).isDirectory())
    .sort(); // ISO timestamps sort lexicographically = chronologically
}

/**
 * Return the absolute path of the most recent snapshot, or null if none exist.
 */
export function latestSnapshot(cwd: string): string | null {
  const all = listSnapshots(cwd);
  if (all.length === 0) return null;
  return path.join(cwd, SNAPSHOTS_DIR_REL, all[all.length - 1]);
}

/**
 * Restore context files from a snapshot directory back to their live locations.
 * Returns a list of restored file paths (relative to cwd).
 */
export function restoreSnapshot(cwd: string, snapshotDir: string): string[] {
  const restored: string[] = [];

  // Restore context/ directory.
  const snapContext = path.join(snapshotDir, 'context');
  const liveContext = path.join(cwd, '.github', 'ai-os', 'context');
  if (fs.existsSync(snapContext)) {
    copyDirRecursive(snapContext, liveContext);
    for (const f of listFilesRecursive(snapContext)) {
      restored.push(path.relative(cwd, path.join(liveContext, path.relative(snapContext, f))).replace(/\\/g, '/'));
    }
  }

  // Restore top-level instruction files.
  for (const fname of ['copilot-instructions.md', 'COPILOT_CONTEXT.md']) {
    const src = path.join(snapshotDir, fname);
    const dest = path.join(cwd, '.github', fname);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      restored.push(path.relative(cwd, dest).replace(/\\/g, '/'));
    }
  }

  return restored;
}

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listFilesRecursive(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

function pruneOldSnapshots(snapshotsRoot: string, keepLast: number): void {
  if (!fs.existsSync(snapshotsRoot)) return;
  const dirs = fs.readdirSync(snapshotsRoot)
    .filter(name => fs.statSync(path.join(snapshotsRoot, name)).isDirectory())
    .sort();
  const toRemove = dirs.slice(0, Math.max(0, dirs.length - keepLast));
  for (const dir of toRemove) {
    try { fs.rmSync(path.join(snapshotsRoot, dir), { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
