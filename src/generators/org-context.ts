import path from 'node:path';
import type { AiOsConfig } from '../types.js';
import { writeIfChanged } from './utils.js';

/** Injected fetch function — defaults to globalThis.fetch (Node 18+). */
type FetchFn = typeof globalThis.fetch;

interface FetchOrgContextOptions {
  config?: AiOsConfig;
  /** Override the HTTP fetch function (injectable for testing). */
  fetch?: FetchFn;
}

const ORG_CONTEXT_PATHS = [
  'conventions/shared.md',
  'instructions/shared.md',
];

const OUTPUT_FILE = path.join('.github', 'ai-os', 'context', 'org-context.md');
const ORG_OPEN_TAG = '<!-- [org]';
const ORG_CLOSE_TAG = '<!-- [org:end] -->';

/**
 * Fetches shared context fragments from a shared org context repository and
 * merges them into `.github/ai-os/context/org-context.md`.
 *
 * Enabled by setting `orgContextRepo: "owner/repo"` in `.github/ai-os/config.json`.
 *
 * The fetch is best-effort: if the network is unavailable or the repo does not
 * have the expected files, the function logs a warning and returns `[]` without
 * throwing. This ensures org context failures never break local installs.
 *
 * The generated file is tagged with `<!-- [org] ... [org:end] -->` markers and
 * should NOT be edited manually — it will be overwritten on the next refresh.
 *
 * @param cwd  Project root directory (absolute).
 * @param opts Options including the config and an optional fetch override.
 * @returns    Array with the absolute path of the written org-context file,
 *             or `[]` if orgContextRepo is unset or the fetch fails.
 */
export async function fetchOrgContext(cwd: string, opts?: FetchOrgContextOptions): Promise<string[]> {
  const orgRepo = opts?.config?.orgContextRepo;
  if (!orgRepo) return [];

  const fetcher: FetchFn = opts?.fetch ?? globalThis.fetch;
  if (typeof fetcher !== 'function') {
    console.warn('  ⚠ fetchOrgContext: fetch API not available — skip org context pull');
    return [];
  }

  // Try paths in priority order; stop at first successful response
  let content: string | null = null;
  let sourceUrl: string | null = null;

  for (const filePath of ORG_CONTEXT_PATHS) {
    const url = `https://raw.githubusercontent.com/${orgRepo}/HEAD/${filePath}`;
    try {
      const response = await fetcher(url);
      if (response.ok) {
        content = await response.text();
        sourceUrl = url;
        break;
      }
    } catch {
      // Try next path
    }
  }

  if (!content || !sourceUrl) {
    console.warn(`  ⚠ Could not fetch org context from ${orgRepo} — no supported path found. Skipping.`);
    return [];
  }

  const outputPath = path.join(cwd, OUTPUT_FILE);
  const wrapped = buildOrgContextFile(orgRepo, sourceUrl, content);
  writeIfChanged(outputPath, wrapped);

  return [outputPath];
}

function buildOrgContextFile(orgRepo: string, sourceUrl: string, content: string): string {
  const timestamp = new Date().toISOString();
  return `${ORG_OPEN_TAG} Shared from ${orgRepo} — do not edit manually; fetched by AI OS on ${timestamp} -->
<!-- Source: ${sourceUrl} -->
<!-- To disable org context: remove "orgContextRepo" from .github/ai-os/config.json -->

${content.trimEnd()}

${ORG_CLOSE_TAG}
`;
}
