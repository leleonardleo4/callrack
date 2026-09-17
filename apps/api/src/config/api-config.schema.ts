import { z } from 'zod';
import { baseEnvSchema } from '@callrack/config';

export const apiConfigSchema = baseEnvSchema.extend({
  API_PREFIX: z.string().min(1, 'API_PREFIX cannot be empty').default('v1'),
  SERVICE_NAME: z.string().default('callrack-api'),
  API_VERSION: z.string().default('0.1.0'),

  // Provider configuration (Phase 3). Only real, currently-used settings —
  // no invented credentials for providers that don't require them.
  OPENALEX_MAILTO: z.string().email().optional(),
  CROSSREF_MAILTO: z.string().email().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  CENSUS_API_KEY: z.string().optional(),

  // Self-hostable in production; default to the public hosted service for
  // local development.
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com'),
  PHOTON_BASE_URL: z.string().url().default('https://photon.komoot.io'),
  WIKIMEDIA_BASE_URL: z.string().url().default('https://www.wikidata.org'),
  WIKIMEDIA_USER_AGENT: z.string().min(1).default('Callrack/0.1 (+https://callrack.dev)'),
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
