import 'reflect-metadata';
import { bootstrap } from './bootstrap.js';

bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
  process.exit(1);
});
