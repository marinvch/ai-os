import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env['AI_OS_ROOT'] ?? process.cwd();

export function getProjectRoot(): string {
  return path.resolve(ROOT);
}

export function readAiOsFile(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, '.ai-os', relPath), 'utf-8');
  } catch {
    return '';
  }
}

export function searchFiles(query: string, filePattern?: string, caseSensitive = false): string {
  try {
    const flags = caseSensitive ? '' : '-i';
    const globArg = filePattern ? `-g "${filePattern}"` : '';
    const cmd = `npx --yes ripgrep ${flags} ${globArg} --line-number --max-count=5 "${query}" "${ROOT}"`;
    const result = execSync(cmd, { maxBuffer: 512 * 1024, timeout: 10000 }).toString();
    return result.slice(0, 8000); // Cap output for token efficiency
  } catch (err) {
    if (err instanceof Error && 'stdout' in err) {
      return String((err as NodeJS.ErrnoException & { stdout: Buffer }).stdout ?? 'No results found');
    }
    return 'No results found';
  }
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
  '__pycache__', '.venv', 'venv', 'target', 'vendor', 'coverage',
  '.gradle', 'bin', 'obj', '.vs', 'packages', '.cache',
]);

export function buildFileTree(dir: string, depth = 0, maxDepth = 4): string[] {
  if (depth > maxDepth) return [];
  const prefix = '  '.repeat(depth);
  const lines: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') || e.name === '.github')
      .filter(e => !IGNORE_DIRS.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        lines.push(...buildFileTree(path.join(dir, entry.name), depth + 1, maxDepth));
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  } catch { /* ignore permission errors */ }
  return lines;
}

export function getPrismaSchema(): string {
  const candidates = ['prisma/schema.prisma', 'schema.prisma', 'db/schema.prisma'];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs, 'utf-8');
    }
  }
  return 'Prisma schema not found';
}

export function getTrpcProcedures(): string {
  const candidates = ['src/trpc/index.ts', 'src/server/trpc.ts', 'server/trpc.ts'];
  for (const rel of candidates) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const content = fs.readFileSync(abs, 'utf-8');
    const lines = content.split('\n');
    const procedures: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s+(\w+):\s+(public|private)Procedure/);
      if (m) procedures.push(`- ${m[1]} (${m[2]})`);
    }
    if (procedures.length > 0) {
      return `**tRPC Procedures** (from ${rel}):\n${procedures.join('\n')}`;
    }
    return `Found router at ${rel} but could not parse procedures. First 50 lines:\n\`\`\`\n${lines.slice(0, 50).join('\n')}\n\`\`\``;
  }
  return 'tRPC router not found';
}

