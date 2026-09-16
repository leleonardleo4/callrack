import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://callrack:callrack_dev_password@localhost:5432/callrack_dev?schema=public',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
