import { describe, expect, it } from 'vitest';
import { deterministicPlanner } from '../../src/agent/planner.js';
import { buildToolsFromCapabilities } from '../../src/agent/tools.js';
import {
  ACADEMIC_SEARCH_CAPABILITY,
  COMPARE_CAPABILITY,
  EVIDENCE_CAPABILITY,
  NEWS_SEARCH_CAPABILITY,
  VERIFY_CAPABILITY,
} from '../fixtures/capabilities.js';

const TOOLS = buildToolsFromCapabilities(
  [ACADEMIC_SEARCH_CAPABILITY, NEWS_SEARCH_CAPABILITY, VERIFY_CAPABILITY, EVIDENCE_CAPABILITY, COMPARE_CAPABILITY],
  6,
);

describe('deterministicPlanner', () => {
  it('plans multiple capabilities for a task that matches more than one keyword rule', () => {
    const plan = deterministicPlanner('Research renewable energy news and academic papers', TOOLS);
    expect(plan.map((step) => step.toolId).sort()).toEqual(['academic.search', 'news.search']);
  });

  it('only plans capabilities that were actually discovered', () => {
    const plan = deterministicPlanner('renewable energy news coverage', [
      buildToolsFromCapabilities([NEWS_SEARCH_CAPABILITY], 6)[0]!,
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.toolId).toBe('news.search');
  });

  it('returns no plan when nothing matches and no fallback tool is available', () => {
    const plan = deterministicPlanner('unrelated task about nothing in particular', []);
    expect(plan).toEqual([]);
  });

  it('carries the task text through as the query input', () => {
    const plan = deterministicPlanner('academic research on soil health', TOOLS);
    const academicStep = plan.find((step) => step.toolId === 'academic.search');
    expect(academicStep?.input).toEqual({ query: 'academic research on soil health', limit: 5 });
  });

  it('plans information.verify for a verification task, passing the task text as the claim', () => {
    const plan = deterministicPlanner('Verify that Nigeria is the most populous country in Africa.', TOOLS);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({
      toolId: 'information.verify',
      input: { claim: 'Verify that Nigeria is the most populous country in Africa.' },
    });
  });

  it('plans information.evidence for an evidence-gathering task', () => {
    const plan = deterministicPlanner('Find evidence for renewable energy investment in Africa', TOOLS);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.toolId).toBe('information.evidence');
  });

  it('plans information.compare for a comparison task', () => {
    const plan = deterministicPlanner('Compare Tesla and Rivian', TOOLS);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.toolId).toBe('information.compare');
  });

  it('only plans the new information capabilities when they were actually discovered', () => {
    const plan = deterministicPlanner('Verify this claim', [buildToolsFromCapabilities([NEWS_SEARCH_CAPABILITY], 6)[0]!]);
    expect(plan).toEqual([]);
  });
});
