import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('postgresql://callrack:callrack_dev_password@localhost:5432/callrack_dev?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(3000),
  WEB_PORT: z.coerce.number().default(5173),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * `dotenv.config()` with no `path` only ever checks `process.cwd()` - fine
 * when a script runs from the monorepo root, but pnpm/turbo run each
 * package's script with that package's own directory as cwd (e.g.
 * `apps/api`), where no `.env` exists; only the root one does. Walking up
 * from `process.cwd()` to the workspace root (identified by
 * `pnpm-workspace.yaml`, the one file guaranteed to exist there) finds the
 * same `.env` regardless of which package's script is actually running.
 */
function findMonorepoRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Loads the monorepo's root `.env` into `process.env`, resolving its path
 * from wherever the current process actually started (see
 * `findMonorepoRoot`). Exported on its own - not just as a `parseEnv` side
 * effect - because an app's real entrypoint (e.g. `apps/api/src/main.ts`)
 * needs this to run before any config service constructs, which happens
 * during Nest's dependency-injection bootstrap, earlier than any call to
 * `parseEnv` itself.
 */
export function loadRootEnv(): void {
  const root = findMonorepoRoot(process.cwd());
  loadDotenv(root ? { path: join(root, '.env') } : undefined);
}

export function parseEnv<T extends z.ZodTypeAny>(
  customSchema?: T,
  rawEnv: Record<string, string | undefined> = process.env,
): z.infer<T> {
  loadRootEnv();
  const schema = customSchema ?? baseEnvSchema;
  const result = schema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment configuration:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}
