import { describe, expect, it } from 'vitest';
import { buildFxRatesResponse, UnsupportedCurrencyError } from '../../src/fx/fx.mapper.js';
import type { FxRates } from '../../src/providers/fx/fx.types.js';

const RATES: FxRates = { base: 'USD', date: '2026-09-15', rates: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 } };

describe('fx.mapper', () => {
  it('trims the response down to exactly the requested currencies', () => {
    expect(buildFxRatesResponse(RATES, ['EUR', 'GBP'])).toEqual({
      base: 'USD',
      date: '2026-09-15',
      rates: { EUR: 0.85, GBP: 0.74 },
    });
  });

  it('preserves all requested currencies when every one is present', () => {
    expect(buildFxRatesResponse(RATES, ['EUR', 'GBP', 'NGN']).rates).toEqual({
      EUR: 0.85,
      GBP: 0.74,
      NGN: 1530.22,
    });
  });

  it('throws UnsupportedCurrencyError when a requested currency is missing from the response', () => {
    expect(() => buildFxRatesResponse(RATES, ['EUR', 'ZZZ'])).toThrow(UnsupportedCurrencyError);
  });

  it('includes the offending currency code on the error', () => {
    try {
      buildFxRatesResponse(RATES, ['ZZZ']);
      expect.unreachable('expected buildFxRatesResponse to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedCurrencyError);
      expect((error as UnsupportedCurrencyError).currency).toBe('ZZZ');
    }
  });
});
