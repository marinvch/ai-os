import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectedStack } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function readTemplate(name: string): string {
  try {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
  } catch {
    return '';
  }
}

function readFrameworkTemplate(templateKey: string): string {
  return readTemplate(path.join('frameworks', `${templateKey}.md`));
}

function buildStackSummary(stack: DetectedStack): string {
  const lines: string[] = [];
  for (const lang of stack.languages.slice(0, 5)) {
    lines.push(`- **${lang.name}** (${lang.percentage}% of codebase, ${lang.fileCount} files)`);
  }
  return lines.join('\n');
}

function buildKeyFilesList(stack: DetectedStack): string {
  return stack.keyFiles.map(f => `- \`${f}\``).join('\n');
}

function fillTemplate(template: string, stack: DetectedStack, frameworkOverlay: string): string {
  const frameworks = stack.frameworks.map(f => f.name).join(', ') || stack.primaryLanguage.name;
  const linter = stack.patterns.linter ?? 'none detected';
  const formatter = stack.patterns.formatter ?? 'none detected';
  const testFramework = stack.patterns.testFramework ?? 'none detected';
  const testDir = stack.patterns.testDirectory ?? 'none detected';

  return template
    .replace(/{{PROJECT_NAME}}/g, stack.projectName)
    .replace(/{{PRIMARY_LANGUAGE}}/g, stack.primaryLanguage.name)
    .replace(/{{FRAMEWORKS}}/g, frameworks)
    .replace(/{{PACKAGE_MANAGER}}/g, stack.patterns.packageManager)
    .replace(/{{HAS_TYPESCRIPT}}/g, stack.patterns.hasTypeScript ? 'Yes' : 'No')
    .replace(/{{STACK_SUMMARY}}/g, buildStackSummary(stack))
    .replace(/{{NAMING_CONVENTION}}/g, stack.patterns.namingConvention)
    .replace(/{{LINTER}}/g, linter)
    .replace(/{{FORMATTER}}/g, formatter)
    .replace(/{{TEST_FRAMEWORK}}/g, testFramework)
    .replace(/{{TEST_DIRECTORY}}/g, testDir)
    .replace(/{{KEY_FILES}}/g, buildKeyFilesList(stack))
    .replace(/{{FRAMEWORK_OVERLAY}}/g, frameworkOverlay);
}

export function generateInstructions(stack: DetectedStack, outputDir: string): void {
  const base = readTemplate('base-instructions.md');
  if (!base) throw new Error('Base instructions template not found');

  // Load primary framework template + any additional ones
  const templateKeys = new Set<string>();
  for (const fw of stack.frameworks) {
    templateKeys.add(fw.template);
  }
  // Deduplicated overlays
  const overlays = [...templateKeys].map(k => readFrameworkTemplate(k)).filter(Boolean).join('\n\n---\n\n');

  const content = fillTemplate(base, stack, overlays || `## ${stack.primaryLanguage.name} Project\n\nNo specific framework template found. Follow the general rules above.`);

  const githubDir = path.join(outputDir, '.github');
  fs.mkdirSync(githubDir, { recursive: true });

  const outputPath = path.join(githubDir, 'copilot-instructions.md');

  // Backup existing file before overwriting
  if (fs.existsSync(outputPath)) {
    fs.copyFileSync(outputPath, outputPath + '.bak');
  }

  fs.writeFileSync(outputPath, content, 'utf-8');
}
