import * as fs from 'fs';
import * as path from 'path';
import type { DetectedStack } from '../types.js';

const SKILLS_DIR = '.github/copilot/skills';

interface SkillSpec {
  templateFile: string;
  outputFile: string;
  replacements: Record<string, string>;
}

function buildSkillSpecs(stack: DetectedStack, cwd: string): SkillSpec[] {
  const specs: SkillSpec[] = [];
  const projectName = path.basename(cwd);
  const frameworks = stack.frameworks.map(f => f.name.toLowerCase());
  const packages = stack.allDependencies;

  const templateDir = new URL('../templates/skills', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

  const add = (template: string, output: string, replacements: Record<string, string> = {}) => {
    const templatePath = path.join(templateDir, template);
    if (fs.existsSync(templatePath)) {
      specs.push({
        templateFile: templatePath,
        outputFile: output,
        replacements: { '{{PROJECT_NAME}}': projectName, ...replacements },
      });
    }
  };

  // Next.js
  if (frameworks.some(f => f.includes('next'))) {
    add('nextjs.md', 'nextjs-patterns.md');
  }

  // React (non-Next.js to avoid duplicate)
  if (frameworks.some(f => f.includes('react')) && !frameworks.some(f => f.includes('next'))) {
    add('react.md', 'react-patterns.md');
  }

  // tRPC
  if (packages.includes('@trpc/server') || packages.includes('trpc')) {
    const trpcRouterFile = fs.existsSync(path.join(cwd, 'src/trpc/index.ts'))
      ? 'src/trpc/index.ts'
      : 'src/server/trpc.ts';
    add('trpc.md', 'trpc-patterns.md', { '{{TRPC_ROUTER_FILE}}': trpcRouterFile });
  }

  // Prisma
  if (packages.includes('prisma') || packages.includes('@prisma/client')) {
    const schemaFile = fs.existsSync(path.join(cwd, 'prisma/schema.prisma'))
      ? 'prisma/schema.prisma'
      : 'schema.prisma';
    add('prisma.md', 'prisma-patterns.md', { '{{SCHEMA_FILE}}': schemaFile });
  }

  // Stripe
  if (packages.includes('stripe')) {
    const plansFile = fs.existsSync(path.join(cwd, 'src/constants/stripe.ts'))
      ? 'src/constants/stripe.ts'
      : 'src/lib/stripe.ts';
    add('stripe.md', 'billing-stripe.md', {
      '{{PLANS_FILE}}': plansFile,
      '{{STRIPE_LIB_FILE}}': fs.existsSync(path.join(cwd, 'src/lib/stripe.ts')) ? 'src/lib/stripe.ts' : plansFile,
      '{{WEBHOOK_FILE}}': 'src/app/api/webhooks/stripe/route.ts',
    });
  }

  // NextAuth
  if (packages.includes('next-auth') || packages.includes('nextauth')) {
    const authFile = fs.existsSync(path.join(cwd, 'src/app/api/auth/[...nextauth]/authOptions.ts'))
      ? 'src/app/api/auth/[...nextauth]/authOptions.ts'
      : 'src/lib/auth.ts';
    add('auth-nextauth.md', 'auth-flow.md', { '{{AUTH_CONFIG_FILE}}': authFile });
  }

  // Supabase
  if (packages.includes('@supabase/supabase-js')) {
    add('supabase.md', 'supabase-patterns.md');
  }

  // pgvector / RAG
  if (packages.includes('langchain') || packages.includes('@langchain/community') || packages.includes('pgvector')) {
    add('rag-pgvector.md', 'rag-pipeline.md');
  }

  // Express
  if (frameworks.some(f => f.includes('express'))) {
    add('express.md', 'express-api.md');
  }

  // FastAPI / Django
  if (frameworks.some(f => f.includes('fastapi'))) {
    add('python-fastapi.md', 'fastapi-patterns.md');
  }

  // Go
  if (Object.keys(stack.languages).some(l => l.toLowerCase() === 'go')) {
    add('go.md', 'go-patterns.md');
  }

  return specs;
}

export async function generateSkills(stack: DetectedStack, cwd: string): Promise<string[]> {
  const skillsDir = path.join(cwd, SKILLS_DIR);
  fs.mkdirSync(skillsDir, { recursive: true });

  const specs = buildSkillSpecs(stack, cwd);
  const generated: string[] = [];

  for (const spec of specs) {
    const outputPath = path.join(skillsDir, spec.outputFile);

    // Skip if file already exists — never overwrite hand-crafted skills
    if (fs.existsSync(outputPath)) {
      continue;
    }

    let content = fs.readFileSync(spec.templateFile, 'utf-8');

    for (const [key, value] of Object.entries(spec.replacements)) {
      content = content.replaceAll(key, value);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    generated.push(spec.outputFile);
  }

  return generated;
}