export function getApiRoutes(filter?: string): string {
  const apiDir = path.join(ROOT, 'src/app/api');
  if (!fs.existsSync(apiDir)) {
    // Try Express-style routes directory
    const routesDir = path.join(ROOT, 'src/routes');
    if (!fs.existsSync(routesDir)) return 'No API routes directory found';
  }
  
  const routes: string[] = [];
  
  function scanDir(dir: string, prefix = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name), `${prefix}/${entry.name}`);
        } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
          const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
          const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(m => 
            new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}`).test(content)
          );
          const route = prefix.replace(/\/\[([^\]]+)\]/g, '/:$1');
          if (methods.length > 0) {
            routes.push(`${methods.join(', ')} ${route}`);
          }
        }
      }
    } catch { /* ignore */ }
  }
  
  if (fs.existsSync(apiDir)) {
    scanDir(apiDir, '/api');
  }
  
  const result = filter
    ? routes.filter(r => r.toLowerCase().includes(filter.toLowerCase()))
    : routes;
  
  return result.length > 0 
    ? `**API Routes:**\n${result.join('\n')}`
    : 'No API routes found';
}

export function getEnvVars(): string {
  const envExamplePaths = ['.env.example', '.env.local.example', '.env.sample', '.env.template'];
  let envContent = '';
  
  for (const p of envExamplePaths) {
    if (fs.existsSync(path.join(ROOT, p))) {
      envContent = fs.readFileSync(path.join(ROOT, p), 'utf-8');
      break;
    }
  }
  
  // Also scan code for process.env references
  const codeEnvVars = new Set<string>();
  try {
    const result = execSync(
      `grep -r "process\\.env\\." "${ROOT}/src" --include="*.ts" --include="*.js" -oh`,
      { maxBuffer: 256 * 1024, timeout: 5000 }
    ).toString();
    result.split('\n').forEach(line => {
      const m = line.match(/process\.env\.(\w+)/);
      if (m) codeEnvVars.add(m[1]);
    });
  } catch { /* grep may fail, that's ok */ }
  
  const lines: string[] = ['**Required Environment Variables:**', ''];
  
  if (envContent) {
    lines.push('From .env.example:');
    lines.push('```');
    lines.push(envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).join('\n'));
    lines.push('```');
  }
  
  if (codeEnvVars.size > 0) {
    lines.push('');
    lines.push('Referenced in code:');
    [...codeEnvVars].sort().forEach(v => lines.push(`- ${v}`));
  }
  
  return lines.join('\n');
}

export function getPackageInfo(packageName?: string): string {
  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'No package.json found';
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  if (packageName) {
    const version = allDeps[packageName];
    return version 
      ? `**${packageName}:** ${version}` 
      : `Package ${packageName} not found in package.json`;
  }
  
  const lines: string[] = [
    `**Package:** ${pkg.name ?? 'unknown'}@${pkg.version ?? '0.0.0'}`,
    `**Node:** ${pkg.engines?.node ?? 'not specified'}`,
    '',
    '**Dependencies:**',
    ...Object.entries(pkg.dependencies ?? {}).map(([k, v]) => `  ${k}: ${v}`),
    '',
    '**Dev Dependencies:**',
    ...Object.entries(pkg.devDependencies ?? {}).map(([k, v]) => `  ${k}: ${v}`),
  ];
  
  return lines.join('\n');
}
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  try {
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const ext = path.extname(filePath).toLowerCase();
    const exports: string[] = [];
    const imports: string[] = [];

    for (const line of lines.slice(0, 200)) {
      // TypeScript/JavaScript exports
      if (/^export\s+(default\s+)?(function|class|const|interface|type|enum)\s+(\w+)/.test(line)) {
        const match = line.match(/^export\s+(?:default\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/);
        if (match) exports.push(match[1]);
      }
      // Python functions/classes
      if ((ext === '.py') && /^(def|class)\s+(\w+)/.test(line)) {
        const match = line.match(/^(def|class)\s+(\w+)/);
        if (match) exports.push(`${match[1]} ${match[2]}`);
      }
      // Go functions
      if ((ext === '.go') && /^func\s+(\w+)/.test(line)) {
        const match = line.match(/^func\s+(\w+)/);
        if (match) exports.push(`func ${match[1]}`);
      }
      // Imports (first 10)
      if (imports.length < 10 && /^import\s/.test(line)) {
        imports.push(line.trim());
      }
    }

    const summary: string[] = [
      `**File:** \`${filePath}\``,
      `**Size:** ${lines.length} lines`,
      '',
    ];

    if (imports.length > 0) {
      summary.push('**Key Imports:**');
      summary.push(...imports.map(i => `- ${i}`));
      summary.push('');
    }
    if (exports.length > 0) {
      summary.push('**Exports:**');
      summary.push(...exports.map(e => `- ${e}`));
      summary.push('');
    }

    // First 30 lines as preview
    summary.push('**Preview (first 30 lines):**');
    summary.push('```');
    summary.push(...lines.slice(0, 30));
    summary.push('```');

    return summary.join('\n');
  } catch {
    return `Could not read file: ${filePath}`;
  }
}
