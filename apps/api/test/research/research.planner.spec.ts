import { describe, expect, it } from 'vitest';
import { planResearch } from '../../src/research/research.planner.js';
import type { ResearchRequestDto } from '../../src/research/dto/research-request.dto.js';

function dto(overrides: Partial<ResearchRequestDto> = {}): ResearchRequestDto {
  return { query: 'renewable energy investment in Africa', ...overrides } as ResearchRequestDto;
}

describe('planResearch', () => {
  it('defaults to academic + news + knowledge when sources are omitted', () => {
    expect(planResearch(dto())).toEqual({ sources: ['academic', 'news', 'knowledge'] });
  });

  it('never auto-selects government by default', () => {
    const plan = planResearch(dto());
    expect(plan.sources).not.toContain('government');
  });

  it('uses exactly the explicitly requested sources', () => {
    expect(planResearch(dto({ sources: ['academic', 'news'] }))).toEqual({ sources: ['academic', 'news'] });
  });

  it('includes government only when explicitly requested', () => {
    const plan = planResearch(
      dto({
        sources: ['government'],
        government: { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' },
      }),
    );
    expect(plan.sources).toEqual(['government']);
  });

  it('deduplicates repeated source names', () => {
    expect(planResearch(dto({ sources: ['academic', 'academic', 'news'] }))).toEqual({
      sources: ['academic', 'news'],
    });
  });

  it('is deterministic: identical input always produces identical output', () => {
    const input = dto({ sources: ['news', 'academic'] });
    expect(planResearch(input)).toEqual(planResearch(input));
  });

  it('preserves explicit source order deterministically', () => {
    expect(planResearch(dto({ sources: ['news', 'academic'] })).sources).toEqual(['news', 'academic']);
  });
});
