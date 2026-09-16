import { db } from '../src/index.js';

async function main(): Promise<void> {
  await db.capability.upsert({
    where: { slug: 'example-capability' },
    update: {},
    create: {
      slug: 'example-capability',
      name: 'Example Capability',
      description: 'Placeholder capability for local schema verification.',
    },
  });

  await db.provider.upsert({
    where: { slug: 'example-provider' },
    update: {},
    create: {
      slug: 'example-provider',
      name: 'Example Provider',
      description: 'Placeholder provider for local schema verification.',
    },
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
