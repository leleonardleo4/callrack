import { convertToTokenAmount, convertFromTokenAmount } from '@x402/avm';

/**
 * Re-exported from @x402/avm rather than reimplemented: both convert
 * between a decimal USDC string (e.g. "0.10") and atomic base units purely
 * via string/integer arithmetic, never floating point.
 */
export { convertToTokenAmount, convertFromTokenAmount };

const ATOMIC_AMOUNT_PATTERN = /^\d+$/;

/** Parses a non-negative integer atomic-unit string into a bigint. Throws on floats, negatives, or non-numeric input. */
export function parseAtomicAmount(value: string): bigint {
  if (!ATOMIC_AMOUNT_PATTERN.test(value)) {
    throw new Error(`Invalid atomic amount: ${JSON.stringify(value)} (must be a non-negative integer string)`);
  }
  return BigInt(value);
}

/** True if `amount` (atomic units) is less than or equal to `maxAmount` (atomic units) — exact bigint comparison. */
export function isAtomicAmountWithin(amount: string, maxAmount: string): boolean {
  return parseAtomicAmount(amount) <= parseAtomicAmount(maxAmount);
}

/** Sums a list of atomic-unit amounts exactly, returning the result as an atomic-unit string. */
export function sumAtomicAmounts(amounts: readonly string[]): string {
  return amounts.reduce((total, amount) => total + parseAtomicAmount(amount), 0n).toString();
}

/** Subtracts `amount` from `total` (both atomic units), clamped at zero — never negative, never a float. */
export function subtractAtomicAmount(total: string, amount: string): string {
  const result = parseAtomicAmount(total) - parseAtomicAmount(amount);
  return (result < 0n ? 0n : result).toString();
}
