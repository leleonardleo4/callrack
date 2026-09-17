import type { GovernmentDatasetResult } from '../providers/government/government.types.js';
import type { CensusQueryResponseData } from './government-response.types.js';

/**
 * Passes the Census Bureau's own string values through unchanged — the
 * capability doesn't know which variable codes are numeric estimates versus
 * categorical/FIPS codes, so it never coerces types it can't be sure of.
 */
export function toCensusResponse(result: GovernmentDatasetResult, year: number): CensusQueryResponseData {
  return {
    dataset: result.dataset,
    year,
    columns: result.columns,
    rows: result.rows,
  };
}
