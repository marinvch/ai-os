import * as fs from 'fs';
import * as path from 'path';
import type { DetectedStack } from '../types.js';

const AGENTS_DIR = '.github/agents';

interface AgentSpec {
  templateFile: string;
  outputFile: string;
  name: string;
  description: string;
  argumentHint: string;
  model?: string;
  tools?: string[];
  replacements: Record<string, string>;
}

function buildAgentSpecs(stack: DetectedStack, cwd: string): AgentSpec[] {
  const specs: AgentSpec[] = [];
  const projectName = path.basename(cwd);
  const frameworks = stack.frameworks.map(f => f.name);
  const packages = stack.allDependencies;
  const primaryLang = Object.entries(stack.languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'TypeScript';
  const hasPrisma = packages.some(p => p.includes('prisma'));
  const hasAuth = packages.some(p => ['next-auth', 'nextauth', 'passport', 'django.contrib.auth', 'flask-login'].some(a => p.toLowerCase().includes(a)));
  const hasStripe = packages.some(p => p.toLowerCase().includes('stripe'));
  const hasNextjs = frameworks.some(f => f.toLowerCase().includes('next'));
  const hasReact = frameworks.some(f => ['react', 'next', 'remix', 'gatsby'].some(k => f.toLowerCase().includes(k)));
  const primaryFramework = frameworks[0] ?? primaryLang;
  const frameworkLabel = hasNextjs ? 'Next.js' : primaryFramework;

  const keyFiles = [
    'src/trpc/index.ts',
    'src/lib/vector-store.ts',
    'src/app/api/chat/route.ts',
    'src/components/ChatInterface.tsx',
    'prisma/schema.prisma',
  ].filter(f => fs.existsSync(path.join(cwd, f)));

  const templateDir = new URL('../templates/agents', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

  // 1. Repo initializer — always
  specs.push({
    templateFile: path.join(templateDir, 'repo-initializer.md'),
    outputFile: `${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-initializer.agent.md`,
    name: `${projectName} Initializer`,
    description: `Maintain and evolve the AI framework artifacts for the ${projectName} repo (docs, skills, prompts) using the real ${frameworkLabel} stack.`,
    argumentHint: 'What artifact to update or create (e.g. "update skills", "add agent for auth")',
    replacements: {
      '{{PROJECT_NAME}}': projectName,
      '{{FRAMEWORKS}}': frameworkLabel,
      '{{CONVENTIONS_FILE}}': '.ai-os/context/conventions.md',
      '{{STACK_FILE}}': '.ai-os/context/stack.md',
      '{{ARCHITECTURE_FILE}}': '.ai-os/context/architecture.md',
    },
  });

  // 2. Framework expert — always
  specs.push({
    templateFile: path.join(templateDir, 'framework-expert.md'),
    outputFile: `expert-${frameworkLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}-developer.agent.md`,
    name: `Expert ${frameworkLabel} Developer`,
    description: `Expert ${frameworkLabel} developer specializing in ${primaryLang} patterns for ${projectName}.`,
    argumentHint: 'Describe the feature, bug or refactor you need help with',
    replacements: {
      '{{FRAMEWORK}}': frameworkLabel,
      '{{STACK_SUMMARY}}': frameworks.slice(0, 4).join(', '),
      '{{PRIMARY_LANG}}': primaryLang,
      '{{KEY_FILES}}': keyFiles.join(', ') || 'See .ai-os/context/architecture.md',
      '{{RULES_FILE}}': '.ai-os/context/conventions.md',
    },
  });

  // 3. Codebase explorer — always
  specs.push({
    templateFile: path.join(templateDir, 'codebase-explorer.md'),
    outputFile: 'codebase-explorer.agent.md',
    name: 'Codebase Explorer',
    description: `Read-only navigator for ${projectName} — answers "how does X work?" questions.`,
    argumentHint: 'Ask about any feature, file, or pattern (e.g. "how does auth work?")',
    replacements: {
      '{{PROJECT_NAME}}': projectName,
      '{{STACK_SUMMARY}}': frameworks.slice(0, 4).join(', '),
      '{{ENTRY_POINTS}}': keyFiles.slice(0, 3).join(', ') || 'src/',
    },
  });

  // 4. DB expert — if Prisma or other ORM detected
  if (hasPrisma) {
    const schemaFile = fs.existsSync(path.join(cwd, 'prisma/schema.prisma'))
      ? 'prisma/schema.prisma'
      : 'schema.prisma';
    specs.push({
      templateFile: path.join(templateDir, 'db-expert.md'),
      outputFile: 'expert-database.agent.md',
      name: 'Database Expert',
      description: `Prisma ORM expert for ${projectName} — schema design, migrations, query optimization.`,
      argumentHint: 'Describe the DB change, schema question, or query you need',
      replacements: {
        '{{ORM}}': 'Prisma',
        '{{DB}}': 'PostgreSQL (Supabase)',
        '{{SCHEMA_FILE}}': schemaFile,
        '{{MIGRATE_CMD}}': 'npx prisma migrate dev --name <name>',
        '{{GENERATE_CMD}}': 'npx prisma generate',
      },
    });
  }

  // 5. Auth expert — if auth detected
  if (hasAuth) {
    const authProvider = hasAuth && packages.some(p => p.includes('next-auth')) ? 'NextAuth.js' : 'Auth';
    const authFile = 'src/app/api/auth/[...nextauth]/authOptions.ts';
    specs.push({
      templateFile: path.join(templateDir, 'auth-expert.md'),
      outputFile: 'expert-auth.agent.md',
      name: 'Auth Expert',
      description: `${authProvider} expert for ${projectName} — providers, sessions, route protection.`,
      argumentHint: 'Describe the auth feature, provider, or protection you need',
      replacements: {
        '{{AUTH_PROVIDER}}': authProvider,
        '{{AUTH_STRATEGY}}': 'JWT',
        '{{AUTH_CONFIG_FILE}}': authFile,
        '{{SESSION_HELPER}}': 'getServerSession() from src/lib/auth.ts',
      },
    });
  }

  // 6. Payments expert — if Stripe detected
  if (hasStripe) {
    const plansFile = fs.existsSync(path.join(cwd, 'src/constants/stripe.ts'))
      ? 'src/constants/stripe.ts'
      : 'src/lib/stripe.ts';
    specs.push({
      templateFile: path.join(templateDir, 'payments-expert.md'),
      outputFile: 'expert-payments.agent.md',
      name: 'Payments Expert',
      description: `Stripe billing expert for ${projectName} — subscriptions, webhooks, plan enforcement.`,
      argumentHint: 'Describe the billing feature, webhook, or plan change you need',
      replacements: {
        '{{PAYMENT_PROVIDER}}': 'Stripe',
        '{{PLANS_FILE}}': plansFile,
        '{{WEBHOOK_FILE}}': 'src/app/api/webhooks/stripe/route.ts',
        '{{STRIPE_LIB_FILE}}': 'src/lib/stripe.ts',
      },
    });
  }

  return specs;
}

function injectReplacements(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export async function generateAgents(stack: DetectedStack, cwd: string): Promise<string[]> {
  const agentsDir = path.join(cwd, AGENTS_DIR);
  fs.mkdirSync(agentsDir, { recursive: true });

  // Build a set of "concepts" already covered by existing agent files
  const existingFiles = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).map(f => f.toLowerCase())
    : [];

  function conceptCovered(keywords: string[]): boolean {
    return existingFiles.some(f => keywords.some(k => f.includes(k)));
  }

  const specs = buildAgentSpecs(stack, cwd);
  const generated: string[] = [];

  for (const spec of specs) {
    const outputPath = path.join(agentsDir, spec.outputFile);

    // Skip if exact file exists
    if (fs.existsSync(outputPath)) continue;

    // Skip if a conceptually equivalent agent already exists
    // (detect by keywords in the output filename)
    const baseKeywords = spec.outputFile.replace('.agent.md', '').split('-').filter(w => w.length > 3);
    if (conceptCovered(baseKeywords)) continue;

    if (!fs.existsSync(spec.templateFile)) {
      console.warn(`  ⚠ Agent template not found: ${spec.templateFile}`);
      continue;
    }

    let content = fs.readFileSync(spec.templateFile, 'utf-8');

    // Inject frontmatter values
    content = content
      .replace(/^name:.*$/m, `name: ${spec.name}`)
      .replace(/^description:.*$/m, `description: ${spec.description}`)
      .replace(/^argument-hint:.*$/m, `argument-hint: "${spec.argumentHint}"`);

    if (spec.model) {
      content = content.replace(/^model:.*$/m, `model: ${spec.model}`);
    }

    // Inject template placeholders
    content = injectReplacements(content, spec.replacements);

    fs.writeFileSync(outputPath, content, 'utf-8');
    generated.push(spec.outputFile);
  }

  return generated;
}
