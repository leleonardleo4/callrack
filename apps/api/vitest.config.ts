import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Live smoke tests require real network access and are run explicitly
    // via `pnpm test:providers`, never as part of the default suite.
    exclude: [...configDefaults.exclude, 'test/providers/smoke/**'],
    // Pricing has no defaults by design (see PricingConfigService) — every
    // e2e test boots the full AppModule via createApp(), so these must be
    // present for the app to start at all. Values mirror .env.example.
    env: {
      PRICE_ACADEMIC_SEARCH: '0.01',
      PRICE_ACADEMIC_WORK: '0.005',
      PRICE_NEWS_SEARCH: '0.01',
      PRICE_NEWS_TRENDS: '0.02',
      PRICE_CRYPTO_PRICE: '0.002',
      PRICE_CRYPTO_MARKET: '0.005',
      PRICE_FX_RATES: '0.002',
      PRICE_WEATHER: '0.003',
      PRICE_GEOCODE: '0.002',
      PRICE_HOLIDAYS: '0.002',
      PRICE_KNOWLEDGE_SEARCH: '0.005',
      PRICE_GOVERNMENT_CENSUS: '0.01',
      PRICE_RESEARCH: '0.05',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
