import { z } from 'zod';
import { isValidMoneyAmount, type MoneyAmount } from './money.js';

const moneyAmountSchema: z.ZodType<MoneyAmount> = z
  .string()
  .min(1, 'price must not be empty')
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: 'price must not be empty' })
  .refine(isValidMoneyAmount, {
    message:
      'price must be a non-negative decimal amount (e.g. "0.01") — no signs, whitespace, or scientific notation',
  });

/**
 * One required, explicitly-configured price per paid capability. There are
 * deliberately no defaults here: a missing price must fail configuration
 * validation, never silently resolve to "0".
 */
export const pricingConfigSchema = z.object({
  PRICE_ACADEMIC_SEARCH: moneyAmountSchema,
  PRICE_ACADEMIC_WORK: moneyAmountSchema,
  PRICE_NEWS_SEARCH: moneyAmountSchema,
  PRICE_NEWS_TRENDS: moneyAmountSchema,
  PRICE_CRYPTO_PRICE: moneyAmountSchema,
  PRICE_CRYPTO_MARKET: moneyAmountSchema,
  PRICE_FX_RATES: moneyAmountSchema,
  PRICE_WEATHER: moneyAmountSchema,
  PRICE_GEOCODE: moneyAmountSchema,
  PRICE_HOLIDAYS: moneyAmountSchema,
  PRICE_KNOWLEDGE_SEARCH: moneyAmountSchema,
  PRICE_GOVERNMENT_CENSUS: moneyAmountSchema,
  PRICE_RESEARCH: moneyAmountSchema,
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

export function validatePricingConfig(
  rawEnv: Record<string, string | undefined> = process.env,
): PricingConfig {
  const result = pricingConfigSchema.safeParse(rawEnv);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Callrack pricing configuration validation failed:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return result.data;
}
