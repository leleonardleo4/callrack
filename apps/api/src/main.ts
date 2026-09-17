import 'reflect-metadata';
import { loadRootEnv } from '@callrack/config';
import { bootstrap } from './bootstrap.js';

// Must run before `bootstrap()` is called: config services read
// `process.env` synchronously during Nest's dependency-injection bootstrap.
// Only the real process entrypoint does this — tests call
// `createApp()`/`createProtectedApp()` directly with their own deliberate
// env, and should never have a `.env` file silently loaded on top of that.
loadRootEnv();

bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
  process.exit(1);
});
