import { z } from 'zod';
import { baseEnvSchema } from '@callrack/config';

export const apiConfigSchema = baseEnvSchema.extend({
  API_PREFIX: z.string().min(1, 'API_PREFIX cannot be empty').default('v1'),
  CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN cannot be empty').default('http://localhost:5173'),
  SERVICE_NAME: z.string().default('callrack-api'),
  API_VERSION: z.string().default('0.1.0'),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function validateApiConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): ApiConfig {
  const result = apiConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Callrack API configuration validation failed:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return result.data;
}
