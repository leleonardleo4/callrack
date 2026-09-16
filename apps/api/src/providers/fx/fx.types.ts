import type { ProviderAdapter } from '../common/index.js';

export interface FxRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface FxRatesInput {
  base?: string;
  symbols?: string[];
}

export interface FxHistoricalRatesInput extends FxRatesInput {
  date: string;
}

export interface FxConversionInput {
  from: string;
  to: string;
  amount: number;
  date?: string;
}

export interface FxConversionResult {
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  date: string;
}

export interface FxProvider extends ProviderAdapter {
  getCurrentRates(input: FxRatesInput): Promise<FxRates>;
  getHistoricalRates(input: FxHistoricalRatesInput): Promise<FxRates>;
  convert(input: FxConversionInput): Promise<FxConversionResult>;
}
