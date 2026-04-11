import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
// ── Verbose mode (H2) ────────────────────────────────────────────────────────
let _verbose = false;
/** Enable or disable verbose per-file logging for writeIfChanged. */
export function setVerboseMode(enabled) {
    _verbose = enabled;
}
/**
 * Write `content` to `filePath` only when the content differs from the existing
 * file. Returns 'written' when a write occurred, 'skipped' when the content was
 * already identical. Ensures the parent directory exists before writing.
 * When verbose mode is enabled, logs the write/skip decision to stdout.
 */
export function writeIfChanged(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, 'utf-8');
        if (existing === content) {
            if (_verbose)
                console.log(`  ⏭️  skip    ${filePath}  (unchanged)`);
            return 'skipped';
        }
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    if (_verbose)
        console.log(`  ✏️  write   ${filePath}`);
    return 'written';
}
// ── Placeholder resolution (#9) ───────────────────────────────────────────────
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;
/**
 * Detect unresolved `{{PLACEHOLDER}}` fragments in generated content.
 * Returns the unique set of placeholder names found.
 */
export function findUnresolvedPlaceholders(content) {
    const matches = content.match(PLACEHOLDER_RE);
    if (!matches)
        return [];
    return [...new Set(matches)];
}
/**
 * Replace any remaining `{{PLACEHOLDER}}` fragments using the provided fallback
 * map. Unknown placeholders are removed (replaced with empty string) to prevent
 * raw template syntax leaking into generated files.
 */
export function applyFallbacks(content, fallbacks = {}) {
    return content.replace(PLACEHOLDER_RE, (match) => {
        return fallbacks[match] ?? '';
    });
}
const MANIFEST_FILENAME = 'manifest.json';
export function getManifestPath(outputDir) {
    return path.join(outputDir, '.github', 'ai-os', MANIFEST_FILENAME);
}
export function readManifest(outputDir) {
    const manifestPath = getManifestPath(outputDir);
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }
    catch {
        return null;
    }
}
/**
 * Write the manifest atomically: write to a temp file then rename.
 * `files` should be repo-relative paths (forward slashes).
 */
export function writeManifest(outputDir, version, files) {
    const manifest = {
        version,
        generatedAt: new Date().toISOString(),
        files: [...files].sort(),
    };
    const manifestPath = getManifestPath(outputDir);
    const tmpPath = manifestPath + '.tmp';
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
    fs.renameSync(tmpPath, manifestPath);
}
export function makeFileDiff() {
    return { written: [], skipped: [], pruned: [] };
}
/**
 * Merge a local WriteResult into a shared FileDiff tracker.
 */
export function recordResult(diff, repoRelPath, result) {
    if (result === 'written') {
        diff.written.push(repoRelPath);
    }
    else {
        diff.skipped.push(repoRelPath);
    }
}
/**
 * Convert an absolute path to a repo-relative forward-slash path.
 */
export function toRepoRelative(absPath, outputDir) {
    return path.relative(outputDir, absPath).replace(/\\/g, '/');
}
// ── Hash helper (used internally) ────────────────────────────────────────────
export function sha256(content) {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
}
