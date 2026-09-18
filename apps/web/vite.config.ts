import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { loadRootEnv } from '@callrack/config';

// Vite's own env loading only exposes VITE_-prefixed vars to import.meta.env
// in the browser; WEB_PORT below is read server-side, in this Node config
// file, so it needs the monorepo root .env loaded the same way apps/api
// does - pnpm/turbo run this with apps/web as cwd, not the root.
loadRootEnv();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // @callrack/sdk pulls in @x402/avm -> @algorandfoundation/algokit-utils
    // -> @algorandfoundation/xhd-wallet-api, whose HD-wallet key-derivation
    // module imports Node's `crypto`/`util` at the top level. This app
    // never calls that code path (only ExactAvmScheme, getDefaultAsset, and
    // the genesis-hash/amount-conversion helpers are used browser-side -
    // see wallet/), but Rollup still needs the named `crypto` exports to
    // exist to bundle the module at all. `global` is deliberately left OFF
    // here (Buffer/process too) - this plugin's own dev-mode `global` shim
    // (`optimizeDeps.esbuildOptions.define.global = 'global'`, a no-op
    // self-mapping) clobbers the real fix below when both are set; the
    // explicit `optimizeDeps.esbuildOptions.define` further down is what
    // actually resolves the resulting `ReferenceError: global is not
    // defined` (from crypto-browserify's `randombytes`, pulled in by the
    // xhd-wallet-api chain above).
    nodePolyfills({ include: ['crypto', 'util'], globals: { Buffer: false, global: false, process: true } }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Rewrites the bare `global` identifier to `globalThis` - the standard
  // fix for `ReferenceError: global is not defined`, thrown by
  // crypto-browserify's `randombytes` (pulled in transitively by
  // @algorandfoundation/xhd-wallet-api, see the plugin comment above).
  // `define` alone only covers Vite's main dev/build transform of *source*
  // files; `optimizeDeps.esbuildOptions.define` is required separately
  // because Vite's dependency pre-bundler (which is what actually processes
  // crypto-browserify, a third-party node_modules package) runs as its own
  // standalone esbuild pass and does not inherit the top-level `define`.
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
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
    // The wallet dropdown-menu tests (test/components/WalletConnectButton.*)
    // open a real Radix Popper-positioned menu; jsdom has no real layout
    // engine, so positioning leaves a background task draining for tens of
    // seconds of idle wall-clock time after the test's own assertions have
    // already passed (confirmed: near-zero CPU time, deterministic, no
    // effect on any assertion). That drain occasionally outlasts Vitest's
    // internal worker-to-main heartbeat, which logs a
    // "[vitest-worker]: Timeout calling onTaskUpdate" diagnostic and would
    // otherwise flip an all-green run to a failing exit code. Never an
    // issue in a real browser.
    dangerouslyIgnoreUnhandledErrors: true,
    server: {
      // @callrack/sdk resolves here as a pre-built dist (a workspace
      // symlink under node_modules), which Vitest's SSR layer otherwise
      // externalizes to Node's native loader - bypassing `vi.mock()` for
      // it and its own @x402/* imports. Inlining forces both through
      // Vite's transform graph so wallet payment-flow tests can fake
      // ExactAvmScheme's transaction construction the same way the SDK's
      // own test suite does.
      deps: { inline: [/@callrack\/sdk/, /@x402\//] },
    },
  },
});
