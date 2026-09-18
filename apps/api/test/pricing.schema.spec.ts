import { describe, expect, it } from 'vitest';
import { isValidMoneyAmount } from '../src/config/money.js';
import { validatePricingConfig } from '../src/config/pricing.schema.js';

const VALID_ENV: Record<string, string> = {
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

describe('isValidMoneyAmount', () => {
  it.each(['0.01', '0.005', '1', '0', '10.5', '123.456789'])('accepts "%s"', (value) => {
    expect(isValidMoneyAmount(value)).toBe(true);
  });

  it.each(['-1', '-0.01', '', ' ', '0.01 ', ' 0.01', '1e5', '1E-5', '+0.01', '.5', '5.', 'abc', 'NaN', 'Infinity', '0x10'])(
    'rejects "%s"',
    (value) => {
      expect(isValidMoneyAmount(value)).toBe(false);
    },
  );
});

describe('validatePricingConfig', () => {
  it('accepts a fully valid configuration and preserves exact decimal strings', () => {
    const config = validatePricingConfig(VALID_ENV);

    expect(config.PRICE_ACADEMIC_SEARCH).toBe('0.01');
    expect(config.PRICE_RESEARCH).toBe('0.05');
    expect(typeof config.PRICE_ACADEMIC_SEARCH).toBe('string');
  });

  it('trims incidental surrounding whitespace without changing the value', () => {
    const config = validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '  0.003  ' });
    expect(config.PRICE_WEATHER).toBe('0.003');
  });

  it('fails when a required price is missing entirely', () => {
    const { PRICE_WEATHER, ...rest } = VALID_ENV;
    expect(() => validatePricingConfig(rest)).toThrow(/Callrack pricing configuration validation failed/);
  });

  it('fails when a required price is an empty string', () => {
    expect(() => validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('fails when a required price is whitespace only', () => {
    expect(() => validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '   ' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('fails when a price is negative', () => {
    expect(() => validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '-1' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('fails when a price is not a valid decimal string', () => {
    expect(() => validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: 'abc' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('fails when a price uses scientific notation', () => {
    expect(() => validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '3e-3' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('does not silently default a missing price to zero', () => {
    const { PRICE_GOVERNMENT_CENSUS, ...rest } = VALID_ENV;
    let thrown = false;
    try {
      validatePricingConfig(rest);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('allows an explicitly configured zero price', () => {
    const config = validatePricingConfig({ ...VALID_ENV, PRICE_WEATHER: '0' });
    expect(config.PRICE_WEATHER).toBe('0');
  });
});
