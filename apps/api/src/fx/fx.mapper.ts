import type { FxRates } from '../providers/fx/fx.types.js';
import type { FxRatesResponseData } from './fx-response.types.js';

/**
 * Thrown when a requested currency never appears in the provider's response
 * — per the FX contract, an unsupported currency is a clear error, never a
 * silently partial result.
 */
export class UnsupportedCurrencyError extends Error {
  constructor(public readonly currency: string) {
    super(`Currency "${currency}" is not supported.`);
    this.name = 'UnsupportedCurrencyError';
  }
}

/** Validates completeness and trims the response down to exactly what was requested. */
export function buildFxRatesResponse(rates: FxRates, requestedCurrencies: string[]): FxRatesResponseData {
  for (const code of requestedCurrencies) {
    if (!(code in rates.rates)) {
      throw new UnsupportedCurrencyError(code);
    }
  }

  const entries = requestedCurrencies.map((code) => [code, rates.rates[code] as number] as const);
  return { base: rates.base, date: rates.date, rates: Object.fromEntries(entries) };
}
