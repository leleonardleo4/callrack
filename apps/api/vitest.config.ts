import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Live smoke tests require real network access and are run explicitly
    // via `pnpm test:providers` / `pnpm test:x402:testnet`, never as part of
    // the default suite.
    exclude: [...configDefaults.exclude, 'test/providers/smoke/**', 'test/x402/testnet-smoke.ts'],
    // Flushes Redis before every test - see test/setup.ts for why: several
    // e2e spec FILES stub different provider responses behind the same
    // request parameters, sharing one cache key, and would otherwise "win"
    // or "lose" against each other's cached results whenever Redis is
    // actually reachable (invisible with no local Redis running, real in
    // CI). Running files sequentially (not in parallel workers) closes the
    // remaining gap: two DIFFERENT files racing the same live Redis
    // instance mid-test, which a per-test flush alone can't fully prevent.
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    // Pricing has no defaults by design (see PricingConfigService) - every
    // e2e test boots the full AppModule via createApp(), so these must be
    // present for the app to start at all. Values mirror .env.example.
    env: {
      PRICE_ACADEMIC_SEARCH: '0.05',
      PRICE_ACADEMIC_WORK: '0.025',
      PRICE_NEWS_SEARCH: '0.05',
      PRICE_NEWS_TRENDS: '0.10',
      PRICE_CRYPTO_PRICE: '0.01',
      PRICE_CRYPTO_MARKET: '0.025',
      PRICE_FX_RATES: '0.01',
      PRICE_WEATHER: '0.015',
      PRICE_GEOCODE: '0.01',
      PRICE_HOLIDAYS: '0.01',
      PRICE_KNOWLEDGE_SEARCH: '0.025',
      PRICE_GOVERNMENT_CENSUS: '0.05',
      PRICE_RESEARCH: '0.25',
      PRICE_INFORMATION_VERIFY: '0.25',
      PRICE_INFORMATION_EVIDENCE: '0.25',
      PRICE_INFORMATION_COMPARE: '0.50',
      // x402 config (Phase 7) has no defaults either - X402ConfigModule is
      // wired into AppModule, so even createApp() (which never installs the
      // x402 middleware itself) still constructs X402ConfigService.
      NETWORK: 'testnet',
      TESTNET_PAY_TO: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
      MAINNET_PAY_TO: 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA',
      TESTNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
      MAINNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
