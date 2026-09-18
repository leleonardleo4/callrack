import { isAtomicAmountWithin, parseAtomicAmount, subtractAtomicAmount, sumAtomicAmounts } from '../money.js';
import type { AgentBudgetSummary } from './types.js';

/**
 * Task-level spend tracker, exact atomic USDC base units throughout -
 * never floating point. Sits above `CallrackSpendPolicy`'s own per-payment
 * cap: a payment can pass the client's spend policy (a single payment within
 * its per-payment max) and still be rejected here for exceeding what's left
 * of the task's overall budget.
 */
export class AgentBudget {
  private readonly totalAtomic: string;
  private spentAtomic: string = '0';

  constructor(totalAtomic: string) {
    parseAtomicAmount(totalAtomic);
    this.totalAtomic = totalAtomic;
  }

  get remainingAtomic(): string {
    return subtractAtomicAmount(this.totalAtomic, this.spentAtomic);
  }

  canAfford(amountAtomic: string): boolean {
    return isAtomicAmountWithin(amountAtomic, this.remainingAtomic);
  }

  record(amountAtomic: string): void {
    this.spentAtomic = sumAtomicAmounts([this.spentAtomic, amountAtomic]);
  }

  summary(): AgentBudgetSummary {
    return {
      totalAtomic: this.totalAtomic,
      spentAtomic: this.spentAtomic,
      remainingAtomic: this.remainingAtomic,
    };
  }
}
