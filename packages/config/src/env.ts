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

export function parseEnv<T extends z.ZodTypeAny>(
  customSchema?: T,
  rawEnv: Record<string, string | undefined> = process.env,
): z.infer<T> {
  loadDotenv();
  const schema = customSchema ?? baseEnvSchema;
  const result = schema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(`Invalid environment configuration:\n${JSON.stringify(formatted, null, 2)}`);
  }
  return result.data;
}
