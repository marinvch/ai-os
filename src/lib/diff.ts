import path from 'node:path';
import type { DryRunCapture } from '../generators/utils.js';

export function computeLineDiff(
  before: string,
  after: string,
): Array<{ type: '+' | '-' | ' '; line: string }> {
  const bLines = before.split('\n');
  const aLines = after.split('\n');
  const result: Array<{ type: '+' | '-' | ' '; line: string }> = [];

  // Simple patience-style diff: LCS-based
  function lcs(a: string[], b: string[]): Array<[number, number]> {
    const m = a.length,
      n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i]![j] =
          a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    const pairs: Array<[number, number]> = [];
    let i = m,
      j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        pairs.unshift([i - 1, j - 1]);
        i--;
        j--;
      } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) i--;
      else j--;
    }
    return pairs;
  }

  const common = lcs(bLines, aLines);
  let bi = 0,
    ai = 0,
    ci = 0;
  while (ci <= common.length) {
    const bEnd = ci < common.length ? common[ci]![0] : bLines.length;
    const aEnd = ci < common.length ? common[ci]![1] : aLines.length;
    while (bi < bEnd) result.push({ type: '-', line: bLines[bi++]! });
    while (ai < aEnd) result.push({ type: '+', line: aLines[ai++]! });
    if (ci < common.length) {
      result.push({ type: ' ', line: bLines[common[ci]![0]]! });
      bi = common[ci]![0] + 1;
      ai = common[ci]![1] + 1;
    }
    ci++;
  }
  return result;
}

export function printDryRunDiff(cwd: string, captures: DryRunCapture[], fullDiff: boolean): void {
  const CONTEXT = 3;
  const MAX_LINES = fullDiff ? Infinity : 40;
  let totalAdded = 0,
    totalRemoved = 0,
    changedCount = 0,
    newCount = 0;

  process.stdout.write('\n  🔍 Dry-run diff (no files written)\n\n');

  for (const cap of captures) {
    const rel = path.relative(cwd, cap.filePath).replace(/\\/g, '/');
    if (cap.existingContent === null) {
      newCount++;
      const lines = cap.newContent.split('\n');
      totalAdded += lines.length;
      process.stdout.write(`  \x1b[32m[NEW]\x1b[0m ${rel}\n`);
      if (fullDiff) {
        for (const line of lines) process.stdout.write(`  \x1b[32m+${line}\x1b[0m\n`);
      }
    } else if (cap.existingContent === cap.newContent) {
      // unchanged — skip
    } else {
      changedCount++;
      const hunks = computeLineDiff(cap.existingContent, cap.newContent);
      const added = hunks.filter((h) => h.type === '+').length;
      const removed = hunks.filter((h) => h.type === '-').length;
      totalAdded += added;
      totalRemoved += removed;
      process.stdout.write(`  \x1b[33m[CHANGED]\x1b[0m ${rel}  (+${added}/-${removed})\n`);

      if (fullDiff) {
        let linesPrinted = 0;
        let i = 0;
        while (i < hunks.length && linesPrinted < MAX_LINES) {
          if (hunks[i]!.type !== ' ') {
            const start = Math.max(0, i - CONTEXT);
            const end = Math.min(hunks.length, i + CONTEXT + 1);
            for (let j = start; j < end && linesPrinted < MAX_LINES; j++) {
              const h = hunks[j]!;
              const color = h.type === '+' ? '\x1b[32m' : h.type === '-' ? '\x1b[31m' : '';
              process.stdout.write(`    ${color}${h.type}${h.line}\x1b[0m\n`);
              linesPrinted++;
            }
            i = end;
          } else {
            i++;
          }
        }
        if (linesPrinted >= MAX_LINES) {
          process.stdout.write(`    ... (truncated, use --full-diff to see all)\n`);
        }
      }
    }
  }

  process.stdout.write(
    `\n  Summary: ${newCount} new, ${changedCount} changed | +${totalAdded} lines, -${totalRemoved} lines\n`,
  );
  if (!fullDiff && (newCount > 0 || changedCount > 0)) {
    process.stdout.write('  Run with --full-diff to see full diffs.\n');
  }
  process.stdout.write('\n');
}
