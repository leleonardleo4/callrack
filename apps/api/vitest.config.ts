import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Live smoke tests require real network access and are run explicitly
    // via `pnpm test:providers`, never as part of the default suite.
    exclude: [...configDefaults.exclude, 'test/providers/smoke/**'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
