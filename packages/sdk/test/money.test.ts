import { describe, expect, it } from 'vitest';
import {
  convertToTokenAmount,
  isAtomicAmountWithin,
  parseAtomicAmount,
  subtractAtomicAmount,
  sumAtomicAmounts,
} from '../src/money.js';

describe('money', () => {
  it('parses a valid atomic amount string', () => {
    expect(parseAtomicAmount('10000')).toBe(10000n);
    expect(parseAtomicAmount('0')).toBe(0n);
  });

  it('rejects non-integer or malformed atomic amounts', () => {
    expect(() => parseAtomicAmount('1.5')).toThrow();
    expect(() => parseAtomicAmount('-1')).toThrow();
    expect(() => parseAtomicAmount('abc')).toThrow();
    expect(() => parseAtomicAmount('')).toThrow();
  });

  it('compares atomic amounts exactly, never via floating point', () => {
    expect(isAtomicAmountWithin('10000', '10000')).toBe(true);
    expect(isAtomicAmountWithin('9999', '10000')).toBe(true);
    expect(isAtomicAmountWithin('10001', '10000')).toBe(false);
  });

  it('sums a list of atomic amounts exactly', () => {
    expect(sumAtomicAmounts(['10000', '25000', '5'])).toBe('35005');
    expect(sumAtomicAmounts([])).toBe('0');
  });

  it('subtracts atomic amounts, clamped at zero', () => {
    expect(subtractAtomicAmount('10000', '4000')).toBe('6000');
    expect(subtractAtomicAmount('1000', '5000')).toBe('0');
  });

  it('converts a decimal USDC string to atomic base units without floating point', () => {
    expect(convertToTokenAmount('0.01', 6)).toBe('10000');
    expect(convertToTokenAmount('1.00', 6)).toBe('1000000');
    // A classic floating-point trap (0.1 + 0.2 !== 0.3) must not surface here.
    expect(convertToTokenAmount('0.1', 6)).toBe('100000');
  });
});
