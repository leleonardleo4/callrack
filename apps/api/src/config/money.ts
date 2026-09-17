/**
 * An exact decimal-string monetary amount (e.g. "0.01"). Never a `number` —
 * binary floating point cannot represent amounts like 0.1 + 0.2 exactly,
 * which is unacceptable for anything that will eventually settle a real
 * payment. Every price in the system is carried as this type end to end.
 */
export type MoneyAmount = string;

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

/**
 * True for a well-formed, non-negative decimal string: digits, an optional
 * single decimal point followed by more digits, and nothing else — no sign,
 * no leading/trailing whitespace, no scientific notation, no thousands
 * separators.
 */
export function isValidMoneyAmount(value: string): boolean {
  return MONEY_PATTERN.test(value);
}
