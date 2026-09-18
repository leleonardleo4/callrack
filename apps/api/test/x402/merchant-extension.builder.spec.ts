import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildX402MerchantExtension, CALLRACK_MERCHANT_INFO } from '../../src/x402/merchant-extension.builder.js';

describe('buildX402MerchantExtension', () => {
  it('declares the x402-merchant extension key with an info + schema shape', () => {
    const extension = buildX402MerchantExtension();
    expect(Object.keys(extension)).toEqual(['x402-merchant']);

    const merchant = extension['x402-merchant'] as { info: unknown; schema: unknown };
    expect(merchant.info).toBeDefined();
    expect(merchant.schema).toBeDefined();
  });

  it('declares the real Callrack merchant identity - never a placeholder', () => {
    expect(CALLRACK_MERCHANT_INFO.name).toBe('Callrack');
    expect(CALLRACK_MERCHANT_INFO.website).toBe('https://callrack.xyz');
    expect(CALLRACK_MERCHANT_INFO.categories).toContain('algorand');
    expect(CALLRACK_MERCHANT_INFO.categories).toContain('x402');
  });

  it('points the logo at a real, currently-committed brand asset (not an invented URL)', () => {
    expect(CALLRACK_MERCHANT_INFO.logo).toBe('https://callrack.xyz/favicon.png');
    // Verified directly against the filesystem (not by convention/trust) so
    // this test fails loudly if the asset is ever renamed/removed without
    // also updating the merchant declaration.
    const assetPath = fileURLToPath(new URL('../../../web/public/favicon.png', import.meta.url));
    expect(existsSync(assetPath)).toBe(true);
  });

  it('the declared JSON Schema accurately describes the info object (matching field names/types)', () => {
    const extension = buildX402MerchantExtension();
    const merchant = extension['x402-merchant'] as {
      info: Record<string, unknown>;
      schema: { required: string[]; properties: Record<string, { type: string }> };
    };

    for (const key of Object.keys(merchant.info)) {
      expect(merchant.schema.properties[key], `schema is missing property "${key}"`).toBeDefined();
    }
    expect(merchant.schema.required).toContain('name');
    expect(merchant.schema.properties.name.type).toBe('string');
    expect(merchant.schema.properties.categories.type).toBe('array');
  });

  it('is the same, single identity for every call - not per-route data', () => {
    const first = buildX402MerchantExtension();
    const second = buildX402MerchantExtension();
    expect(first).toEqual(second);
  });
});
