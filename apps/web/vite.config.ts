import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadRootEnv } from '@callrack/config';

// Vite's own env loading only exposes VITE_-prefixed vars to import.meta.env
// in the browser; WEB_PORT below is read server-side, in this Node config
// file, so it needs the monorepo root .env loaded the same way apps/api
// does — pnpm/turbo run this with apps/web as cwd, not the root.
loadRootEnv();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
