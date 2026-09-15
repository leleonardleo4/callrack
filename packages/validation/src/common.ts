import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const healthCheckQuerySchema = z.object({
  verbose: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
});

export type HealthCheckQuery = z.infer<typeof healthCheckQuerySchema>;
