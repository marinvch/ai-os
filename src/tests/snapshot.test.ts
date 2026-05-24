import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  takeContextSnapshot,
  listSnapshots,
  latestSnapshot,
  restoreSnapshot,
  SNAPSHOTS_DIR_REL,
} from '../generators/snapshot.js';

/**
 * C6 — Context versioning / rollback tests.
 *
 * Validates that takeContextSnapshot() captures context files, listSnapshots()
 * returns them in order, restoreSnapshot() restores files to their live paths,
 * and that old snapshots are pruned beyond keepLast.
 */

function makeFixtureRepo(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-snapshot-test-'));
  const contextDir = path.join(tmp, '.github', 'ai-os', 'context');
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(path.join(contextDir, 'architecture.md'), '# Arch v1\n');
  fs.writeFileSync(path.join(contextDir, 'conventions.md'), '# Conventions v1\n');

  const githubDir = path.join(tmp, '.github');
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), '# Instructions v1\n');
  fs.writeFileSync(path.join(githubDir, 'COPILOT_CONTEXT.md'), '# Context v1\n');
  return tmp;
}

describe('takeContextSnapshot', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeFixtureRepo(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns the snapshot directory path', () => {
    const snapDir = takeContextSnapshot(tmp);
    expect(snapDir).not.toBeNull();
    expect(fs.existsSync(snapDir!)).toBe(true);
  });

  it('returns null when context dir does not exist', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-os-empty-'));
    try {
      expect(takeContextSnapshot(empty)).toBeNull();
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('copies context/ subdirectory into snapshot', () => {
    const snapDir = takeContextSnapshot(tmp)!;
    expect(fs.existsSync(path.join(snapDir, 'context', 'architecture.md'))).toBe(true);
    expect(fs.existsSync(path.join(snapDir, 'context', 'conventions.md'))).toBe(true);
  });

  it('copies copilot-instructions.md into snapshot', () => {
    const snapDir = takeContextSnapshot(tmp)!;
    expect(fs.existsSync(path.join(snapDir, 'copilot-instructions.md'))).toBe(true);
  });

  it('copies COPILOT_CONTEXT.md into snapshot', () => {
    const snapDir = takeContextSnapshot(tmp)!;
    expect(fs.existsSync(path.join(snapDir, 'COPILOT_CONTEXT.md'))).toBe(true);
  });

  it('snapshot content matches source content', () => {
    const snapDir = takeContextSnapshot(tmp)!;
    const snapContent = fs.readFileSync(path.join(snapDir, 'context', 'architecture.md'), 'utf-8');
    expect(snapContent).toBe('# Arch v1\n');
  });

  it('prunes excess snapshots beyond keepLast', () => {
    for (let i = 0; i < 7; i++) {
      // Small delay to get distinct timestamps
      takeContextSnapshot(tmp, 3);
    }
    const snapshots = listSnapshots(tmp);
    expect(snapshots.length).toBeLessThanOrEqual(3);
  });
});

describe('listSnapshots', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeFixtureRepo(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns empty array when no snapshots exist', () => {
    expect(listSnapshots(tmp)).toEqual([]);
  });

  it('returns snapshot names in chronological order', () => {
    takeContextSnapshot(tmp, 10);
    takeContextSnapshot(tmp, 10);
    const snapshots = listSnapshots(tmp);
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    // Verify sorted order (ISO timestamps are lexicographically sortable)
    const sorted = [...snapshots].sort();
    expect(snapshots).toEqual(sorted);
  });
});

describe('latestSnapshot', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeFixtureRepo(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns null when no snapshots exist', () => {
    expect(latestSnapshot(tmp)).toBeNull();
  });

  it('returns a path after taking a snapshot', () => {
    takeContextSnapshot(tmp);
    const latest = latestSnapshot(tmp);
    expect(latest).not.toBeNull();
    expect(fs.existsSync(latest!)).toBe(true);
  });
});

describe('restoreSnapshot', () => {
  let tmp: string;

  beforeEach(() => { tmp = makeFixtureRepo(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('restores files and returns list of restored paths', () => {
    const snapDir = takeContextSnapshot(tmp)!;

    // Modify the live file to simulate a bad refresh
    const liveArch = path.join(tmp, '.github', 'ai-os', 'context', 'architecture.md');
    fs.writeFileSync(liveArch, '# Arch BROKEN\n');

    const restored = restoreSnapshot(tmp, snapDir);
    expect(restored.length).toBeGreaterThan(0);
    expect(fs.readFileSync(liveArch, 'utf-8')).toBe('# Arch v1\n');
  });

  it('restored paths are repo-relative with forward slashes', () => {
    const snapDir = takeContextSnapshot(tmp)!;
    const restored = restoreSnapshot(tmp, snapDir);
    for (const p of restored) {
      expect(p).not.toContain('\\');
      expect(p).not.toMatch(/^[A-Z]:\//);
    }
  });

  it('SNAPSHOTS_DIR_REL is a stable constant', () => {
    expect(SNAPSHOTS_DIR_REL).toBe('.github/ai-os/snapshots');
  });
});
