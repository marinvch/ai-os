import * as fs from 'fs';
import * as path from 'path';
import type { DetectedStack } from '../types.js';

const PROMPTS_FILE = '.github/copilot/prompts.json';

interface PromptEntry {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

interface PromptsFile {
  version: number;
  prompts: PromptEntry[];
}

function buildPrompts(stack: DetectedStack, cwd: string): PromptEntry[] {
  const prompts: PromptEntry[] = [];
  const frameworks = stack.frameworks.map(f => f.name.toLowerCase());
  const packages = stack.allDependencies;
  const hasNext = frameworks.some(f => f.includes('next'));
  const hasTrpc = packages.includes('@trpc/server') || packages.includes('trpc');
  const hasPrisma = packages.includes('prisma') || packages.includes('@prisma/client');
  const hasStripe = packages.includes('stripe');
  const hasAuth = packages.includes('next-auth') || packages.includes('nextauth');
  const hasVector = packages.some(p => p.includes('langchain') || p.includes('pgvector'));

  if (hasNext) {
    prompts.push({
      id: '/new-page',
      title: 'New App Router Page',
      description: 'Create a new Next.js App Router page with auth guard',
      prompt: `Create a new Next.js 15 App Router page at the path I specify.
Requirements:
- Server Component by default (no 'use client' unless needed)
- Guard with getServerSession() → redirect to /auth/signin if no session
- Pass any data to a Client Component child only if interactivity is needed
- Use TypeScript strict types
- Follow the project conventions in .ai-os/context/conventions.md`,
    });

    prompts.push({
      id: '/new-api-route',
      title: 'New API Route',
      description: 'Create a Next.js API route handler',
      prompt: `Create a new Next.js API route handler at the path I specify.
Requirements:
- Use NextRequest / NextResponse
- Validate auth with getServerSession() → return 401 if missing
- Parse and validate request body with Zod (create schema in src/validators/ if needed)
- Return structured JSON responses
- Use try/catch and return appropriate HTTP status codes
- Do NOT create an API route for data that can be a tRPC procedure`,
    });
  }

  if (hasTrpc) {
    prompts.push({
      id: '/new-trpc-procedure',
      title: 'New tRPC Procedure',
      description: 'Add a new tRPC query or mutation to src/trpc/index.ts',
      prompt: `Add a new tRPC procedure to src/trpc/index.ts.
Requirements:
- Use privateProcedure if it requires auth (most cases), publicProcedure only if explicitly public
- Validate input with Zod (.input(z.object({...})))
- Always scope DB queries by ctx.userId
- Throw TRPCError with appropriate code on failures
- Add any new validators to src/validators/
- Also show me the client usage pattern (trpc.<name>.useQuery / useMutation)`,
    });
  }

  if (hasPrisma) {
    prompts.push({
      id: '/new-model',
      title: 'New Prisma Model',
      description: 'Add a new Prisma model to schema.prisma + generate migration',
      prompt: `Add a new Prisma model to the schema.
Requirements:
- Add to prisma/schema.prisma with proper types, relations, and @@map for snake_case table names
- Include id (cuid), createdAt, updatedAt fields
- Add any necessary indexes with @@index
- Show me the migration command: npx prisma migrate dev --name <name>
- Show me any new tRPC procedures or API routes needed to expose the model
- Follow the existing model patterns in the schema`,
    });
  }

  if (hasStripe) {
    prompts.push({
      id: '/add-plan',
      title: 'Add Subscription Plan',
      description: 'Add a new Stripe subscription plan tier',
      prompt: `Add a new subscription plan tier to the project.
Requirements:
- Add to src/constants/stripe.ts with appropriate limits (quota, maxFileSizeMb, messageLimit)
- Create the product/price in Stripe dashboard and update the price ID
- Update getUserSubscriptionPlan() in src/lib/stripe.ts if plan lookup logic changes
- Show me which enforcement points need updating (upload route, chat route, etc.)
- Show me any UI changes needed in the pricing page`,
    });
  }

  if (hasAuth) {
    prompts.push({
      id: '/add-oauth',
      title: 'Add OAuth Provider',
      description: 'Add a new OAuth provider to NextAuth.js',
      prompt: `Add a new OAuth provider to the NextAuth.js config.
Requirements:
- Add provider to src/app/api/auth/[...nextauth]/authOptions.ts
- Use conditional inclusion if env vars are present (so app works without the provider set)
- List the required environment variables to add to .env.local
- Show the OAuth app callback URL to configure in the provider dashboard
- Ensure user is upserted in the signIn callback with the provider's data`,
    });
  }

  if (hasVector) {
    prompts.push({
      id: '/rag-query',
      title: 'RAG Query / Retrieval',
      description: 'Write or optimize a vector similarity search query',
      prompt: `Write or optimize a pgvector similarity search query for the RAG pipeline.
Requirements:
- Use cosine distance (<->) on the document_chunks table
- Always scope by fileId (prevent cross-user leakage)
- Return top-K results with content + metadata (pageNumber, snippet)
- Ensure the embedding is 384D (HuggingFace MiniLM-L6-v2)
- Show me how to integrate the results into the SSE stream format
- Reference src/lib/vector-store.ts and src/app/api/chat/route.ts`,
    });
  }

  // Always add these utility prompts
  prompts.push({
    id: '/explain-file',
    title: 'Explain File',
    description: 'Get a detailed explanation of a file in the codebase',
    prompt: `Explain the file I specify in detail.
Include:
- Its purpose and responsibility in the architecture
- Key exports and their signatures
- Any important side effects or dependencies
- How it connects to other parts of the system
- Any gotchas or non-obvious behavior
Reference the project architecture in .ai-os/context/architecture.md as context.`,
  });

  prompts.push({
    id: '/refactor-component',
    title: 'Refactor Component',
    description: 'Refactor a component following project conventions',
    prompt: `Refactor the component I specify following the project conventions.
Before touching anything:
1. Read the component file completely
2. List all imports and consumers (grep for the component name)
3. Identify props, tRPC hooks, and state
Then:
- Apply the naming conventions from .ai-os/context/conventions.md
- Extract business logic to lib/ if present in the component
- Ensure TypeScript strict compliance (no any)
- Verify all callers still compile after the refactor`,
  });

  return prompts;
}

export async function generatePrompts(stack: DetectedStack, cwd: string): Promise<number> {
  const promptsPath = path.join(cwd, PROMPTS_FILE);
  fs.mkdirSync(path.dirname(promptsPath), { recursive: true });

  let existing: PromptsFile = { version: 1, prompts: [] };
  if (fs.existsSync(promptsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
    } catch {
      // file is malformed, start fresh
    }
  }

  const existingIds = new Set(existing.prompts.map(p => p.id));
  const newPrompts = buildPrompts(stack, cwd).filter(p => !existingIds.has(p.id));

  if (newPrompts.length === 0) return 0;

  existing.prompts = [...existing.prompts, ...newPrompts];
  fs.writeFileSync(promptsPath, JSON.stringify(existing, null, 2), 'utf-8');
  return newPrompts.length;
}
