import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { db } from '../src/index.js';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://callrack:callrack_dev_password@localhost:5432/callrack_dev?schema=public';

async function isPostgresReachable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 1000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

const reachable = await isPostgresReachable();

describe.skipIf(!reachable)('packages/db schema (integration)', () => {
  const testSlugSuffix = randomUUID();
  const capabilitySlug = `test-capability-${testSlugSuffix}`;
  const providerSlug = `test-provider-${testSlugSuffix}`;

  afterAll(async () => {
    await db.request.deleteMany({ where: { capability: { slug: capabilitySlug } } });
    await db.capability.deleteMany({ where: { slug: capabilitySlug } });
    await db.provider.deleteMany({ where: { slug: providerSlug } });
    await db.$disconnect();
  });

  it('creates, reads, updates, and deletes a Capability', async () => {
    const created = await db.capability.create({
      data: { slug: capabilitySlug, name: 'Test Capability' },
    });
    expect(created.id).toBeDefined();

    const updated = await db.capability.update({
      where: { id: created.id },
      data: { description: 'updated' },
    });
    expect(updated.description).toBe('updated');

    const found = await db.capability.findUnique({ where: { id: created.id } });
    expect(found?.slug).toBe(capabilitySlug);
  });

  it('enforces the unique constraint on Capability.slug', async () => {
    await expect(
      db.capability.create({ data: { slug: capabilitySlug, name: 'Duplicate' } }),
    ).rejects.toThrow();
  });

  it('links a Request to a Capability and an optional Provider', async () => {
    const capability = await db.capability.findUniqueOrThrow({ where: { slug: capabilitySlug } });
    const provider = await db.provider.create({
      data: { slug: providerSlug, name: 'Test Provider' },
    });

    const request = await db.request.create({
      data: {
        requestId: `req_${testSlugSuffix}`,
        endpoint: '/v1/test',
        status: 'SUCCESS',
        durationMs: 42,
        cacheHit: false,
        capabilityId: capability.id,
        providerId: provider.id,
      },
      include: { capability: true, provider: true },
    });

    expect(request.capability.slug).toBe(capabilitySlug);
    expect(request.provider?.slug).toBe(providerSlug);
  });
});
