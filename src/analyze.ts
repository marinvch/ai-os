import fs from 'node:fs';
import path from 'node:path';
import { detectLanguages } from './detectors/language.js';
import { detectFrameworks } from './detectors/framework.js';
import { detectPatterns } from './detectors/patterns.js';
import type { DetectedStack } from './types.js';

function getProjectName(rootDir: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')) as { name?: string };
    if (pkg.name) return pkg.name.replace(/^@[^/]+\//, '');
  } catch { /* ignore */ }

  try {
    const goMod = fs.readFileSync(path.join(rootDir, 'go.mod'), 'utf-8');
    const match = goMod.match(/^module\s+(\S+)/m);
    if (match) return match[1].split('/').pop() ?? path.basename(rootDir);
  } catch { /* ignore */ }

  try {
    const cargo = fs.readFileSync(path.join(rootDir, 'Cargo.toml'), 'utf-8');
    const match = cargo.match(/^name\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch { /* ignore */ }

  return path.basename(rootDir);
}

function getKeyFiles(rootDir: string): string[] {
  const candidates = [
    'README.md', 'package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml',
    'requirements.txt', 'pom.xml', 'build.gradle', 'composer.json', 'Gemfile',
    '.github/copilot-instructions.md', 'prisma/schema.prisma',
    'src/index.ts', 'src/main.ts', 'src/app.ts',
    'src/index.js', 'src/main.js', 'src/app.js',
    'main.go', 'main.py', 'main.rs', 'app.py', 'index.py',
    'docker-compose.yml', 'Dockerfile',
  ];

  return candidates
    .map(c => path.join(rootDir, c))
    .filter(p => fs.existsSync(p))
    .map(p => path.relative(rootDir, p));
}

function getAllDependencies(rootDir: string): string[] {
  const deps = new Set<string>();

  // Node.js package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    for (const key of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      deps.add(key.toLowerCase());
    }
  } catch { /* ignore */ }

  // Python pyproject.toml / requirements.txt
  try {
    const req = fs.readFileSync(path.join(rootDir, 'requirements.txt'), 'utf-8');
    req.split('\n').forEach(line => {
      const pkg = line.split(/[>=<!;\s]/)[0]?.trim().toLowerCase();
      if (pkg) deps.add(pkg);
    });
  } catch { /* ignore */ }

  // Cargo.toml
  try {
    const cargo = fs.readFileSync(path.join(rootDir, 'Cargo.toml'), 'utf-8');
    const depSection = cargo.match(/\[dependencies\]([\s\S]*?)(\[|\Z)/)?.[1] ?? '';
    depSection.split('\n').forEach(line => {
      const m = line.match(/^(\w[\w-]*)\s*=/);
      if (m) deps.add(m[1].toLowerCase());
    });
  } catch { /* ignore */ }

  return [...deps];
}

export function analyze(rootDir: string): DetectedStack {
  const absRoot = path.resolve(rootDir);
  const languages = detectLanguages(absRoot);
  const frameworks = detectFrameworks(absRoot);
  const patterns = detectPatterns(absRoot);

  return {
    projectName: getProjectName(absRoot),
    primaryLanguage: languages[0] ?? { name: 'Unknown', percentage: 0, fileCount: 0, extensions: [] },
    languages,
    primaryFramework: frameworks[0],
    frameworks,
    patterns,
    keyFiles: getKeyFiles(absRoot),
    rootDir: absRoot,
    allDependencies: getAllDependencies(absRoot),
  };
}
