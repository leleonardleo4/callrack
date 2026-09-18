import { describe, expect, it } from 'vitest';
import { PricingConfigService } from '../src/config/pricing-config.service.js';

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

describe('PricingConfigService', () => {
  it('resolves a configured price by its env key as an exact string', () => {
    const service = new PricingConfigService(VALID_ENV);

    expect(service.getAmount('PRICE_ACADEMIC_SEARCH')).toBe('0.01');
    expect(service.getAmount('PRICE_RESEARCH')).toBe('0.05');
  });

  it('changing an env value changes the resolved price without any code change', () => {
    const defaultPriced = new PricingConfigService(VALID_ENV);
    const repriced = new PricingConfigService({ ...VALID_ENV, PRICE_WEATHER: '0.999' });

    expect(defaultPriced.getAmount('PRICE_WEATHER')).toBe('0.003');
    expect(repriced.getAmount('PRICE_WEATHER')).toBe('0.999');
  });

  it('throws at construction when a required price is missing', () => {
    const { PRICE_RESEARCH, ...rest } = VALID_ENV;
    expect(() => new PricingConfigService(rest)).toThrow(/Callrack pricing configuration validation failed/);
  });

  it('throws at construction when a price is negative', () => {
    expect(() => new PricingConfigService({ ...VALID_ENV, PRICE_RESEARCH: '-0.05' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('throws at construction when a price is not a valid decimal', () => {
    expect(() => new PricingConfigService({ ...VALID_ENV, PRICE_RESEARCH: 'free' })).toThrow(
      /Callrack pricing configuration validation failed/,
    );
  });

  it('exposes the full raw validated config', () => {
    const service = new PricingConfigService(VALID_ENV);
    expect(service.raw).toEqual(VALID_ENV);
  });
});
