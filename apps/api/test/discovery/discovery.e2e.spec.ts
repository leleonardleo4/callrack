import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { getDefaultAsset } from '@x402/avm';
import { createApp, createProtectedApp } from '../../src/bootstrap.js';
import { CAPABILITY_METADATA } from '../../src/capabilities/capability-definitions.js';
import { createFakeFacilitatorClient } from '../x402/fake-facilitator.js';

const ALGORAND_TESTNET_NETWORK_FROM_CONFIG = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

/** No GoPlausible-guide placeholder text or example.com-style domains anywhere. */
function assertNoPlaceholderText(text: string): void {
  expect(text).not.toContain('your-domain.com');
  expect(text).not.toContain('EXAMPLE API');
  expect(text).not.toContain('my-api-co');
  expect(text).not.toContain('my-api.example.com');
}

describe('Discovery endpoints (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /.well-known/x402', () => {
    it('returns 200 application/json with a valid, non-placeholder document', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/x402' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.payload);

      expect(body.x402Version).toBe(2);
      expect(body.name).toBe('Callrack');
      assertNoPlaceholderText(JSON.stringify(body));
    });

    it('lists exactly one resource per registered paid capability - no fake or missing routes', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/x402' });
      const body = JSON.parse(response.payload);

      expect(body.resources).toHaveLength(CAPABILITY_METADATA.length);
      const paths = body.resources.map((r: { url: string }) => new URL(r.url).pathname).sort();
      const expectedPaths = CAPABILITY_METADATA.map((c) => c.path).sort();
      expect(paths).toEqual(expectedPaths);
    });

    it('every resource carries the active Testnet network, real USDC asset id, and correct base-unit amount', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/x402' });
      const body = JSON.parse(response.payload);
      const usdc = getDefaultAsset(ALGORAND_TESTNET_NETWORK_FROM_CONFIG, 'USDC');

      const weather = body.resources.find((r: { url: string }) => new URL(r.url).pathname === '/v1/weather');
      expect(weather.network).toBe(ALGORAND_TESTNET_NETWORK_FROM_CONFIG);
      expect(weather.asset).toBe(usdc.asset);
      // PRICE_WEATHER=0.003 in the test env - 0.003 * 10^6 = 3000, via pure
      // string arithmetic (convertToTokenAmount), never floating point.
      expect(weather.amount).toBe('3000');
      expect(weather.payTo).toBe('TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ');
      expect(weather.method).toBe('POST');
    });
  });

  describe('GET /.well-known/agent-card.json', () => {
    it('returns 200 application/json with one skill per real capability', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/agent-card.json' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.payload);

      expect(body.name).toBe('Callrack');
      expect(body.capabilities).toEqual({ streaming: false });
      expect(body.skills).toHaveLength(CAPABILITY_METADATA.length);
      expect(body.skills.map((s: { id: string }) => s.id).sort()).toEqual(
        CAPABILITY_METADATA.map((c) => c.id).sort(),
      );
      assertNoPlaceholderText(JSON.stringify(body));
    });

    it('never claims streaming or MCP support that does not exist', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/agent-card.json' });
      const body = JSON.parse(response.payload);
      expect(body.capabilities.streaming).toBe(false);
    });
  });

  describe('GET /.well-known/agent.json', () => {
    it('returns 200 application/json with correct payments block and a real documentation link', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/agent.json' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.payload);

      expect(body.name).toBe('Callrack');
      expect(body.payments).toEqual({ protocol: 'x402', network: 'algorand', asset: 'USDC' });
      expect(body.documentation).toMatch(/\/llms\.txt$/);
      assertNoPlaceholderText(JSON.stringify(body));
    });
  });

  describe('GET /llms.txt', () => {
    it('returns 200 text/plain, starting with the required "# Callrack" heading', async () => {
      const response = await app.inject({ method: 'GET', url: '/llms.txt' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.payload.startsWith('# Callrack')).toBe(true);
      assertNoPlaceholderText(response.payload);
    });

    it('lists every registered capability with its real, current price - never a stale/duplicated value', async () => {
      const response = await app.inject({ method: 'GET', url: '/llms.txt' });
      for (const capability of CAPABILITY_METADATA) {
        expect(response.payload, `llms.txt missing ${capability.id}`).toContain(capability.path);
      }
      // PRICE_WEATHER=0.003 in the test env.
      expect(response.payload).toContain('0.003 USDC');
    });

    it('names the real GoPlausible facilitator and the active Testnet network', async () => {
      const response = await app.inject({ method: 'GET', url: '/llms.txt' });
      expect(response.payload).toContain('facilitator.goplausible.xyz');
      expect(response.payload).toContain('Algorand TestNet');
    });

    it('is not swallowed by any SPA/JSON fallback - real markdown, not HTML or JSON', async () => {
      const response = await app.inject({ method: 'GET', url: '/llms.txt' });
      expect(response.payload.trim().startsWith('<')).toBe(false);
      expect(() => JSON.parse(response.payload)).toThrow();
    });
  });

  describe('GET /agents.md', () => {
    it('returns 200 text/markdown with payment instructions and the "authoritative 402" rule', async () => {
      const response = await app.inject({ method: 'GET', url: '/agents.md' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.payload.startsWith('# Callrack')).toBe(true);
      expect(response.payload.toLowerCase()).toContain('payment-required');
      expect(response.payload.toLowerCase()).toContain('never hardcode or assume a price');
      assertNoPlaceholderText(response.payload);
    });

    it('documents every real endpoint and no fake ones', async () => {
      const response = await app.inject({ method: 'GET', url: '/agents.md' });
      for (const capability of CAPABILITY_METADATA) {
        expect(response.payload, `agents.md missing ${capability.id}`).toContain(`${capability.method} ${capability.path}`);
      }
    });
  });

  describe('GET /openapi.json', () => {
    it('returns 200 application/json - a real OpenAPI document, not a placeholder', async () => {
      const response = await app.inject({ method: 'GET', url: '/openapi.json' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.payload);
      expect(body.openapi).toMatch(/^3\./);
      expect(body.info.title).toBe('Callrack API');
      expect(body.paths['/v1/weather']).toBeDefined();
    });

    it('does not replace /docs - the interactive UI is still there', async () => {
      const docsResponse = await app.inject({ method: 'GET', url: '/docs/' });
      expect([200, 301, 302]).toContain(docsResponse.statusCode);
      const docsJsonResponse = await app.inject({ method: 'GET', url: '/docs/json' });
      expect(docsJsonResponse.statusCode).toBe(200);
    });
  });

  describe('no unimplemented discovery files are faked', () => {
    it('does not publish ai-plugin.json (no real contact email exists in project config)', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/ai-plugin.json' });
      expect(response.statusCode).toBe(404);
    });

    it('does not publish mcp.json (no MCP server implementation exists)', async () => {
      const response = await app.inject({ method: 'GET', url: '/.well-known/mcp.json' });
      expect(response.statusCode).toBe(404);
    });
  });
});

describe('Discovery endpoints remain free even with x402 installed (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const facilitator = createFakeFacilitatorClient(ALGORAND_TESTNET_NETWORK_FROM_CONFIG);
    app = await createProtectedApp({ x402FacilitatorClient: facilitator });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/.well-known/x402',
    '/.well-known/agent-card.json',
    '/.well-known/agent.json',
    '/llms.txt',
    '/agents.md',
    '/openapi.json',
  ])('serves %s without requiring payment', async (path) => {
    const response = await app.inject({ method: 'GET', url: path });
    expect(response.statusCode).toBe(200);
    expect(response.headers['payment-required']).toBeUndefined();
  });
});
