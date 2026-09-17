import { describe, expect, it } from 'vitest';
import { toCensusResponse } from '../../src/government/government.mapper.js';
import type { GovernmentDatasetResult } from '../../src/providers/government/government.types.js';

describe('government.mapper', () => {
  it('maps a populated dataset result to the public contract', () => {
    const result: GovernmentDatasetResult = {
      dataset: 'acs/acs1',
      columns: ['NAME', 'B01001_001E'],
      rows: [{ NAME: 'California', B01001_001E: '39029342' }],
    };
    expect(toCensusResponse(result, 2021)).toEqual({
      dataset: 'acs/acs1',
      year: 2021,
      columns: ['NAME', 'B01001_001E'],
      rows: [{ NAME: 'California', B01001_001E: '39029342' }],
    });
  });

  it('never coerces string values to numbers', () => {
    const result: GovernmentDatasetResult = {
      dataset: 'acs/acs1',
      columns: ['B01001_001E'],
      rows: [{ B01001_001E: '39029342' }],
    };
    expect(typeof toCensusResponse(result, 2021).rows[0]?.B01001_001E).toBe('string');
  });

  it('normalizes an empty rows array without inventing data', () => {
    expect(toCensusResponse({ dataset: 'acs/acs1', columns: ['NAME'], rows: [] }, 2021)).toEqual({
      dataset: 'acs/acs1',
      year: 2021,
      columns: ['NAME'],
      rows: [],
    });
  });
});
