import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Config for live provider smoke tests. Run explicitly via
 * `pnpm test:providers` — never part of the default `pnpm test`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/providers/smoke/**/*.smoke.spec.ts'],
    testTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
