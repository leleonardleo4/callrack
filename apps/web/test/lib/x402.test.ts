import { describe, expect, it } from 'vitest';
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, type PaymentRequired } from '@/lib/x402';

function base64Encode(value: unknown): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
}

describe('decodePaymentRequiredHeader', () => {
  it('decodes a base64-encoded PAYMENT-REQUIRED challenge', () => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required',
      resource: { url: 'http://localhost/v1/weather', description: 'Weather', mimeType: '' },
      accepts: [
        {
          scheme: 'exact',
          network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
          asset: '10458941',
          amount: '3000',
          payTo: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
      extensions: { bazaar: { info: {} } },
    };

    const decoded = decodePaymentRequiredHeader(base64Encode(challenge));
    expect(decoded).toEqual(challenge);
  });

  it('decodes non-ASCII characters correctly (UTF-8 safe)', () => {
    const challenge: PaymentRequired = {
      x402Version: 2,
      resource: { url: 'http://localhost/v1/news/search', description: 'Café news search — “curated”' },
      accepts: [],
    };
    const decoded = decodePaymentRequiredHeader(base64Encode(challenge));
    expect(decoded.resource.description).toBe('Café news search — “curated”');
  });

  it('throws for malformed base64 input', () => {
    expect(() => decodePaymentRequiredHeader('not-valid-base64!!!')).toThrow();
  });
});

describe('decodePaymentResponseHeader', () => {
  it('decodes an arbitrary settlement payload as JSON', () => {
    const settlement = { success: true, transaction: 'ABC123', network: 'algorand:test' };
    const decoded = decodePaymentResponseHeader(base64Encode(settlement));
    expect(decoded).toEqual(settlement);
  });
});
