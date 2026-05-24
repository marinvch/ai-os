import path from 'node:path';
import { listSnapshots, latestSnapshot, restoreSnapshot, SNAPSHOTS_DIR_REL } from '../generators/snapshot.js';

/**
 * Rollback action — restores the most recent context snapshot.
 *
 * Prints the available snapshots, then restores the latest one (or the one
 * specified via `snapshotName`).
 */
export function runRollbackAction(
  cwd: string,
  opts: { snapshotName?: string; json?: boolean } = {},
): void {
  const snapshots = listSnapshots(cwd);

  if (snapshots.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ action: 'rollback', status: 'no-snapshots', cwd, restored: [] }));
    } else {
      console.log('  ℹ️  No snapshots found. Run a refresh first to create one.');
      console.log(`     Snapshots are stored in: ${SNAPSHOTS_DIR_REL}`);
    }
    return;
  }

  const targetName = opts.snapshotName ?? snapshots[snapshots.length - 1];
  const snapshotsRoot = path.join(cwd, SNAPSHOTS_DIR_REL);
  const snapshotDir = path.join(snapshotsRoot, targetName);

  if (!opts.json) {
    console.log(`  📦 Available snapshots (${snapshots.length}):`);
    for (const s of [...snapshots].reverse()) {
      const marker = s === targetName ? ' ← restoring' : '';
      console.log(`     ${s}${marker}`);
    }
    console.log('');
    console.log(`  🔄 Restoring snapshot: ${targetName}`);
    console.log('');
  }

  const restored = restoreSnapshot(cwd, snapshotDir);

  if (opts.json) {
    console.log(JSON.stringify({ action: 'rollback', status: 'ok', snapshot: targetName, cwd, restored }));
    return;
  }

  if (restored.length === 0) {
    console.log('  ⚠️  No files were restored — snapshot may be empty or corrupted.');
    return;
  }

  for (const f of restored) {
    console.log(`  ✅ restored  ${f}`);
  }
  console.log('');
  console.log(`  ✅ Rollback complete. ${restored.length} file(s) restored from ${targetName}.`);
  console.log('     Re-open VS Code to pick up the restored context.');
  console.log('');
}
