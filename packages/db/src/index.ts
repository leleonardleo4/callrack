import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://callrack:callrack_dev_password@localhost:5432/callrack_dev?schema=public';

// Default matches `pg`'s own default (10) — explicit so it's documented and
// tunable per deployment (see docs/DEPLOYMENT.md's connection pooling
// section), since a serverless/small-plan Postgres instance's total
// connection limit can be exhausted by a few over-eager replicas otherwise.
// SSL/TLS for managed providers is configured via the DATABASE_URL itself
// (e.g. `?sslmode=require`), which `pg` parses automatically — not here.
const poolMax = Number(process.env.DATABASE_POOL_MAX) || 10;

const pool = new pg.Pool({ connectionString, max: poolMax });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export { PrismaClient };
