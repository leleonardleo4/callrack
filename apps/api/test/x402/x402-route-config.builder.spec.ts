import { describe, expect, it } from 'vitest';
import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm';
import { buildX402RoutesConfig, X402_GLOBAL_CHALLENGE_TAG } from '../../src/x402/x402-route-config.builder.js';
import { CAPABILITY_METADATA } from '../../src/capabilities/capability-definitions.js';
import { resolveCapabilityDefinition } from '../../src/capabilities/capability-registry.util.js';
import type { CapabilityDefinition } from '../../src/capabilities/capability.types.js';
import type { ActiveX402NetworkConfig } from '../../src/config/x402-config.service.js';

const PRICES: Record<string, string> = {
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
  PRICE_INFORMATION_VERIFY: '0.05',
  PRICE_INFORMATION_EVIDENCE: '0.05',
  PRICE_INFORMATION_COMPARE: '0.10',
};

const ACTIVE: ActiveX402NetworkConfig = {
  network: 'testnet',
  caip2Network: ALGORAND_TESTNET_CAIP2,
  payTo: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
  facilitatorUrl: 'https://facilitator.goplausible.xyz',
};

function realCapabilities(): CapabilityDefinition[] {
  return CAPABILITY_METADATA.map((metadata) => resolveCapabilityDefinition(metadata, (key) => PRICES[key]));
}

describe('buildX402RoutesConfig', () => {
  it('produces exactly one route entry per capability, keyed "METHOD /path"', () => {
    const capabilities = realCapabilities();
    const routes = buildX402RoutesConfig(capabilities, ACTIVE);

    expect(Object.keys(routes).sort()).toEqual(
      capabilities.map((c) => `${c.method} ${c.path}`).sort(),
    );
  });

  it('carries the exact registry price through as the x402 price, never a duplicated/re-declared amount', () => {
    const capabilities = realCapabilities();
    const routes = buildX402RoutesConfig(capabilities, ACTIVE) as Record<
      string,
      { accepts: { price: string; payTo: string; network: string; scheme: string } }
    >;

    const weather = capabilities.find((c) => c.id === 'weather')!;
    expect(routes['POST /v1/weather'].accepts.price).toBe(weather.price.amount);
    expect(routes['POST /v1/weather'].accepts.price).toBe('0.003');

    const research = capabilities.find((c) => c.id === 'research')!;
    expect(routes['POST /v1/research'].accepts.price).toBe('0.05');

    expect(routes['POST /v1/verify'].accepts.price).toBe('0.05');
    expect(routes['POST /v1/evidence'].accepts.price).toBe('0.05');
    expect(routes['POST /v1/compare'].accepts.price).toBe('0.10');
  });

  it('uses the "exact" scheme and the active CAIP-2 network for every route', () => {
    const routes = buildX402RoutesConfig(realCapabilities(), ACTIVE) as Record<
      string,
      { accepts: { network: string; scheme: string } }
    >;
    for (const route of Object.values(routes)) {
      expect(route.accepts.scheme).toBe('exact');
      expect(route.accepts.network).toBe(ALGORAND_TESTNET_CAIP2);
    }
  });

  it('gives every route the same active payTo - one payment destination across all Callrack endpoints', () => {
    const routes = buildX402RoutesConfig(realCapabilities(), ACTIVE) as Record<string, { accepts: { payTo: string } }>;
    const payTos = new Set(Object.values(routes).map((route) => route.accepts.payTo));
    expect(payTos.size).toBe(1);
    expect([...payTos][0]).toBe(ACTIVE.payTo);
  });

  it('switches every route to the Mainnet payTo/network when the active config is Mainnet', () => {
    const mainnetActive: ActiveX402NetworkConfig = {
      network: 'mainnet',
      caip2Network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
      payTo: 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA',
      facilitatorUrl: 'https://facilitator.goplausible.xyz',
    };
    const routes = buildX402RoutesConfig(realCapabilities(), mainnetActive) as Record<
      string,
      { accepts: { payTo: string; network: string } }
    >;
    expect(routes['POST /v1/weather'].accepts.payTo).toBe(mainnetActive.payTo);
    expect(routes['POST /v1/weather'].accepts.network).toBe(mainnetActive.caip2Network);
  });

  it('carries the registry description through to the route', () => {
    const capabilities = realCapabilities();
    const routes = buildX402RoutesConfig(capabilities, ACTIVE) as Record<string, { description?: string }>;
    const weather = capabilities.find((c) => c.id === 'weather')!;
    expect(routes['POST /v1/weather'].description).toBe(weather.description);
  });

  it('never emits a route for a capability that is not in the registry', () => {
    const routes = buildX402RoutesConfig(realCapabilities(), ACTIVE);
    expect(routes['GET /health']).toBeUndefined();
    expect(routes['GET /health/ready']).toBeUndefined();
    expect(routes['GET /docs']).toBeUndefined();
  });

  it('produces an empty route set for an empty capability list', () => {
    expect(buildX402RoutesConfig([], ACTIVE)).toEqual({});
  });

  it('attaches the x402-global-challenge tag to every route\'s payment extra on Testnet', () => {
    const routes = buildX402RoutesConfig(realCapabilities(), ACTIVE) as Record<
      string,
      { accepts: { extra?: Record<string, unknown> } }
    >;
    expect(X402_GLOBAL_CHALLENGE_TAG).toBe('x402-global-challenge');
    for (const [key, route] of Object.entries(routes)) {
      expect(route.accepts.extra?.tag, `expected challenge tag on Testnet route ${key}`).toBe(X402_GLOBAL_CHALLENGE_TAG);
    }
  });

  it('attaches the x402-global-challenge tag to every route\'s payment extra on Mainnet', () => {
    const mainnetActive: ActiveX402NetworkConfig = {
      network: 'mainnet',
      caip2Network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      payTo: 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA',
      facilitatorUrl: 'https://facilitator.goplausible.xyz',
    };
    const routes = buildX402RoutesConfig(realCapabilities(), mainnetActive) as Record<
      string,
      { accepts: { extra?: Record<string, unknown> } }
    >;
    for (const [key, route] of Object.entries(routes)) {
      expect(route.accepts.extra?.tag, `expected challenge tag on Mainnet route ${key}`).toBe(X402_GLOBAL_CHALLENGE_TAG);
    }
  });

  it('does not include a Bazaar discovery extension when no discovery map is provided', () => {
    const routes = buildX402RoutesConfig(realCapabilities(), ACTIVE) as Record<
      string,
      { extensions?: Record<string, unknown> }
    >;
    expect(routes['POST /v1/weather'].extensions).toBeUndefined();
  });

  it('attaches the matching Bazaar discovery extension per capability when a discovery map is provided', () => {
    const capabilities = realCapabilities();
    const discoveryExtensions = new Map<string, Record<string, unknown>>([
      ['weather', { bazaar: { marker: 'weather-extension' } }],
      ['research', { bazaar: { marker: 'research-extension' } }],
    ]);
    const routes = buildX402RoutesConfig(capabilities, ACTIVE, discoveryExtensions) as Record<
      string,
      { extensions?: Record<string, unknown> }
    >;

    expect(routes['POST /v1/weather'].extensions).toEqual({ bazaar: { marker: 'weather-extension' } });
    expect(routes['POST /v1/research'].extensions).toEqual({ bazaar: { marker: 'research-extension' } });
    // A capability absent from the discovery map gets no extensions field at all.
    expect(routes['POST /v1/holidays'].extensions).toBeUndefined();
  });
});
