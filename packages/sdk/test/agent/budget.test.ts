import { describe, expect, it } from 'vitest';
import { AgentBudget } from '../../src/agent/budget.js';

describe('AgentBudget', () => {
  it('starts fully unspent with the configured total', () => {
    const budget = new AgentBudget('250000');
    expect(budget.summary()).toEqual({ totalAtomic: '250000', spentAtomic: '0', remainingAtomic: '250000' });
  });

  it('reduces remaining exactly as payments are recorded', () => {
    const budget = new AgentBudget('250000');
    budget.record('37000');
    expect(budget.summary()).toEqual({ totalAtomic: '250000', spentAtomic: '37000', remainingAtomic: '213000' });
  });

  it('accumulates multiple payments cumulatively, exactly', () => {
    const budget = new AgentBudget('250000');
    budget.record('37000');
    budget.record('50000');
    budget.record('1');
    expect(budget.summary().spentAtomic).toBe('87001');
    expect(budget.summary().remainingAtomic).toBe('162999');
  });

  it('canAfford reflects the current remaining balance, not the original total', () => {
    const budget = new AgentBudget('100000');
    expect(budget.canAfford('100000')).toBe(true);
    budget.record('60000');
    expect(budget.canAfford('40000')).toBe(true);
    expect(budget.canAfford('40001')).toBe(false);
  });

  it('rejects a payment that would exceed the remaining budget, even though it fits the total', () => {
    const budget = new AgentBudget('100000');
    budget.record('90000');
    expect(budget.canAfford('20000')).toBe(false);
  });
});
