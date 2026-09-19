import { z } from 'zod';
import { baseEnvSchema } from '@callrack/config';

/**
 * `z.coerce.boolean()` treats any non-empty string (including `"false"`) as
 * `true`, which is wrong for an env var meant to be toggled off - this
 * parses the handful of conventional truthy/falsy string forms explicitly
 * instead.
 */
const booleanEnvVar = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return defaultValue;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

export const apiConfigSchema = baseEnvSchema.extend({
  API_PREFIX: z.string().min(1, 'API_PREFIX cannot be empty').default('v1'),
  API_VERSION: z.string().default('0.1.0'),

  // Production hardening (Phase 11). Defaults are safe for local
  // development (behind no proxy, generous limits); a real deployment
  // behind a reverse proxy/load balancer should confirm TRUST_PROXY is
  // appropriate for its topology (see docs/DEPLOYMENT.md).
  TRUST_PROXY: booleanEnvVar(true),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1_048_576), // 1 MiB - matches Fastify's own default; explicit so it's documented, not implicit.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300), // requests per window, per client IP
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // Set only when REDIS_URL points at a keyspace shared with unrelated
  // applications (see @callrack/redis's createRedisClient) - left unset,
  // no prefix is applied at all, matching every environment's behavior
  // before this existed.
  REDIS_KEY_PREFIX: z.string().optional(),

  // Provider configuration (Phase 3). Only real, currently-used settings -
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
