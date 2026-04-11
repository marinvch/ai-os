import * as fs from 'fs';
import * as path from 'path';
import { writeIfChanged } from './utils.js';
const SKILLS_DIR = '.github/copilot/skills';
const AGENTS_SKILLS_DIR = '.agents/skills';
function buildSkillSpecs(stack, cwd) {
    const specs = [];
    const projectName = path.basename(cwd);
    const frameworks = stack.frameworks.map(f => f.name.toLowerCase());
    const packages = stack.allDependencies;
    const hasExpressLike = frameworks.some(f => ['express', 'fastify', 'hono', 'koa', 'nest'].some(x => f.includes(x)));
    const hasJavaSpringLike = frameworks.some(f => ['spring', 'quarkus', 'micronaut', 'java'].some(x => f.includes(x)));
    const templateDir = new URL('../templates/skills', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
    const add = (template, output, replacements = {}) => {
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
        add('nextjs.md', 'ai-os-nextjs-patterns.md');
    }
    // React (non-Next.js to avoid duplicate)
    if (frameworks.some(f => f.includes('react')) && !frameworks.some(f => f.includes('next'))) {
        add('react.md', 'ai-os-react-patterns.md');
    }
    // tRPC
    if (packages.includes('@trpc/server') || packages.includes('trpc')) {
        const trpcRouterFile = fs.existsSync(path.join(cwd, 'src/trpc/index.ts'))
            ? 'src/trpc/index.ts'
            : 'src/server/trpc.ts';
        add('trpc.md', 'ai-os-trpc-patterns.md', { '{{TRPC_ROUTER_FILE}}': trpcRouterFile });
    }
    // Prisma
    if (packages.includes('prisma') || packages.includes('@prisma/client')) {
        const schemaFile = fs.existsSync(path.join(cwd, 'prisma/schema.prisma'))
            ? 'prisma/schema.prisma'
            : 'schema.prisma';
        add('prisma.md', 'ai-os-prisma-patterns.md', { '{{SCHEMA_FILE}}': schemaFile });
    }
    // Stripe
    if (packages.includes('stripe')) {
        const plansFile = fs.existsSync(path.join(cwd, 'src/constants/stripe.ts'))
            ? 'src/constants/stripe.ts'
            : 'src/lib/stripe.ts';
        add('stripe.md', 'ai-os-billing-stripe.md', {
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
        add('auth-nextauth.md', 'ai-os-auth-flow.md', { '{{AUTH_CONFIG_FILE}}': authFile });
    }
    // Supabase
    if (packages.includes('@supabase/supabase-js')) {
        add('supabase.md', 'ai-os-supabase-patterns.md');
    }
    // pgvector / RAG
    if (packages.includes('langchain') || packages.includes('@langchain/community') || packages.includes('pgvector')) {
        add('rag-pgvector.md', 'ai-os-rag-pipeline.md');
    }
    // Express/Nest/Fastify/Koa/Hono
    if (hasExpressLike) {
        add('express.md', 'ai-os-express-api.md');
    }
    // FastAPI / Django
    if (frameworks.some(f => f.includes('fastapi') || f.includes('django'))) {
        add('python-fastapi.md', 'ai-os-fastapi-patterns.md');
    }
    // Go
    if (stack.languages.some(l => l.name.toLowerCase() === 'go')) {
        add('go.md', 'ai-os-go-patterns.md');
    }
    // Java / Spring Boot
    if (hasJavaSpringLike) {
        add('java-spring.md', 'ai-os-java-spring-patterns.md');
    }
    // Remix
    if (frameworks.some(f => f.includes('remix'))) {
        add('remix.md', 'ai-os-remix-patterns.md');
    }
    // SolidJS
    if (frameworks.some(f => f.includes('solid'))) {
        add('solid.md', 'ai-os-solid-patterns.md');
    }
    // Bun
    if (frameworks.some(f => f === 'bun') || packages.includes('bun')) {
        add('bun.md', 'ai-os-bun-patterns.md');
    }
    // Deno
    if (frameworks.some(f => f === 'deno')) {
        add('deno.md', 'ai-os-deno-patterns.md');
    }
    return specs;
}
async function generateSkillsWithOptions(stack, cwd, options) {
    const skillsDir = path.join(cwd, SKILLS_DIR);
    fs.mkdirSync(skillsDir, { recursive: true });
    const specs = buildSkillSpecs(stack, cwd);
    const generatedPaths = [];
    for (const spec of specs) {
        const outputPath = path.join(skillsDir, spec.outputFile);
        // In safe mode, never overwrite existing skills.
        if (fs.existsSync(outputPath) && !options.refreshExisting) {
            generatedPaths.push(outputPath);
            continue;
        }
        let content = fs.readFileSync(spec.templateFile, 'utf-8');
        for (const [key, value] of Object.entries(spec.replacements)) {
            content = content.replaceAll(key, value);
        }
        writeIfChanged(outputPath, content);
        generatedPaths.push(outputPath);
    }
    // #7 — prune stale ai-os- prefixed skill files that are no longer generated
    //      for this stack (e.g. a framework was removed).
    if (options.refreshExisting && fs.existsSync(skillsDir)) {
        const currentSet = new Set(generatedPaths.map(p => path.basename(p)));
        const onDisk = fs.readdirSync(skillsDir).filter(f => f.startsWith('ai-os-') && f.endsWith('.md'));
        for (const stale of onDisk) {
            if (!currentSet.has(stale)) {
                fs.rmSync(path.join(skillsDir, stale));
                console.log(`  🗑️  Pruned stale skill: ${stale}`);
            }
        }
    }
    return generatedPaths;
}
export async function generateSkills(stack, cwd, options) {
    return generateSkillsWithOptions(stack, cwd, { refreshExisting: options?.refreshExisting ?? false });
}
// ── Bundled agent skills (skill-creator, etc.) ───────────────────────────────
const BUNDLED_SKILLS = [
    { dirName: 'skill-creator', label: 'skill-creator' },
];
function getBundledSkillSourceDir(dirName) {
    // From src/generators/, go up two levels to the repo root, then into the skill folder.
    return new URL(`../../${dirName}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
}
export async function deployBundledSkills(cwd, options) {
    const deployed = [];
    for (const skill of BUNDLED_SKILLS) {
        const sourceDir = getBundledSkillSourceDir(skill.dirName);
        const targetDir = path.join(cwd, AGENTS_SKILLS_DIR, skill.dirName);
        if (!fs.existsSync(sourceDir)) {
            continue; // source not found — skip silently
        }
        if (fs.existsSync(targetDir) && !options?.refreshExisting) {
            continue; // already installed, skip in safe mode
        }
        fs.mkdirSync(path.join(cwd, AGENTS_SKILLS_DIR), { recursive: true });
        fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
        deployed.push(skill.label);
    }
    return deployed;
}
