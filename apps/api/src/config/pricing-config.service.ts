import { Injectable, Optional } from '@nestjs/common';
import { type PricingConfig, validatePricingConfig } from './pricing.schema.js';
import type { MoneyAmount } from './money.js';

/** Validated at construction — an invalid or missing price fails app startup immediately. */
@Injectable()
export class PricingConfigService {
  private readonly config: PricingConfig;

  constructor(@Optional() customEnv?: Record<string, string | undefined>) {
    this.config = validatePricingConfig(customEnv ?? process.env);
  }

  /** Resolves one configured price by its env key, e.g. "PRICE_ACADEMIC_SEARCH". */
  getAmount(key: keyof PricingConfig): MoneyAmount {
    return this.config[key];
  }

  get raw(): PricingConfig {
    return this.config;
  }
}
